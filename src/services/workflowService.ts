import {
  seedJobExecutions,
  seedJobNodeRunLogs,
  seedJobNodes,
  seedRuleConditionGroups,
  seedRuleConditions
} from "../mock/seeds";
import type {
  ExecutionLogItem,
  JobExecutionSummary,
  JobNodeDefinition,
  JobNodeRunLog,
  RuleCondition,
  RuleConditionGroup,
  RuleLogicType,
  RuleOperand,
  RuleOperator,
  RulePreviewInput,
  RulePreviewResult,
  RulePreviewTrace
} from "../types";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function nextId(items: Array<{ id: number }>) {
  if (items.length === 0) {
    return 1;
  }
  return Math.max(...items.map((item) => item.id)) + 1;
}

const store = {
  groups: structuredClone(seedRuleConditionGroups),
  conditions: structuredClone(seedRuleConditions),
  nodes: structuredClone(seedJobNodes),
  executions: structuredClone(seedJobExecutions),
  nodeLogs: structuredClone(seedJobNodeRunLogs)
};

function preprocessValue(value: string, preprocessorIds: number[]): string {
  let current = value;
  for (const id of preprocessorIds) {
    if (id === 3501) {
      current = current.trim();
      continue;
    }
    if (id === 3502) {
      const date = new Date(current);
      if (!Number.isNaN(date.getTime())) {
        current = date.toISOString().slice(0, 10);
      }
      continue;
    }
    if (id === 3503) {
      const digits = current.replace(/\D/g, "");
      if (digits.length >= 7) {
        current = `${digits.slice(0, 3)}****${digits.slice(-4)}`;
      }
    }
  }
  return current;
}

function deriveInterfaceFieldKey(path?: string) {
  if (!path) {
    return "";
  }
  const normalized = path
    .replace(/^\$\./, "")
    .replace(/\[\d+\]/g, "")
    .trim();
  if (!normalized) {
    return "";
  }
  const segments = normalized.split(".").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

function resolveOperand(operand: RuleOperand | undefined, input: RulePreviewInput): string {
  if (!operand) {
    return "";
  }
  const preprocessorIds =
    operand.preprocessorIds.length > 0
      ? operand.preprocessorIds
      : (operand.preprocessorConfigs ?? []).map((item) => item.preprocessorId);
  let raw = "";
  if (operand.sourceType === "CONST") {
    raw = operand.constValue ?? operand.key;
  } else if (operand.sourceType === "PAGE_FIELD") {
    raw = input.pageFields[operand.key] ?? "";
  } else if (operand.sourceType === "CONTEXT") {
    raw = input.context[operand.key] ?? "";
  } else if (operand.sourceType === "INTERFACE_FIELD") {
    const byBindingPath = deriveInterfaceFieldKey(operand.interfaceBinding?.outputPath);
    const fallback: Record<string, string> = {
      risk_score: "86",
      score: "86",
      risk_level: "HIGH",
      riskLevel: "HIGH",
      decision_code: "PASS"
    };
    raw =
      input.interfaceFields[operand.key] ??
      input.interfaceFields[byBindingPath] ??
      fallback[operand.key] ??
      fallback[byBindingPath] ??
      "";
  } else if (operand.sourceType === "LIST_LOOKUP_FIELD") {
    const binding = operand.listBinding;
    const resultField = binding?.resultField?.trim() || operand.key;
    const matchers =
      binding?.matchers && binding.matchers.length > 0
        ? binding.matchers
        : binding?.matchColumn
          ? [
              {
                matchColumn: binding.matchColumn,
                sourceType: binding.lookupSourceType ?? "PAGE_FIELD",
                sourceValue: binding.lookupSourceValue ?? ""
              }
            ]
          : [];
    const matched = matchers.length > 0 && matchers.every((item) => resolveLookupMatcherValue(item.sourceType, item.sourceValue, input).trim());
    const fallbackByField: Record<string, string> = {
      risk_level: "HIGH",
      risk_score: "92",
      risk_tag: "WATCH",
      control_level: "A",
      customer_level: "S",
      expire_at: "2026-12-31"
    };
    raw = matched ? input.interfaceFields[resultField] ?? fallbackByField[resultField] ?? `${binding?.listDataName ?? "名单"}:${resultField}` : "";
  }
  return preprocessValue(raw, preprocessorIds);
}

function resolveLookupMatcherValue(
  sourceType: NonNullable<NonNullable<RuleOperand["listBinding"]>["lookupSourceType"]>,
  sourceValue: string,
  input: RulePreviewInput
) {
  if (sourceType === "CONST") {
    return sourceValue;
  }
  if (sourceType === "PAGE_FIELD") {
    return input.pageFields[sourceValue] ?? "";
  }
  if (sourceType === "CONTEXT") {
    return input.context[sourceValue] ?? "";
  }
  return input.interfaceFields[sourceValue] ?? input.interfaceFields[deriveInterfaceFieldKey(sourceValue)] ?? "";
}

function compareValues(operator: RuleOperator, left: string, right: string): { passed: boolean; reason: string } {
  if (operator === "EXISTS") {
    const passed = left.trim().length > 0;
    return {
      passed,
      reason: passed ? "左值存在" : "左值为空，按不命中处理"
    };
  }
  if (operator === "EQ") {
    const passed = left === right;
    return {
      passed,
      reason: passed ? "字符串相等" : "字符串不相等"
    };
  }
  if (operator === "NE") {
    const passed = left !== right;
    return {
      passed,
      reason: passed ? "字符串不相等" : "字符串相等"
    };
  }
  if (operator === "CONTAINS") {
    const passed = left.includes(right);
    return {
      passed,
      reason: passed ? "左值包含右值" : "左值不包含右值"
    };
  }
  if (operator === "NOT_CONTAINS") {
    const passed = !left.includes(right);
    return {
      passed,
      reason: passed ? "左值不包含右值" : "左值包含右值"
    };
  }
  if (operator === "IN") {
    const passed = right
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .includes(left);
    return {
      passed,
      reason: passed ? "左值命中右值集合" : "左值未命中右值集合"
    };
  }

  if (operator === "GT") {
    const l = Number(left);
    const r = Number(right);
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      return {
        passed: false,
        reason: "操作符为数值比较，但值无法转换为数字，按不命中处理"
      };
    }
    return {
      passed: l > r,
      reason: l > r ? "数值比较命中：左值大于右值" : "数值比较未命中：左值不大于右值"
    };
  }
  if (operator === "GE") {
    const l = Number(left);
    const r = Number(right);
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      return {
        passed: false,
        reason: "操作符为数值比较，但值无法转换为数字，按不命中处理"
      };
    }
    return {
      passed: l >= r,
      reason: l >= r ? "数值比较命中：左值大于等于右值" : "数值比较未命中：左值小于右值"
    };
  }
  if (operator === "LT") {
    const l = Number(left);
    const r = Number(right);
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      return {
        passed: false,
        reason: "操作符为数值比较，但值无法转换为数字，按不命中处理"
      };
    }
    return {
      passed: l < r,
      reason: l < r ? "数值比较命中：左值小于右值" : "数值比较未命中：左值不小于右值"
    };
  }
  if (operator === "LE") {
    const l = Number(left);
    const r = Number(right);
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      return {
        passed: false,
        reason: "操作符为数值比较，但值无法转换为数字，按不命中处理"
      };
    }
    return {
      passed: l <= r,
      reason: l <= r ? "数值比较命中：左值小于等于右值" : "数值比较未命中：左值大于右值"
    };
  }
  return {
    passed: false,
    reason: "不支持的比较操作符"
  };
}

function evaluateRule(ruleId: number, input: RulePreviewInput): RulePreviewResult {
  const groups = store.groups.filter((item) => item.ruleId === ruleId);
  const conditions = store.conditions.filter((item) => item.ruleId === ruleId);
  const traces: RulePreviewTrace[] = [];

  if (groups.length === 0 || conditions.length === 0) {
    return {
      ruleId,
      matched: false,
      summary: "规则未配置条件，无法命中。",
      traces
    };
  }

  const evalGroup = (groupId: number): boolean => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      return false;
    }

    const ownConditions = conditions.filter((item) => item.groupId === groupId);
    const childGroups = groups.filter((item) => item.parentGroupId === groupId);
    const results: boolean[] = [];

    for (const condition of ownConditions) {
      const leftValue = resolveOperand(condition.left, input);
      const rightValue = resolveOperand(condition.right, input);
      const compareResult = compareValues(condition.operator, leftValue, rightValue);
      const passed = compareResult.passed;
      traces.push({
        conditionId: condition.id,
        expression: `${condition.left.sourceType}:${condition.left.key} ${condition.operator} ${condition.right?.sourceType ?? ""}:${condition.right?.key ?? ""}`,
        leftValue,
        rightValue,
        passed,
        reason: compareResult.reason
      });
      results.push(passed);
    }

    for (const child of childGroups) {
      results.push(evalGroup(child.id));
    }

    if (results.length === 0) {
      return false;
    }

    return group.logicType === "AND" ? results.every(Boolean) : results.some(Boolean);
  };

  const roots = groups.filter((item) => !item.parentGroupId);
  const matched = roots.every((group) => evalGroup(group.id));

  return {
    ruleId,
    matched,
    summary: matched ? "规则命中：条件组计算结果为 true" : "规则未命中：存在条件未满足",
    traces
  };
}

function parseNodeConfig(configJson: string): Record<string, unknown> {
  try {
    return JSON.parse(configJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function executeSceneInternal(
  sceneId: number,
  sceneName: string,
  triggerSource: ExecutionLogItem["triggerSource"],
  options?: { ignoreForceFail?: boolean }
): JobExecutionSummary {
  const nodes = store.nodes
    .filter((item) => item.sceneId === sceneId && item.enabled)
    .sort((a, b) => a.orderNo - b.orderNo);

  const executionId = nextId(store.executions);
  const startedAt = nowIso();
  let failed = false;
  let failReason = "";
  const logs: JobNodeRunLog[] = [];

  if (nodes.length === 0) {
    failed = true;
    failReason = "场景未配置可执行节点";
  }

  for (const node of nodes) {
    if (failed) {
      logs.push({
        id: nextId([...store.nodeLogs, ...logs]),
        executionId,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.nodeType,
        status: "SKIPPED",
        latencyMs: 0,
        detail: "上游失败，节点跳过",
        createdAt: nowIso()
      });
      continue;
    }

    const config = parseNodeConfig(node.configJson);
    const forceFail = Boolean(config.forceFail) && !options?.ignoreForceFail;

    if (forceFail) {
      failed = true;
      failReason = `${node.nodeType} 节点失败`;
      logs.push({
        id: nextId([...store.nodeLogs, ...logs]),
        executionId,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.nodeType,
        status: "FAILED",
        latencyMs: 480,
        detail: "模拟失败：forceFail=true",
        createdAt: nowIso()
      });
    } else {
      logs.push({
        id: nextId([...store.nodeLogs, ...logs]),
        executionId,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.nodeType,
        status: "SUCCESS",
        latencyMs: 90 + node.orderNo * 50,
        detail: `节点执行成功：${node.nodeType}`,
        createdAt: nowIso()
      });
    }
  }

  const result: JobExecutionSummary["result"] = failed ? "FAILED" : "SUCCESS";
  const execution: JobExecutionSummary = {
    id: executionId,
    sceneId,
    sceneName,
    triggerSource,
    result,
    fallbackToManual: failed,
    detail: failed ? `${failReason}，已回退手工路径` : "全部节点执行成功",
    startedAt,
    finishedAt: nowIso()
  };

  store.executions = [execution, ...store.executions];
  store.nodeLogs = [...logs, ...store.nodeLogs];

  return execution;
}

export const workflowService = {
  async listRuleConditionGroups(ruleId: number): Promise<RuleConditionGroup[]> {
    await sleep(100);
    return structuredClone(store.groups.filter((item) => item.ruleId === ruleId));
  },

  async listRuleConditions(ruleId: number): Promise<RuleCondition[]> {
    await sleep(100);
    return structuredClone(store.conditions.filter((item) => item.ruleId === ruleId));
  },

  async createRuleConditionGroup(ruleId: number, logicType: RuleLogicType, parentGroupId?: number): Promise<RuleConditionGroup> {
    await sleep(100);
    if (parentGroupId) {
      const parent = store.groups.find((item) => item.id === parentGroupId && item.ruleId === ruleId);
      if (!parent) {
        throw new Error("父条件组不存在");
      }
      if (parent.parentGroupId) {
        throw new Error("仅支持两层嵌套，不能继续新增子组");
      }
    }

    const created: RuleConditionGroup = {
      id: nextId(store.groups),
      ruleId,
      logicType,
      parentGroupId,
      updatedAt: nowIso()
    };
    store.groups = [created, ...store.groups];
    return structuredClone(created);
  },

  async updateRuleConditionGroup(groupId: number, logicType: RuleLogicType): Promise<void> {
    await sleep(80);
    store.groups = store.groups.map((item) => (item.id === groupId ? { ...item, logicType, updatedAt: nowIso() } : item));
  },

  async deleteRuleConditionGroup(groupId: number): Promise<void> {
    await sleep(80);
    const ids = new Set<number>();
    const walk = (id: number) => {
      ids.add(id);
      const children = store.groups.filter((item) => item.parentGroupId === id);
      for (const child of children) {
        walk(child.id);
      }
    };
    walk(groupId);

    store.groups = store.groups.filter((item) => !ids.has(item.id));
    store.conditions = store.conditions.filter((item) => !ids.has(item.groupId));
  },

  async upsertRuleCondition(payload: Omit<RuleCondition, "updatedAt"> & { updatedAt?: string }): Promise<RuleCondition> {
    await sleep(120);
    const group = store.groups.find((item) => item.id === payload.groupId);
    if (!group || group.ruleId !== payload.ruleId) {
      throw new Error("条件组不存在或不属于当前规则");
    }

    const next: RuleCondition = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    const exists = store.conditions.some((item) => item.id === next.id);
    store.conditions = exists
      ? store.conditions.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.conditions];
    return structuredClone(next);
  },

  async deleteRuleCondition(conditionId: number): Promise<void> {
    await sleep(80);
    store.conditions = store.conditions.filter((item) => item.id !== conditionId);
  },

  async cloneRuleLogic(sourceRuleId: number, targetRuleId: number): Promise<void> {
    await sleep(140);
    const sourceGroups = store.groups
      .filter((item) => item.ruleId === sourceRuleId)
      .sort((a, b) => a.id - b.id);
    const sourceConditions = store.conditions
      .filter((item) => item.ruleId === sourceRuleId)
      .sort((a, b) => a.id - b.id);

    if (sourceGroups.length === 0) {
      return;
    }

    const groupIdMap = new Map<number, number>();
    for (const group of sourceGroups) {
      const nextGroupId = nextId(store.groups);
      groupIdMap.set(group.id, nextGroupId);
      store.groups = [
        {
          ...group,
          id: nextGroupId,
          ruleId: targetRuleId,
          parentGroupId: group.parentGroupId ? groupIdMap.get(group.parentGroupId) : undefined,
          updatedAt: nowIso()
        },
        ...store.groups
      ];
    }

    for (const condition of sourceConditions) {
      const nextConditionId = nextId(store.conditions);
      const mappedGroupId = groupIdMap.get(condition.groupId);
      if (!mappedGroupId) {
        continue;
      }
      store.conditions = [
        {
          ...condition,
          id: nextConditionId,
          ruleId: targetRuleId,
          groupId: mappedGroupId,
          updatedAt: nowIso()
        },
        ...store.conditions
      ];
    }
  },

  async previewRuleWithInput(ruleId: number, input: RulePreviewInput): Promise<RulePreviewResult> {
    await sleep(140);
    return evaluateRule(ruleId, input);
  },

  async listJobNodes(sceneId: number): Promise<JobNodeDefinition[]> {
    await sleep(100);
    return structuredClone(store.nodes.filter((item) => item.sceneId === sceneId).sort((a, b) => a.orderNo - b.orderNo));
  },

  async upsertJobNode(payload: Omit<JobNodeDefinition, "updatedAt"> & { updatedAt?: string }): Promise<JobNodeDefinition> {
    await sleep(110);
    const next: JobNodeDefinition = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    const exists = store.nodes.some((item) => item.id === next.id);
    store.nodes = exists ? store.nodes.map((item) => (item.id === next.id ? next : item)) : [next, ...store.nodes];
    return structuredClone(next);
  },

  async deleteJobNode(nodeId: number): Promise<void> {
    await sleep(80);
    store.nodes = store.nodes.filter((item) => item.id !== nodeId);
  },

  async executeJobScene(sceneId: number, sceneName: string, triggerSource: ExecutionLogItem["triggerSource"]): Promise<JobExecutionSummary> {
    await sleep(160);
    return executeSceneInternal(sceneId, sceneName, triggerSource);
  },

  async retryJobExecution(executionId: number): Promise<JobExecutionSummary> {
    await sleep(160);
    const execution = store.executions.find((item) => item.id === executionId);
    if (!execution) {
      throw new Error("执行实例不存在");
    }
    return executeSceneInternal(execution.sceneId, execution.sceneName, "MANUAL_RETRY", { ignoreForceFail: true });
  },

  async listJobExecutions(sceneId: number): Promise<JobExecutionSummary[]> {
    await sleep(100);
    return structuredClone(store.executions.filter((item) => item.sceneId === sceneId));
  },

  async listJobNodeRunLogs(executionId: number): Promise<JobNodeRunLog[]> {
    await sleep(100);
    return structuredClone(store.nodeLogs.filter((item) => item.executionId === executionId));
  }
};
