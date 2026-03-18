import type {
  ApiInputValidationConfig,
  InterfaceDefinition,
  LifecycleState,
  PromptCloseMode,
  PromptMode,
  RuleCondition,
  RuleOperand,
  RuleLookupSourceType,
  RuleOperandSourceType,
  RuleOperandValueType,
  RuleOperator
} from "../../types";

export type RuleForm = {
  templateRuleId?: number;
  name: string;
  ruleScope: "SHARED" | "PAGE_RESOURCE";
  pageResourceId?: number;
  priority: number;
  promptMode: PromptMode;
  titleSuffix?: string;
  bodyTemplate: string;
  bodyEditorStateJson?: string;
  closeMode: PromptCloseMode;
  closeTimeoutSec?: number;
  hasConfirmButton: boolean;
  sceneId?: number;
  status: LifecycleState;
  ownerOrgId: string;
};

export type PromptVariableOption = {
  key: string;
  label: string;
  exampleValue: string;
  sourceType: "PAGE_FIELD" | "CONTEXT" | "INTERFACE_FIELD";
};

export type OperandSide = "left" | "right";

export type PreprocessorDraft = {
  id: string;
  preprocessorId?: number;
  params: string;
};

export type ListLookupMatcherDraft = {
  id: string;
  matchColumn: string;
  sourceType: RuleLookupSourceType;
  sourceValue: string;
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
  listDataId?: number;
  listDataName?: string;
  matchColumn?: string;
  lookupSourceType?: RuleLookupSourceType;
  lookupSourceValue?: string;
  listMatchers: ListLookupMatcherDraft[];
  resultField?: string;
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
  validationConfig: ApiInputValidationConfig;
  valueType: RuleOperandValueType;
};

export type InterfaceInputSourceType = "PAGE_FIELD" | "CONTEXT" | "INTERFACE_FIELD" | "CONST";

export type InterfaceInputBindingDraft = {
  sourceType: InterfaceInputSourceType;
  sourceValue: string;
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
  { label: "名单字段", value: "LIST_LOOKUP_FIELD" },
  { label: "上下文变量", value: "CONTEXT" },
  { label: "固定值", value: "CONST" }
];

export const listLookupSourceOptions: Array<{ label: string; value: RuleLookupSourceType }> = [
  { label: "页面字段", value: "PAGE_FIELD" },
  { label: "API字段", value: "INTERFACE_FIELD" },
  { label: "上下文变量", value: "CONTEXT" },
  { label: "固定值", value: "CONST" }
];

export const interfaceInputSourceOptions: Array<{ label: string; value: InterfaceInputSourceType }> = [
  { label: "页面字段", value: "PAGE_FIELD" },
  { label: "上下文变量", value: "CONTEXT" },
  { label: "接口输出", value: "INTERFACE_FIELD" },
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
  group: "公共字段" | "页面特有字段";
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
    label: "页面字段",
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
  LIST_LOOKUP_FIELD: {
    label: "名单字段",
    color: "var(--cc-source-list, #7A00E6)",
    bg: "var(--cc-source-list-bg, #F4EBFF)",
    border: "var(--cc-source-list-border, #D9B8FF)"
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

export function defaultInterfaceInputBinding(
  patch?: Partial<InterfaceInputBindingDraft> | null
): InterfaceInputBindingDraft {
  return {
    sourceType:
      patch?.sourceType === "CONTEXT" ||
      patch?.sourceType === "INTERFACE_FIELD" ||
      patch?.sourceType === "CONST"
        ? patch.sourceType
        : "PAGE_FIELD",
    sourceValue: patch?.sourceValue ?? ""
  };
}

export function parseInterfaceInputConfig(raw: string): Record<string, InterfaceInputBindingDraft> {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw, {});
  const result: Record<string, InterfaceInputBindingDraft> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }

    if (typeof value === "string") {
      const sourceValue = value.trim();
      if (!sourceValue) {
        continue;
      }
      result[normalizedKey] = {
        sourceType: "PAGE_FIELD",
        sourceValue
      };
      continue;
    }

    if (!value || typeof value !== "object") {
      continue;
    }

    const row = value as Partial<InterfaceInputBindingDraft>;
    const normalized = defaultInterfaceInputBinding(row);
    if (!normalized.sourceValue.trim()) {
      continue;
    }
    result[normalizedKey] = normalized;
  }
  return result;
}

export function stringifyInterfaceInputConfig(config: Record<string, InterfaceInputBindingDraft>) {
  const normalized = Object.entries(config)
    .map(([key, value]) => [key.trim(), defaultInterfaceInputBinding(value)] as const)
    .filter(([key, value]) => key && value.sourceValue.trim())
    .reduce<Record<string, InterfaceInputBindingDraft>>((acc, [key, value]) => {
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
      const legacyRequired = typeof row.required === "boolean" ? row.required : false;
      const rawValidation = row.validationConfig;
      const validationConfig = rawValidation && typeof rawValidation === "object"
        ? (rawValidation as Partial<ApiInputValidationConfig>)
        : {};

      rows.push({
        tab,
        name: typeof row.name === "string" ? row.name : "",
        description: typeof row.description === "string" ? row.description : "",
        validationConfig: {
          required: Boolean(validationConfig.required ?? legacyRequired),
          regexMode:
            validationConfig.regexMode === "TEMPLATE" || validationConfig.regexMode === "CUSTOM"
              ? validationConfig.regexMode
              : "NONE",
          regexTemplateKey: validationConfig.regexTemplateKey,
          regexPattern: validationConfig.regexPattern ?? "",
          regexErrorMessage: validationConfig.regexErrorMessage ?? ""
        },
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

export function buildListLookupMatcherId() {
  return `lookup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function buildDefaultListLookupMatcher(): ListLookupMatcherDraft {
  return {
    id: buildListLookupMatcherId(),
    matchColumn: "",
    sourceType: "PAGE_FIELD",
    sourceValue: ""
  };
}

export function buildDefaultOperand(sourceType: RuleOperandSourceType = "PAGE_FIELD"): OperandDraft {
  return {
    sourceType,
    valueType: "STRING",
    displayValue: "",
    machineKey: "",
    interfaceInputConfig: "",
    lookupSourceType: "PAGE_FIELD",
    listMatchers: sourceType === "LIST_LOOKUP_FIELD" ? [buildDefaultListLookupMatcher()] : [],
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
  if (value === "INTERFACE_FIELD" || value === "LIST_LOOKUP_FIELD" || value === "CONST" || value === "CONTEXT") {
    return value;
  }
  return "PAGE_FIELD";
}

export function normalizeLookupSourceType(value: string | undefined): RuleLookupSourceType {
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
    listDataId: operand.listBinding?.listDataId,
    listDataName: operand.listBinding?.listDataName,
    matchColumn: operand.listBinding?.matchColumn,
    lookupSourceType: operand.listBinding?.lookupSourceType ?? "PAGE_FIELD",
    lookupSourceValue: operand.listBinding?.lookupSourceValue ?? "",
    listMatchers:
      operand.listBinding?.matchers && operand.listBinding.matchers.length > 0
        ? operand.listBinding.matchers.map((item) => ({
            id: buildListLookupMatcherId(),
            matchColumn: item.matchColumn,
            sourceType: item.sourceType,
            sourceValue: item.sourceValue
          }))
        : operand.listBinding?.matchColumn
          ? [
              {
                id: buildListLookupMatcherId(),
                matchColumn: operand.listBinding.matchColumn,
                sourceType: operand.listBinding.lookupSourceType ?? "PAGE_FIELD",
                sourceValue: operand.listBinding.lookupSourceValue ?? ""
              }
            ]
          : operand.sourceType === "LIST_LOOKUP_FIELD"
            ? [buildDefaultListLookupMatcher()]
            : [],
    resultField: operand.listBinding?.resultField ?? "",
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
      operand.listDataId ||
      operand.listDataName?.trim() ||
      operand.matchColumn?.trim() ||
      operand.lookupSourceValue?.trim() ||
      operand.listMatchers.some((item) => item.matchColumn.trim() || item.sourceValue.trim()) ||
      operand.resultField?.trim() ||
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
    lookupSourceType: "PAGE_FIELD",
    listMatchers: sourceType === "LIST_LOOKUP_FIELD" ? [buildDefaultListLookupMatcher()] : [],
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
  if (operand.sourceType === "LIST_LOOKUP_FIELD") {
    const listName = operand.listDataName?.trim() || "名单";
    const resultField = operand.resultField?.trim();
    const warning = !operand.listDataId || !resultField;
    const matcherCount = operand.listMatchers.filter((item) => item.matchColumn.trim()).length;
    return {
      visual,
      warning,
      mainText: `${listName}.${resultField || "(未绑定输出字段)"}`,
      subText: matcherCount > 0 ? `检索键 ${matcherCount} 个` : "未配置检索键"
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
  if (draft.sourceType === "LIST_LOOKUP_FIELD") {
    const listName = draft.listDataName?.trim() || "名单";
    const resultField = draft.resultField?.trim();
    const lookupSourceValue = draft.lookupSourceValue?.trim() || "";
    const fallbackMatchColumn = draft.matchColumn?.trim();
    const matchers = draft.listMatchers
      .map((item) => ({
        matchColumn: item.matchColumn.trim(),
        sourceType: item.sourceType,
        sourceValue: item.sourceValue.trim()
      }))
      .filter((item) => item.matchColumn && item.sourceValue);
    const primaryMatcher = matchers[0];
    const displayValue = `${listName}.${resultField || "(未绑定输出字段)"}`;
    const machineKey = resultField || draft.machineKey.trim() || "list_result";
    return {
      sourceType: draft.sourceType,
      key: machineKey,
      preprocessorIds: selectedPreprocessors.map((item) => item.preprocessorId as number),
      valueType: draft.valueType,
      displayValue,
      listBinding: {
        listDataId: draft.listDataId,
        listDataName: listName,
        matchColumn: primaryMatcher?.matchColumn ?? fallbackMatchColumn ?? undefined,
        lookupSourceType: primaryMatcher?.sourceType ?? draft.lookupSourceType ?? "PAGE_FIELD",
        lookupSourceValue: primaryMatcher?.sourceValue ?? lookupSourceValue,
        matchers,
        resultField
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

