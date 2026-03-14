import type {
  InterfaceDefinition,
  LifecycleState,
  PromptCloseMode,
  PromptMode,
  RuleCondition,
  RuleOperand,
  RuleOperandSourceType,
  RuleOperandValueType,
  RuleOperator
} from "../../types";

export type RuleForm = {
  name: string;
  ruleScope: "SHARED" | "PAGE_RESOURCE";
  ruleSetCode: string;
  pageResourceId?: number;
  priority: number;
  promptMode: PromptMode;
  closeMode: PromptCloseMode;
  closeTimeoutSec?: number;
  hasConfirmButton: boolean;
  sceneId?: number;
  status: LifecycleState;
  ownerOrgId: string;
};

export type OperandSide = "left" | "right";

export type PreprocessorDraft = {
  id: string;
  preprocessorId?: number;
  params: string;
};

export type OperandDraft = {
  sourceType: RuleOperandSourceType;
  valueType: RuleOperandValueType;
  displayValue: string;
  machineKey: string;
  interfaceId?: number;
  interfaceName?: string;
  outputPath?: string;
  interfaceInputConfig: string;
  preprocessors: PreprocessorDraft[];
};

export type FlatConditionDraft = {
  id: string;
  operator: RuleOperator;
  left: OperandDraft;
  right: OperandDraft;
};

export type SelectedOperand = {
  conditionId: string;
  side: OperandSide;
};

export type InterfaceInputParamDraft = {
  tab: "headers" | "query" | "path" | "body";
  name: string;
  description: string;
  required: boolean;
  sourceType: "CONST" | "PAGE_ELEMENT" | "API_OUTPUT" | "CONTEXT";
  sourceValue: string;
  valueType: RuleOperandValueType;
};

export const OPERAND_PILL_WIDTH = 320;
export const LOGIC_OPERATOR_WIDTH = 92;

export const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

export const closeModeLabel: Record<PromptCloseMode, string> = {
  AUTO_CLOSE: "自动关闭",
  MANUAL_CLOSE: "手动关闭",
  TIMER_THEN_MANUAL: "超时后关闭"
};

export const sourceOptions: Array<{ label: string; value: RuleOperandSourceType }> = [
  { label: "页面字段", value: "PAGE_FIELD" },
  { label: "API字段", value: "INTERFACE_FIELD" },
  { label: "上下文变量", value: "CONTEXT" },
  { label: "固定值", value: "CONST" }
];

export const valueTypeOptions: Array<{ label: string; value: RuleOperandValueType }> = [
  { label: "字符串", value: "STRING" },
  { label: "数字", value: "NUMBER" },
  { label: "布尔", value: "BOOLEAN" },
  { label: "对象", value: "OBJECT" },
  { label: "数组", value: "ARRAY" }
];

export const operatorOptions: Array<{ value: RuleOperator; label: string }> = [
  { value: "EQ", label: "=" },
  { value: "NE", label: "!=" },
  { value: "GT", label: ">" },
  { value: "GE", label: ">=" },
  { value: "LT", label: "<" },
  { value: "LE", label: "<=" },
  { value: "CONTAINS", label: "包含" },
  { value: "NOT_CONTAINS", label: "不包含" },
  { value: "IN", label: "IN" },
  { value: "EXISTS", label: "EXISTS" }
];

export type RulePageFieldOption = {
  label: string;
  value: string;
  group: "公共字段" | "页面字段";
};

export const contextOptions = ["org_id", "operator_role", "channel", "user_role"];

export const sourceVisualMap: Record<RuleOperandSourceType, { label: string; color: string; bg: string; border: string }> = {
  CONST: {
    label: "固定值",
    color: "var(--cc-source-fixed, #475467)",
    bg: "var(--cc-source-fixed-bg, #F2F4F7)",
    border: "var(--cc-source-fixed-border, #D0D5DD)"
  },
  PAGE_FIELD: {
    label: "页面元素",
    color: "var(--cc-source-page, #175CD3)",
    bg: "var(--cc-source-page-bg, #EFF8FF)",
    border: "var(--cc-source-page-border, #B2DDFF)"
  },
  INTERFACE_FIELD: {
    label: "API",
    color: "var(--cc-source-api, #027A48)",
    bg: "var(--cc-source-api-bg, #ECFDF3)",
    border: "var(--cc-source-api-border, #ABEFC6)"
  },
  CONTEXT: {
    label: "上下文变量",
    color: "var(--cc-source-context, #B54708)",
    bg: "var(--cc-source-context-bg, #FFFAEB)",
    border: "var(--cc-source-context-border, #FEC84B)"
  }
};

export function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function normalizeOperandValueType(value: unknown): RuleOperandValueType {
  if (value === "NUMBER" || value === "BOOLEAN" || value === "OBJECT" || value === "ARRAY") {
    return value;
  }
  return "STRING";
}

export function parseInterfaceInputConfig(raw: string) {
  return parseJsonSafe<Record<string, string>>(raw, {});
}

export function stringifyInterfaceInputConfig(config: Record<string, string>) {
  const normalized = Object.entries(config)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key && value)
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : "";
}

export function collectOutputPathMeta(
  outputs: unknown[],
  collector: Array<{ path: string; valueType: RuleOperandValueType }> = []
): Array<{ path: string; valueType: RuleOperandValueType }> {
  for (const item of outputs) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as { path?: unknown; valueType?: unknown; children?: unknown[] };
    if (typeof row.path === "string" && row.path.trim()) {
      collector.push({
        path: row.path.trim(),
        valueType: normalizeOperandValueType(row.valueType)
      });
    }
    if (Array.isArray(row.children)) {
      collectOutputPathMeta(row.children, collector);
    }
  }
  return collector;
}

export function collectInterfaceInputParams(target: InterfaceDefinition | undefined): InterfaceInputParamDraft[] {
  if (!target) {
    return [];
  }

  const parsed = parseJsonSafe<Record<string, unknown>>(target.inputConfigJson, {});
  const tabs: Array<InterfaceInputParamDraft["tab"]> = ["headers", "query", "path", "body"];
  const rows: InterfaceInputParamDraft[] = [];

  for (const tab of tabs) {
    const section = parsed[tab];
    if (!Array.isArray(section)) {
      continue;
    }
    for (const item of section) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as Record<string, unknown>;
      const sourceType = row.sourceType;
      rows.push({
        tab,
        name: typeof row.name === "string" ? row.name : "",
        description: typeof row.description === "string" ? row.description : "",
        required: Boolean(row.required),
        sourceType:
          sourceType === "PAGE_ELEMENT" || sourceType === "API_OUTPUT" || sourceType === "CONTEXT"
            ? sourceType
            : "CONST",
        sourceValue: typeof row.sourceValue === "string" ? row.sourceValue : "",
        valueType: normalizeOperandValueType(row.valueType)
      });
    }
  }

  return rows;
}

export function buildConditionId() {
  return `condition-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function buildPreprocessorId() {
  return `pre-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function buildDefaultOperand(sourceType: RuleOperandSourceType = "PAGE_FIELD"): OperandDraft {
  return {
    sourceType,
    valueType: "STRING",
    displayValue: "",
    machineKey: "",
    interfaceInputConfig: "",
    preprocessors: []
  };
}

export function buildDefaultCondition(): FlatConditionDraft {
  return {
    id: buildConditionId(),
    operator: "EQ",
    left: buildDefaultOperand("PAGE_FIELD"),
    right: buildDefaultOperand("CONST")
  };
}

export function normalizeSourceType(value: string | undefined): RuleOperandSourceType {
  if (value === "INTERFACE_FIELD" || value === "CONST" || value === "CONTEXT") {
    return value;
  }
  return "PAGE_FIELD";
}

export function normalizeOperator(value: string | undefined): RuleOperator {
  const allowed: RuleOperator[] = ["EQ", "NE", "GT", "GE", "LT", "LE", "CONTAINS", "NOT_CONTAINS", "IN", "EXISTS"];
  return allowed.includes(value as RuleOperator) ? (value as RuleOperator) : "EQ";
}

export function deriveMachineKeyFromOutputPath(path: string) {
  return path
    .replace(/^\$\./, "")
    .replace(/\[\d+\]/g, "")
    .split(".")
    .filter(Boolean)
    .pop() ?? "";
}
export function parseInterfaceLabel(text: string): { interfaceName?: string; outputPath?: string } {
  if (!text.includes(".")) {
    return {};
  }
  const index = text.indexOf(".");
  const interfaceName = text.slice(0, index).trim();
  const outputPath = text.slice(index + 1).trim();
  return {
    interfaceName: interfaceName || undefined,
    outputPath: outputPath || undefined
  };
}

export function toOperandDraft(operand: RuleOperand | undefined): OperandDraft {
  if (!operand) {
    return buildDefaultOperand("CONST");
  }

  const displayValue = operand.displayValue ?? (operand.sourceType === "CONST" ? operand.constValue ?? operand.key : operand.key);
  const parsedApi = parseInterfaceLabel(displayValue);

  const preprocessors =
    operand.preprocessorConfigs && operand.preprocessorConfigs.length > 0
      ? operand.preprocessorConfigs.map((item) => ({
          id: buildPreprocessorId(),
          preprocessorId: item.preprocessorId,
          params: item.params ?? ""
        }))
      : operand.preprocessorIds.map((id) => ({ id: buildPreprocessorId(), preprocessorId: id, params: "" }));

  const binding = operand.interfaceBinding;
  return {
    sourceType: operand.sourceType,
    valueType: operand.valueType ?? "STRING",
    displayValue: displayValue ?? "",
    machineKey: operand.key ?? "",
    interfaceId: binding?.interfaceId,
    interfaceName: binding?.interfaceName ?? parsedApi.interfaceName,
    outputPath: binding?.outputPath ?? parsedApi.outputPath,
    interfaceInputConfig: binding?.inputConfig ?? "",
    preprocessors
  };
}

export function toFlatCondition(condition: RuleCondition): FlatConditionDraft {
  return {
    id: `condition-${condition.id}`,
    operator: condition.operator,
    left: toOperandDraft(condition.left),
    right: toOperandDraft(condition.right)
  };
}

export function hasDirtyOperandConfig(operand: OperandDraft) {
  return Boolean(
    operand.displayValue.trim() ||
      operand.machineKey.trim() ||
      operand.interfaceId ||
      operand.interfaceName?.trim() ||
      operand.outputPath?.trim() ||
      operand.interfaceInputConfig.trim() ||
      operand.preprocessors.length > 0
  );
}

export function resetOperandBySource(sourceType: RuleOperandSourceType, previous: OperandDraft): OperandDraft {
  return {
    sourceType,
    valueType: previous.valueType,
    displayValue: "",
    machineKey: "",
    interfaceInputConfig: "",
    preprocessors: []
  };
}

export function resolveOperandSummary(operand: OperandDraft) {
  const visual = sourceVisualMap[operand.sourceType];
  if (operand.sourceType === "INTERFACE_FIELD") {
    const interfaceName = operand.interfaceName?.trim() || "API名称";
    const outputPath = operand.outputPath?.trim();
    const warning = !outputPath;
    return {
      visual,
      warning,
      mainText: `${interfaceName}.${outputPath || "(未绑定输出值)"}`,
      subText: operand.interfaceInputConfig.trim() ? "含入参配置" : "未配置入参"
    };
  }

  return {
    visual,
    warning: false,
    mainText: operand.displayValue.trim() || "(未配置)",
    subText: operand.valueType
  };
}

export function toRuleOperand(draft: OperandDraft): RuleOperand {
  const selectedPreprocessors = draft.preprocessors.filter((item) => typeof item.preprocessorId === "number");
  if (draft.sourceType === "INTERFACE_FIELD") {
    const interfaceName = draft.interfaceName?.trim() || "API名称";
    const outputPath = draft.outputPath?.trim();
    const displayValue = `${interfaceName}.${outputPath || "(未绑定输出值)"}`;
    const machineKey = draft.machineKey.trim() || deriveMachineKeyFromOutputPath(outputPath ?? "");
    return {
      sourceType: draft.sourceType,
      key: machineKey,
      preprocessorIds: selectedPreprocessors.map((item) => item.preprocessorId as number),
      valueType: draft.valueType,
      displayValue,
      interfaceBinding: {
        interfaceId: draft.interfaceId,
        interfaceName,
        outputPath,
        inputConfig: draft.interfaceInputConfig.trim() || undefined
      },
      preprocessorConfigs: selectedPreprocessors.map((item) => ({
        preprocessorId: item.preprocessorId as number,
        params: item.params.trim() || undefined
      }))
    };
  }

  const value = draft.displayValue.trim();
  return {
    sourceType: draft.sourceType,
    key: value,
    constValue: draft.sourceType === "CONST" ? value : undefined,
    preprocessorIds: selectedPreprocessors.map((item) => item.preprocessorId as number),
    valueType: draft.valueType,
    displayValue: value,
    preprocessorConfigs: selectedPreprocessors.map((item) => ({
      preprocessorId: item.preprocessorId as number,
      params: item.params.trim() || undefined
    }))
  };
}

