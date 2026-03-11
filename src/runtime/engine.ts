import type {
  ConditionExpression,
  HintRule,
  InterfaceDefinition,
  OperationDefinition,
  OrchestrationDefinition,
  OrchestrationNode,
  PreprocessorConfig,
  RuntimeInput,
  RuntimeLog,
  RuntimeResult,
  ValueSource
} from "../types";

const platformPolicy = {
  timeout_ms: 1000,
  retry_count: 1
};

export interface EngineBundle {
  interfaces: InterfaceDefinition[];
  hints: HintRule[];
  operations: OperationDefinition[];
  orchestrations: OrchestrationDefinition[];
}

export interface RunOptions {
  previewDecision?: {
    action: "confirm" | "cancel";
    overrides?: Record<string, string>;
  };
  apiCaller?: (definition: InterfaceDefinition, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export async function runRuntime(bundle: EngineBundle, input: RuntimeInput, options: RunOptions = {}): Promise<{
  result: RuntimeResult;
  logs: RuntimeLog[];
}> {
  const logs: RuntimeLog[] = [];
  const pageValues = { ...input.pageValues };
  const mergedHints: RuntimeResult["mergedHints"] = [];
  const operationResults: RuntimeResult["operationResults"] = [];

  for (const hint of bundle.hints) {
    if (!hint.menu_scope_ids.includes(input.context.menu_scope_id)) {
      continue;
    }
    if (!matchStrategy(hint, input.context)) {
      continue;
    }
    const evalResult = await evaluateHint(hint, bundle.interfaces, input, pageValues, logs, options);
    if (!evalResult.matched) {
      continue;
    }

    mergedHints.push({
      id: hint.id,
      title: hint.title,
      content: hint.content,
      risk_level: hint.risk_level
    });

    if (hint.operation_id) {
      const operation = bundle.operations.find((x) => x.operation_id === hint.operation_id);
      if (!operation) {
        operationResults.push({
          operation_id: hint.operation_id,
          status: "FAILED",
          message: "未找到对应智能作业"
        });
        addLog(logs, "operation.missing", `hint=${hint.id}, operation=${hint.operation_id}`);
      } else {
        const orchestration = bundle.orchestrations.find((x) => x.orchestration_id === operation.orchestration_id);
        if (!orchestration) {
          operationResults.push({
            operation_id: hint.operation_id,
            status: "FAILED",
            message: "未找到对应编排"
          });
          addLog(logs, "orchestration.missing", `operation=${operation.operation_id}`);
        } else {
          const exec = await executeOrchestration(orchestration, operation, bundle.interfaces, pageValues, input, logs, options);
          operationResults.push({
            operation_id: operation.operation_id,
            status: exec.status,
            message: exec.message
          });
        }
      }
    }
  }

  return {
    result: {
      mergedHints,
      operationResults,
      finalPageValues: pageValues
    },
    logs
  };
}

function matchStrategy(hint: HintRule, context: RuntimeInput["context"]) {
  const ipMatch = hint.strategy.ips.length === 0 || hint.strategy.ips.includes(context.ip);
  const personMatch = hint.strategy.persons.length === 0 || hint.strategy.persons.includes(context.person_id);
  const orgMatch = hint.strategy.orgs.length === 0 || hint.strategy.orgs.includes(context.org_id);
  return ipMatch && personMatch && orgMatch;
}

async function evaluateHint(
  hint: HintRule,
  interfaces: InterfaceDefinition[],
  input: RuntimeInput,
  pageValues: Record<string, string>,
  logs: RuntimeLog[],
  options: RunOptions
) {
  const results: boolean[] = [];
  for (const condition of hint.conditions) {
    try {
      const left = await resolveOperand(condition.left, condition.left_preprocessors ?? [], interfaces, input, pageValues, options, logs);
      const right = await resolveOperand(condition.right, condition.right_preprocessors ?? [], interfaces, input, pageValues, options, logs);
      const matched = compare(condition.operator, left, right);
      results.push(matched);
      addLog(logs, "condition.evaluated", `${hint.id}/${condition.id} => ${String(matched)}`);
    } catch (error) {
      results.push(false);
      addLog(logs, "condition.failed", `${hint.id}/${condition.id} => ${String((error as Error).message)}`);
    }
  }

  const matched = hint.relation === "OR" ? results.some(Boolean) : results.every(Boolean);
  addLog(logs, "hint.evaluated", `${hint.id} => ${String(matched)}`);
  return { matched };
}

async function resolveOperand(
  source: ValueSource,
  chain: PreprocessorConfig[],
  interfaces: InterfaceDefinition[],
  input: RuntimeInput,
  pageValues: Record<string, string>,
  options: RunOptions,
  logs: RuntimeLog[]
) {
  let value: unknown;
  if (source.type === "fixed") {
    value = source.value;
  } else if (source.type === "page") {
    value = pageValues[source.xpath] ?? "";
    if (value === "") {
      throw new Error(`页面元素不存在或为空: ${source.xpath}`);
    }
  } else {
    const def = interfaces.find((x) => x.interface_id === source.interface_id);
    if (!def || def.status !== "PUBLISHED") {
      throw new Error(`接口未发布: ${source.interface_id}`);
    }
    const payload = {
      context: input.context,
      page: pageValues
    };
    const resp = await callInterface(def, payload, options);
    value = pickByPath(resp, source.response_path);
    if (value == null || value === "") {
      throw new Error(`接口响应为空: ${source.interface_id}/${source.response_path}`);
    }
  }

  for (const pre of chain) {
    value = applyPreprocessor(pre, value);
    addLog(logs, "preprocessor.applied", `${pre.id}`);
  }
  return value;
}

async function executeOrchestration(
  orchestration: OrchestrationDefinition,
  operation: OperationDefinition,
  interfaces: InterfaceDefinition[],
  pageValues: Record<string, string>,
  input: RuntimeInput,
  logs: RuntimeLog[],
  options: RunOptions
) {
  if (orchestration.status !== "ENABLED") {
    return { status: "FAILED" as const, message: "编排未启用" };
  }

  const context: Record<string, unknown> = { input, page: pageValues };
  const pendingWrites: Array<{ xpath: string; value: string }> = [];
  const nodes = [...orchestration.nodes].filter((x) => x.enabled).sort((a, b) => a.order - b.order);
  for (const node of nodes) {
    try {
      await executeNode(node, interfaces, context, pageValues, pendingWrites, options);
      addLog(logs, "node.executed", `${orchestration.orchestration_id}/${node.node_id}`);
    } catch (error) {
      addLog(logs, "node.failed", `${orchestration.orchestration_id}/${node.node_id}: ${String((error as Error).message)}`);
      return { status: "FAILED" as const, message: `节点失败: ${node.node_id}` };
    }
  }

  let writes = [...pendingWrites];
  if (operation.preview_mode) {
    const decision = options.previewDecision ?? { action: "confirm" as const };
    if (decision.action === "cancel") {
      addLog(logs, "preview.cancelled", operation.operation_id);
      return { status: "CANCELLED" as const, message: "用户取消预览注入" };
    }
    if (decision.overrides) {
      writes = writes.map((item) => ({
        ...item,
        value: decision.overrides?.[item.xpath] ?? item.value
      }));
    }
  }

  for (const write of writes) {
    pageValues[write.xpath] = write.value;
  }
  addLog(logs, "operation.completed", `${operation.operation_id}, write=${writes.length}`);
  return { status: "SUCCESS" as const, message: "执行成功" };
}

async function executeNode(
  node: OrchestrationNode,
  interfaces: InterfaceDefinition[],
  context: Record<string, unknown>,
  pageValues: Record<string, string>,
  pendingWrites: Array<{ xpath: string; value: string }>,
  options: RunOptions
) {
  switch (node.node_type) {
    case "page_get": {
      const xpath = String(node.config.xpath ?? "");
      const outKey = String(node.output_key ?? node.config.output_key ?? "");
      if (!xpath || !outKey) {
        throw new Error("page_get 缺少 xpath 或 output_key");
      }
      const val = pageValues[xpath];
      if (val == null || val === "") {
        throw new Error(`page_get 取值为空: ${xpath}`);
      }
      setByPath(context, outKey, val);
      return;
    }
    case "page_set": {
      const xpath = String(node.config.xpath ?? "");
      const sourceType = String(node.config.value_source_type ?? "fixed");
      let value = "";
      if (sourceType === "fixed") {
        value = String(node.config.value ?? "");
      } else if (sourceType === "context") {
        value = String(pickByPath(context, String(node.config.value_path ?? "")) ?? "");
      } else if (sourceType === "page") {
        value = String(pageValues[String(node.config.value_xpath ?? "")] ?? "");
      }
      if (!xpath || value === "") {
        throw new Error("page_set 缺少有效写入值");
      }
      pendingWrites.push({ xpath, value });
      return;
    }
    case "api_call": {
      const interfaceId = String(node.config.interface_id ?? "");
      const outputKey = String(node.output_key ?? node.config.output_key ?? "");
      const def = interfaces.find((x) => x.interface_id === interfaceId);
      if (!def || def.status !== "PUBLISHED") {
        throw new Error(`api_call 接口未发布: ${interfaceId}`);
      }
      const payload = {
        context,
        page: pageValues
      };
      const resp = await callInterface(def, payload, options);
      if (outputKey) {
        setByPath(context, outputKey, resp);
      }
      return;
    }
    case "js_script": {
      const outputKey = String(node.output_key ?? node.config.output_key ?? "");
      const mode = String(node.config.mode ?? "template");
      if (mode === "template") {
        const template = String(node.config.template ?? "");
        const value = template.replace(/\{\{(.+?)\}\}/g, (_, path) => String(pickByPath(context, path.trim()) ?? ""));
        if (outputKey) {
          setByPath(context, outputKey, value);
        }
      } else {
        const code = String(node.config.code ?? "");
        // eslint-disable-next-line no-new-func
        const fn = new Function("ctx", "page", code);
        const returned = fn(context, pageValues);
        if (outputKey) {
          setByPath(context, outputKey, returned);
        }
      }
      return;
    }
    case "custom":
    default:
      throw new Error(`暂不支持节点类型: ${node.node_type}`);
  }
}

function compare(operator: ConditionExpression["operator"], left: unknown, right: unknown): boolean {
  switch (operator) {
    case "eq":
      return left === right;
    case "ne":
      return left !== right;
    case "gt":
      return Number(left) > Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lte":
      return Number(left) <= Number(right);
    case "contains":
      return String(left).includes(String(right));
    case "not_contains":
      return !String(left).includes(String(right));
    case "in":
      return (Array.isArray(right) ? right : String(right).split(",")).map(String).includes(String(left));
    case "not_in":
      return !(Array.isArray(right) ? right : String(right).split(",")).map(String).includes(String(left));
    case "regex_match":
      return new RegExp(String(right)).test(String(left));
    case "is_empty":
      return left == null || String(left) === "";
    case "not_empty":
      return !(left == null || String(left) === "");
    default:
      return false;
  }
}

function applyPreprocessor(pre: PreprocessorConfig, input: unknown): unknown {
  if (pre.id === "prefix_extract") {
    const len = Number(pre.options?.length ?? 0);
    if (!Number.isInteger(len) || len <= 0) {
      throw new Error("prefix_extract 参数 length 无效");
    }
    return String(input ?? "").slice(0, len);
  }
  if (pre.id === "to_number") {
    const n = Number(input);
    if (Number.isNaN(n)) {
      throw new Error("to_number 转换失败");
    }
    return n;
  }
  throw new Error(`未知预处理器: ${pre.id}`);
}

async function callInterface(
  def: InterfaceDefinition,
  payload: Record<string, unknown>,
  options: RunOptions
): Promise<Record<string, unknown>> {
  const reqPayload = {
    timeout_ms: platformPolicy.timeout_ms,
    retry_count: platformPolicy.retry_count,
    ...payload
  };
  if (options.apiCaller) {
    return options.apiCaller(def, reqPayload);
  }
  return mockApi(def, reqPayload);
}

function mockApi(def: InterfaceDefinition, payload: Record<string, unknown>) {
  const page = (payload.page as Record<string, string>) ?? {};
  const customer = page["/form/customerNo"] ?? page["/root/customerNo"] ?? "UNKNOWN";
  const idcard = page["/form/idCard"] ?? "000000000000000000";
  const masked = `${idcard.slice(0, 4)}********${idcard.slice(-4)}`;
  return Promise.resolve({
    success: true,
    interface_id: def.interface_id,
    data: {
      customerNo: customer,
      customerName: `客户-${customer.slice(-4)}`,
      riskLevel: customer.endsWith("9") ? "HIGH" : "LOW",
      maskedIdCard: masked,
      extra: payload
    }
  });
}

export function addLog(list: RuntimeLog[], event: string, detail: string) {
  list.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    event,
    detail
  });
}

function pickByPath(target: unknown, path: string): unknown {
  if (!path) {
    return target;
  }
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, target);
}

function setByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!cursor[key] || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}
