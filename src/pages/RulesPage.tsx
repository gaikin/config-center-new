import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import { workflowService } from "../services/workflowService";
import { getRightOverlayDrawerWidth } from "../utils";
import type {
  InterfaceDefinition,
  JobSceneDefinition,
  LifecycleState,
  PageResource,
  PreprocessorDefinition,
  PromptCloseMode,
  PromptMode,
  RuleCondition,
  RuleConditionGroup,
  RuleDefinition,
  RuleLogicType,
  RuleOperand,
  RuleOperandSourceType,
  RuleOperandValueType,
  RuleOperator
} from "../types";

type RuleForm = {
  name: string;
  pageResourceId: number;
  priority: number;
  promptMode: PromptMode;
  closeMode: PromptCloseMode;
  closeTimeoutSec?: number;
  hasConfirmButton: boolean;
  sceneId?: number;
  status: LifecycleState;
  ownerOrgId: string;
};

type OperandSide = "left" | "right";

type PreprocessorDraft = {
  id: string;
  preprocessorId?: number;
  params: string;
};

type OperandDraft = {
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

type FlatConditionDraft = {
  id: string;
  operator: RuleOperator;
  left: OperandDraft;
  right: OperandDraft;
};

type SelectedOperand = {
  conditionId: string;
  side: OperandSide;
};

type InterfaceInputParamDraft = {
  tab: "headers" | "query" | "path" | "body";
  name: string;
  description: string;
  required: boolean;
  sourceType: "CONST" | "PAGE_ELEMENT" | "API_OUTPUT" | "CONTEXT";
  sourceValue: string;
  valueType: RuleOperandValueType;
};

const OPERAND_PILL_WIDTH = 320;
const LOGIC_OPERATOR_WIDTH = 92;

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

const closeModeLabel: Record<PromptCloseMode, string> = {
  AUTO_CLOSE: "自动关闭",
  MANUAL_CLOSE: "手动关闭",
  TIMER_THEN_MANUAL: "超时后关闭"
};

const sourceOptions: Array<{ label: string; value: RuleOperandSourceType }> = [
  { label: "页面字段", value: "PAGE_FIELD" },
  { label: "API字段", value: "INTERFACE_FIELD" },
  { label: "上下文变量", value: "CONTEXT" },
  { label: "固定值", value: "CONST" }
];

const valueTypeOptions: Array<{ label: string; value: RuleOperandValueType }> = [
  { label: "字符串", value: "STRING" },
  { label: "数字", value: "NUMBER" },
  { label: "布尔", value: "BOOLEAN" },
  { label: "对象", value: "OBJECT" },
  { label: "数组", value: "ARRAY" }
];

const operatorOptions: Array<{ value: RuleOperator; label: string }> = [
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

const pageFieldOptions = ["customer_id", "id_no", "mobile", "risk_score", "risk_level"];
const contextOptions = ["org_id", "operator_role", "channel", "user_role"];

const sourceVisualMap: Record<RuleOperandSourceType, { label: string; color: string; bg: string; border: string }> = {
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

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeOperandValueType(value: unknown): RuleOperandValueType {
  if (value === "NUMBER" || value === "BOOLEAN" || value === "OBJECT" || value === "ARRAY") {
    return value;
  }
  return "STRING";
}

function parseInterfaceInputConfig(raw: string) {
  return parseJsonSafe<Record<string, string>>(raw, {});
}

function stringifyInterfaceInputConfig(config: Record<string, string>) {
  const normalized = Object.entries(config)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key && value)
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : "";
}

function collectOutputPathMeta(
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

function collectInterfaceInputParams(target: InterfaceDefinition | undefined): InterfaceInputParamDraft[] {
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

function buildConditionId() {
  return `condition-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function buildPreprocessorId() {
  return `pre-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function buildDefaultOperand(sourceType: RuleOperandSourceType = "PAGE_FIELD"): OperandDraft {
  return {
    sourceType,
    valueType: "STRING",
    displayValue: "",
    machineKey: "",
    interfaceInputConfig: "",
    preprocessors: []
  };
}

function buildDefaultCondition(): FlatConditionDraft {
  return {
    id: buildConditionId(),
    operator: "EQ",
    left: buildDefaultOperand("PAGE_FIELD"),
    right: buildDefaultOperand("CONST")
  };
}

function normalizeSourceType(value: string | undefined): RuleOperandSourceType {
  if (value === "INTERFACE_FIELD" || value === "CONST" || value === "CONTEXT") {
    return value;
  }
  return "PAGE_FIELD";
}

function normalizeOperator(value: string | undefined): RuleOperator {
  const allowed: RuleOperator[] = ["EQ", "NE", "GT", "GE", "LT", "LE", "CONTAINS", "NOT_CONTAINS", "IN", "EXISTS"];
  return allowed.includes(value as RuleOperator) ? (value as RuleOperator) : "EQ";
}

function deriveMachineKeyFromOutputPath(path: string) {
  return path
    .replace(/^\$\./, "")
    .replace(/\[\d+\]/g, "")
    .split(".")
    .filter(Boolean)
    .pop() ?? "";
}
function parseInterfaceLabel(text: string): { interfaceName?: string; outputPath?: string } {
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

function toOperandDraft(operand: RuleOperand | undefined): OperandDraft {
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

function toFlatCondition(condition: RuleCondition): FlatConditionDraft {
  return {
    id: `condition-${condition.id}`,
    operator: condition.operator,
    left: toOperandDraft(condition.left),
    right: toOperandDraft(condition.right)
  };
}

function hasDirtyOperandConfig(operand: OperandDraft) {
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

function resetOperandBySource(sourceType: RuleOperandSourceType, previous: OperandDraft): OperandDraft {
  return {
    sourceType,
    valueType: previous.valueType,
    displayValue: "",
    machineKey: "",
    interfaceInputConfig: "",
    preprocessors: []
  };
}

function resolveOperandSummary(operand: OperandDraft) {
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

function toRuleOperand(draft: OperandDraft): RuleOperand {
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

export function RulesPage() {
  const screens = Grid.useBreakpoint();
  const logicDrawerWidth = getRightOverlayDrawerWidth(Boolean(screens.lg));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RuleDefinition[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [scenes, setScenes] = useState<JobSceneDefinition[]>([]);
  const [preprocessors, setPreprocessors] = useState<PreprocessorDefinition[]>([]);
  const [interfaces, setInterfaces] = useState<InterfaceDefinition[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RuleDefinition | null>(null);
  const [ruleForm] = Form.useForm<RuleForm>();
  const [ruleSnapshot, setRuleSnapshot] = useState("");

  const [logicOpen, setLogicOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<RuleDefinition | null>(null);
  const [globalLogicType, setGlobalLogicType] = useState<RuleLogicType>("AND");
  const [conditionsDraft, setConditionsDraft] = useState<FlatConditionDraft[]>([buildDefaultCondition()]);
  const [selectedOperand, setSelectedOperand] = useState<SelectedOperand | null>(null);
  const [savingQuery, setSavingQuery] = useState(false);
  const [logicSnapshot, setLogicSnapshot] = useState("");

  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const [ruleData, resourceData, sceneData, preprocessorData, interfaceData] = await Promise.all([
        configCenterService.listRules(),
        configCenterService.listPageResources(),
        configCenterService.listJobScenes(),
        configCenterService.listPreprocessors(),
        configCenterService.listInterfaces()
      ]);
      setRows(ruleData);
      setResources(resourceData);
      setScenes(sceneData);
      setPreprocessors(preprocessorData);
      setInterfaces(interfaceData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function buildRuleSnapshot(values: Partial<RuleForm>) {
    return JSON.stringify({
      name: values.name ?? "",
      pageResourceId: values.pageResourceId ?? null,
      priority: values.priority ?? 1,
      promptMode: values.promptMode ?? "FLOATING",
      closeMode: values.closeMode ?? "MANUAL_CLOSE",
      closeTimeoutSec: values.closeTimeoutSec ?? null,
      hasConfirmButton: values.hasConfirmButton ?? true,
      sceneId: values.sceneId ?? null,
      status: values.status ?? "DRAFT",
      ownerOrgId: values.ownerOrgId ?? ""
    });
  }

  function buildLogicSnapshot(nextLogicType: RuleLogicType, nextConditions: FlatConditionDraft[]) {
    return JSON.stringify({
      globalLogicType: nextLogicType,
      conditions: nextConditions
    });
  }

  function closeRuleModalDirectly() {
    setOpen(false);
    setEditing(null);
    setRuleSnapshot("");
  }

  function closeRuleModal() {
    const current = buildRuleSnapshot(ruleForm.getFieldsValue() as Partial<RuleForm>);
    if (ruleSnapshot && current !== ruleSnapshot) {
      Modal.confirm({
        title: "存在未保存修改",
        content: "关闭后将丢失当前规则基础配置，是否继续？",
        okText: "仍然关闭",
        cancelText: "继续编辑",
        onOk: closeRuleModalDirectly
      });
      return;
    }
    closeRuleModalDirectly();
  }

  function closeLogicDrawer() {
    const current = buildLogicSnapshot(globalLogicType, conditionsDraft);
    if (logicSnapshot && current !== logicSnapshot) {
      Modal.confirm({
        title: "条件逻辑尚未保存",
        content: "关闭后将丢失当前条件编辑结果，是否继续？",
        okText: "仍然关闭",
        cancelText: "继续编辑",
        onOk: () => {
          setLogicOpen(false);
          setLogicSnapshot("");
        }
      });
      return;
    }
    setLogicOpen(false);
    setLogicSnapshot("");
  }

  async function loadLogic(ruleId: number) {
    const [groupData, conditionData] = await Promise.all([
      workflowService.listRuleConditionGroups(ruleId),
      workflowService.listRuleConditions(ruleId)
    ]);

    const rootGroup = groupData
      .filter((item) => !item.parentGroupId)
      .sort((a, b) => a.id - b.id)[0];

    setGlobalLogicType(rootGroup?.logicType ?? "AND");

    const nextConditions = conditionData.sort((a, b) => a.id - b.id).map(toFlatCondition);
    const safeConditions = nextConditions.length > 0 ? nextConditions : [buildDefaultCondition()];
    setConditionsDraft(safeConditions);
    setSelectedOperand({ conditionId: safeConditions[0].id, side: "left" });
    setLogicSnapshot(buildLogicSnapshot(rootGroup?.logicType ?? "AND", safeConditions));
  }

  function openCreate() {
    const values: RuleForm = {
      name: "",
      pageResourceId: resources[0]?.id ?? 0,
      priority: 500,
      promptMode: "FLOATING",
      closeMode: "MANUAL_CLOSE",
      closeTimeoutSec: undefined,
      hasConfirmButton: true,
      sceneId: undefined,
      status: "DRAFT",
      ownerOrgId: "branch-east"
    };
    setEditing(null);
    ruleForm.setFieldsValue(values);
    setRuleSnapshot(buildRuleSnapshot(values));
    setOpen(true);
  }

  function openEdit(row: RuleDefinition) {
    const values: RuleForm = {
      name: row.name,
      pageResourceId: row.pageResourceId,
      priority: row.priority,
      promptMode: row.promptMode,
      closeMode: row.closeMode,
      closeTimeoutSec: row.closeTimeoutSec,
      hasConfirmButton: row.hasConfirmButton,
      sceneId: row.sceneId,
      status: row.status,
      ownerOrgId: row.ownerOrgId
    };
    setEditing(row);
    ruleForm.setFieldsValue(values);
    setRuleSnapshot(buildRuleSnapshot(values));
    setOpen(true);
  }

  async function submitRule() {
    const values = await ruleForm.validateFields();
    const resource = resources.find((item) => item.id === values.pageResourceId);
    if (!resource) {
      msgApi.error("请选择页面资源");
      return;
    }

    const scene = scenes.find((item) => item.id === values.sceneId);
    const saved = await configCenterService.upsertRule({
      id: editing?.id ?? Date.now() + Math.floor(Math.random() * 1000),
      name: values.name,
      pageResourceId: values.pageResourceId,
      pageResourceName: resource.name,
      priority: values.priority,
      promptMode: values.promptMode,
      closeMode: values.closeMode,
      closeTimeoutSec: values.closeMode === "TIMER_THEN_MANUAL" ? values.closeTimeoutSec : undefined,
      hasConfirmButton: values.hasConfirmButton,
      sceneId: values.hasConfirmButton ? values.sceneId : undefined,
      sceneName: values.hasConfirmButton ? scene?.name : undefined,
      status: values.status,
      currentVersion: editing?.currentVersion ?? 1,
      ownerOrgId: values.ownerOrgId
    });

    if (!editing) {
      msgApi.success("规则已创建");
    } else if (saved.id !== editing.id) {
      msgApi.success("规则已更新，生效中的规则已自动生成待发布版本");
    } else {
      msgApi.success("规则已更新");
    }

    closeRuleModalDirectly();
    await loadData();
  }

  async function switchStatus(row: RuleDefinition) {
    const next: LifecycleState = row.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await configCenterService.updateRuleStatus(row.id, next);
    msgApi.success(`规则状态已切换为 ${next}`);
    await loadData();
  }

  async function openLogic(row: RuleDefinition) {
    setCurrentRule(row);
    setLogicOpen(true);
    try {
      await loadLogic(row.id);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "条件配置加载失败");
    }
  }

  function updateCondition(conditionId: string, updater: (previous: FlatConditionDraft) => FlatConditionDraft) {
    setConditionsDraft((previous) => previous.map((item) => (item.id === conditionId ? updater(item) : item)));
  }

  function updateOperand(conditionId: string, side: OperandSide, patch: Partial<OperandDraft>) {
    updateCondition(conditionId, (item) => ({
      ...item,
      [side]: { ...item[side], ...patch }
    }));
  }

  function updateSelectedOperand(patch: Partial<OperandDraft>) {
    if (!selectedOperand) {
      return;
    }
    updateOperand(selectedOperand.conditionId, selectedOperand.side, patch);
  }

  function addCondition() {
    const created = buildDefaultCondition();
    setConditionsDraft((previous) => [...previous, created]);
    setSelectedOperand({ conditionId: created.id, side: "left" });
  }

  function removeCondition(conditionId: string) {
    setConditionsDraft((previous) => {
      if (previous.length <= 1) {
        msgApi.warning("至少保留一条条件");
        return previous;
      }
      const next = previous.filter((item) => item.id !== conditionId);
      if (selectedOperand?.conditionId === conditionId) {
        setSelectedOperand(next.length > 0 ? { conditionId: next[0].id, side: "left" } : null);
      }
      return next;
    });
  }

  const selectedContext = useMemo(() => {
    if (!selectedOperand) {
      return null;
    }
    const condition = conditionsDraft.find((item) => item.id === selectedOperand.conditionId);
    if (!condition) {
      return null;
    }
    const operand = condition[selectedOperand.side];
    return {
      condition,
      operand,
      side: selectedOperand.side,
      index: conditionsDraft.findIndex((item) => item.id === selectedOperand.conditionId)
    };
  }, [conditionsDraft, selectedOperand]);

  function changeSelectedSourceType(nextSource: RuleOperandSourceType) {
    if (!selectedContext || selectedContext.operand.sourceType === nextSource) {
      return;
    }

    const applyChange = () => {
      updateOperand(selectedContext.condition.id, selectedContext.side, resetOperandBySource(nextSource, selectedContext.operand));
    };

    if (!hasDirtyOperandConfig(selectedContext.operand)) {
      applyChange();
      return;
    }

    Modal.confirm({
      title: "切换来源将清理旧配置",
      content: "来源切换后将清空当前值、接口入参与预处理器配置，是否继续？",
      okText: "继续切换",
      cancelText: "取消",
      onOk: applyChange
    });
  }

  function addPreprocessorBinding() {
    if (!selectedContext) {
      return;
    }
    const next = [...selectedContext.operand.preprocessors, { id: buildPreprocessorId(), params: "" }];
    updateSelectedOperand({ preprocessors: next });
  }

  function updatePreprocessorBinding(bindingId: string, patch: Partial<PreprocessorDraft>) {
    if (!selectedContext) {
      return;
    }
    const next = selectedContext.operand.preprocessors.map((item) => (item.id === bindingId ? { ...item, ...patch } : item));
    updateSelectedOperand({ preprocessors: next });
  }

  function removePreprocessorBinding(bindingId: string) {
    if (!selectedContext) {
      return;
    }
    const next = selectedContext.operand.preprocessors.filter((item) => item.id !== bindingId);
    updateSelectedOperand({ preprocessors: next });
  }

  function validateOperand(draft: OperandDraft, label: string, conditionIndex: number): string | null {
    const conditionLabel = `Condition ${conditionIndex + 1} ${label}`;

    if (draft.sourceType === "INTERFACE_FIELD") {
      if (!draft.interfaceName?.trim()) {
        return `${conditionLabel}: API is required`;
      }
      if (!draft.outputPath?.trim()) {
        return `${conditionLabel}: API output path is required`;
      }

      const target = interfaces.find((item) => item.id === draft.interfaceId);
      const requiredInputs = collectInterfaceInputParams(target).filter((item) => item.required);
      const inputConfig = parseInterfaceInputConfig(draft.interfaceInputConfig);
      for (const input of requiredInputs) {
        const value = (inputConfig[input.name] ?? input.sourceValue ?? "").trim();
        if (!value) {
          return `${conditionLabel}: required API input missing (${input.name})`;
        }
      }
    } else if (!draft.displayValue.trim()) {
      return `${conditionLabel}: value is required`;
    }

    const invalidPreprocessor = draft.preprocessors.find((item) => typeof item.preprocessorId !== "number");
    if (invalidPreprocessor) {
      return `${conditionLabel}: unresolved preprocessor exists`;
    }

    return null;
  }

  async function saveConditionLogic() {
    if (!currentRule) {
      return;
    }

    for (const [index, condition] of conditionsDraft.entries()) {
      const leftError = validateOperand(condition.left, "left", index);
      if (leftError) {
        msgApi.error(leftError);
        return;
      }

      if (condition.operator !== "EXISTS") {
        const rightError = validateOperand(condition.right, "right", index);
        if (rightError) {
          msgApi.error(rightError);
          return;
        }
      }
    }

    setSavingQuery(true);
    try {
      const currentRuleId = currentRule.id;
      const latestGroups = await workflowService.listRuleConditionGroups(currentRuleId);
      const roots = latestGroups.filter((item) => !item.parentGroupId);
      for (const root of roots) {
        await workflowService.deleteRuleConditionGroup(root.id);
      }

      const rootGroup: RuleConditionGroup = await workflowService.createRuleConditionGroup(currentRuleId, globalLogicType);

      const nextLocalId = (() => {
        let cursor = Date.now();
        return () => {
          cursor += 1;
          return cursor;
        };
      })();

      for (const condition of conditionsDraft) {
        const operator = normalizeOperator(condition.operator);
        const needRight = operator !== "EXISTS";

        await workflowService.upsertRuleCondition({
          id: nextLocalId(),
          ruleId: currentRuleId,
          groupId: rootGroup.id,
          left: toRuleOperand(condition.left),
          operator,
          right: needRight ? toRuleOperand(condition.right) : undefined
        });
      }

      msgApi.success("条件逻辑已保存");
      setLogicSnapshot(buildLogicSnapshot(globalLogicType, conditionsDraft));
      await loadLogic(currentRuleId);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "条件逻辑保存失败");
    } finally {
      setSavingQuery(false);
    }
  }

  function getOutputPathOptions(interfaceId?: number) {
    const target = interfaces.find((item) => item.id === interfaceId);
    if (!target) {
      return [];
    }
    const outputs = parseJsonSafe<unknown[]>(target.outputConfigJson, []);
    return collectOutputPathMeta(outputs)
      .filter((item) => Boolean(item.path))
      .map((item) => ({
        label: `${item.path} (${item.valueType})`,
        value: item.path,
        valueType: item.valueType
      }));
  }

  function getInterfaceInputOptions(interfaceId?: number) {
    const target = interfaces.find((item) => item.id === interfaceId);
    return collectInterfaceInputParams(target);
  }

  function renderOperandPill(conditionId: string, side: OperandSide, operand: OperandDraft) {
    const summary = resolveOperandSummary(operand);
    const selected = selectedOperand?.conditionId === conditionId && selectedOperand.side === side;

    return (
      <button
        type="button"
        onClick={() => setSelectedOperand({ conditionId, side })}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          width: OPERAND_PILL_WIDTH,
          minWidth: OPERAND_PILL_WIDTH,
          maxWidth: OPERAND_PILL_WIDTH,
          borderRadius: 16,
          border: `1px solid ${summary.warning ? "var(--cc-source-warning, #FDA29B)" : summary.visual.border}`,
          background: summary.warning ? "var(--cc-source-warning-bg, #FEF3F2)" : summary.visual.bg,
          color: summary.warning ? "var(--cc-source-warning, #B42318)" : summary.visual.color,
          padding: "5px 10px",
          minHeight: 32,
          cursor: "pointer",
          outline: selected ? "2px solid var(--cc-source-selected, #84CAFF)" : "none"
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{summary.visual.label}</span>
        <span
          style={{
            fontSize: 13,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {summary.mainText}
        </span>
      </button>
    );
  }

  const selectedOutputPathOptions = useMemo(
    () => getOutputPathOptions(selectedContext?.operand.interfaceId),
    [selectedContext?.operand.interfaceId, interfaces]
  );

  const selectedInterfaceInputParams = useMemo(
    () => getInterfaceInputOptions(selectedContext?.operand.interfaceId),
    [selectedContext?.operand.interfaceId, interfaces]
  );

  const selectedInterfaceInputConfig = useMemo(
    () => parseInterfaceInputConfig(selectedContext?.operand.interfaceInputConfig ?? ""),
    [selectedContext?.operand.interfaceInputConfig]
  );

  function updateInterfaceInputValue(paramName: string, value: string) {
    const nextConfig = {
      ...selectedInterfaceInputConfig,
      [paramName]: value
    };
    if (!value.trim()) {
      delete nextConfig[paramName];
    }
    updateSelectedOperand({
      interfaceInputConfig: stringifyInterfaceInputConfig(nextConfig)
    });
  }

  function renderInterfaceInputValueEditor(param: InterfaceInputParamDraft) {
    const value = selectedInterfaceInputConfig[param.name] ?? param.sourceValue ?? "";
    if (param.sourceType === "PAGE_ELEMENT") {
      return (
        <Select
          showSearch
          allowClear
          placeholder="选择页面元素"
          value={value || undefined}
          options={pageFieldOptions.map((item) => ({ label: item, value: item }))}
          onChange={(next) => updateInterfaceInputValue(param.name, (next as string) ?? "")}
        />
      );
    }
    if (param.sourceType === "CONTEXT") {
      return (
        <Select
          showSearch
          allowClear
          placeholder="选择上下文变量"
          value={value || undefined}
          options={contextOptions.map((item) => ({ label: item, value: item }))}
          onChange={(next) => updateInterfaceInputValue(param.name, (next as string) ?? "")}
        />
      );
    }
    return (
      <Input
        value={value}
        placeholder={param.sourceType === "API_OUTPUT" ? "输入API输出路径" : "输入固定值"}
        onChange={(event) => updateInterfaceInputValue(param.name, event.target.value)}
      />
    );
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>智能提示</Typography.Title>
      <Typography.Paragraph type="secondary">
        智能提示主链路：规则配置、条件命中、提示展示、关闭/确认联动。条件编辑区采用左侧条件链路 + 右侧单属性面板。
      </Typography.Paragraph>

      <Card
        extra={
          <Tooltip title="新建规则">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} aria-label="create-rule" />
          </Tooltip>
        }
      >
        <Table<RuleDefinition>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: [6, 10, 20] }}
          columns={[
            { title: "规则名称", dataIndex: "name", width: 200 },
            { title: "页面资源", dataIndex: "pageResourceName", width: 160 },
            { title: "优先级", dataIndex: "priority", width: 90 },
            { title: "提示模式", dataIndex: "promptMode", width: 100 },
            {
              title: "关闭方式",
              width: 200,
              render: (_, row) =>
                row.closeMode === "TIMER_THEN_MANUAL"
                  ? `${closeModeLabel[row.closeMode]}(${row.closeTimeoutSec ?? "-"}秒)`
                  : closeModeLabel[row.closeMode]
            },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag>
            },
            {
              title: "操作",
              width: 360,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>
                    编辑基础
                  </Button>
                  <Button size="small" onClick={() => void openLogic(row)}>
                    条件编辑
                  </Button>
                  <Popconfirm
                    title={row.status === "ACTIVE" ? "确认停用该规则？" : "确认启用该规则？"}
                    onConfirm={() => void switchStatus(row)}
                  >
                    <Button size="small">{row.status === "ACTIVE" ? "停用" : "启用"}</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editing ? "编辑规则" : "新建规则"}
        open={open}
        onCancel={closeRuleModal}
        onOk={() => void submitRule()}
        width={680}
      >
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pageResourceId" label="页面资源" rules={[{ required: true, message: "请选择页面资源" }]}>
            <Select options={resources.map((item) => ({ label: item.name, value: item.id }))} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <InputNumber min={1} max={999} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="promptMode" label="提示模式" rules={[{ required: true }]}>
            <Select options={[{ label: "静默", value: "SILENT" }, { label: "浮窗", value: "FLOATING" }]} />
          </Form.Item>
          <Form.Item name="closeMode" label="关闭方式" rules={[{ required: true }]}>
            <Select options={Object.entries(closeModeLabel).map(([value, label]) => ({ label, value }))} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              ruleForm.getFieldValue("closeMode") === "TIMER_THEN_MANUAL" ? (
                <Form.Item
                  name="closeTimeoutSec"
                  label="关闭超时(秒)"
                  rules={[
                    { required: true, message: "超时后关闭必须填写关闭超时时间" },
                    { type: "number", min: 1, message: "关闭超时时间需大于0" }
                  ]}
                >
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="hasConfirmButton" label="确认按钮">
            <Select options={[{ label: "开启", value: true }, { label: "关闭", value: false }]} />
          </Form.Item>
          <Form.Item name="sceneId" label="关联作业场景">
            <Select allowClear options={scenes.map((scene) => ({ label: scene.name, value: scene.id }))} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={["DRAFT", "ACTIVE", "DISABLED", "EXPIRED"].map((value) => ({ label: value, value }))} />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={currentRule ? `条件编辑: ${currentRule.name}` : "条件编辑"}
        placement="right"
        width={logicDrawerWidth}
        open={logicOpen}
        onClose={closeLogicDrawer}
      >
        <Card
          title="条件配置（单层）"
          extra={
            <Space>
              <Tooltip title="新增条件">
                <Button icon={<PlusOutlined />} onClick={addCondition} />
              </Tooltip>
              <Button type="primary" loading={savingQuery} onClick={() => void saveConditionLogic()}>
                保存条件逻辑
              </Button>
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            message="全部条件共用一个 AND/OR 关系；多提示命中采用串行策略，按优先级依次展示。"
            style={{ marginBottom: 12 }}
          />

          <Space style={{ marginBottom: 12 }}>
            <Typography.Text strong>整体逻辑</Typography.Text>
            <Select
              style={{ width: 180 }}
              value={globalLogicType}
              options={[
                { label: "AND（全部满足）", value: "AND" },
                { label: "OR（满足任一）", value: "OR" }
              ]}
              onChange={(value) => setGlobalLogicType(value as RuleLogicType)}
            />
          </Space>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 12, alignItems: "start" }}>
            <Card size="small" title="条件链路">
              <Space direction="vertical" style={{ width: "100%" }} size={10}>
                {conditionsDraft.map((condition, index) => (
                  <Card
                    key={condition.id}
                    size="small"
                    style={{
                      borderColor:
                        selectedOperand?.conditionId === condition.id ? "var(--cc-source-selected, #84CAFF)" : "#f0f0f0"
                    }}
                    bodyStyle={{ padding: 10 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", width: "100%", minWidth: 0, overflow: "hidden" }}>
                      <Tag color="blue">条件 {index + 1}</Tag>
                      {renderOperandPill(condition.id, "left", condition.left)}
                      <Select
                        style={{ width: LOGIC_OPERATOR_WIDTH, minWidth: LOGIC_OPERATOR_WIDTH, maxWidth: LOGIC_OPERATOR_WIDTH }}
                        value={condition.operator}
                        options={operatorOptions}
                        onChange={(value) =>
                          updateCondition(condition.id, (previous) => ({ ...previous, operator: normalizeOperator(value) }))
                        }
                      />
                      {condition.operator === "EXISTS" ? (
                        <Tag>无需右值</Tag>
                      ) : (
                        renderOperandPill(condition.id, "right", condition.right)
                      )}
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        aria-label="delete-condition"
                        style={{ marginLeft: "auto", flexShrink: 0 }}
                        onClick={() => removeCondition(condition.id)}
                      />
                    </div>
                  </Card>
                ))}
              </Space>
            </Card>

            <Card
              size="small"
              title={
                selectedContext ? `${selectedContext.side === "left" ? "左值" : "右值"}属性面板` : "属性面板"
              }
            >
              {!selectedContext ? (
                <Alert type="info" showIcon message="请先选中左值或右值，再在此面板编辑属性。" />
              ) : (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Alert
                    type="info"
                    showIcon
                    message={`当前编辑：条件 ${selectedContext.index + 1} - ${selectedContext.side === "left" ? "左值" : "右值"}`}
                  />

                  <div>
                    <Typography.Text>来源类型</Typography.Text>
                    <Select
                      style={{ width: "100%", marginTop: 6 }}
                      value={selectedContext.operand.sourceType}
                      options={sourceOptions}
                      onChange={(value) => changeSelectedSourceType(normalizeSourceType(value))}
                    />
                  </div>

                  <div>
                    <Typography.Text>值类型</Typography.Text>
                    {selectedContext.operand.sourceType === "INTERFACE_FIELD" ? (
                      <Input style={{ marginTop: 6 }} value={selectedContext.operand.valueType} readOnly />
                    ) : (
                      <Select
                        style={{ width: "100%", marginTop: 6 }}
                        value={selectedContext.operand.valueType}
                        options={valueTypeOptions}
                        onChange={(value) => updateSelectedOperand({ valueType: value as RuleOperandValueType })}
                      />
                    )}
                  </div>

                  {selectedContext.operand.sourceType === "CONST" ? (
                    <div>
                      <Typography.Text>值</Typography.Text>
                      <Input
                        style={{ marginTop: 6 }}
                        placeholder="请输入固定值"
                        value={selectedContext.operand.displayValue}
                        onChange={(event) =>
                          updateSelectedOperand({
                            displayValue: event.target.value,
                            machineKey: event.target.value
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {selectedContext.operand.sourceType === "PAGE_FIELD" ? (
                    <div>
                      <Typography.Text>值（页面字段）</Typography.Text>
                      <Select
                        showSearch
                        allowClear
                        style={{ width: "100%", marginTop: 6 }}
                        placeholder="请选择页面字段"
                        value={selectedContext.operand.displayValue || undefined}
                        options={pageFieldOptions.map((item) => ({ label: item, value: item }))}
                        onChange={(value) =>
                          updateSelectedOperand({
                            displayValue: (value as string) ?? "",
                            machineKey: (value as string) ?? ""
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {selectedContext.operand.sourceType === "CONTEXT" ? (
                    <div>
                      <Typography.Text>值（上下文变量）</Typography.Text>
                      <Select
                        showSearch
                        allowClear
                        style={{ width: "100%", marginTop: 6 }}
                        placeholder="请选择上下文变量"
                        value={selectedContext.operand.displayValue || undefined}
                        options={contextOptions.map((item) => ({ label: item, value: item }))}
                        onChange={(value) =>
                          updateSelectedOperand({
                            displayValue: (value as string) ?? "",
                            machineKey: (value as string) ?? ""
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {selectedContext.operand.sourceType === "INTERFACE_FIELD" ? (
                    <>
                      <div>
                        <Typography.Text>值（API）</Typography.Text>
                        <Select
                          showSearch
                          allowClear
                          style={{ width: "100%", marginTop: 6 }}
                          placeholder="请选择 API"
                          value={selectedContext.operand.interfaceId}
                          options={interfaces.map((item) => ({ label: item.name, value: item.id }))}
                          onChange={(value) => {
                            const picked = interfaces.find((item) => item.id === value);
                            updateSelectedOperand({
                              interfaceId: value as number | undefined,
                              interfaceName: picked?.name,
                              outputPath: "",
                              machineKey: "",
                              displayValue: "",
                              interfaceInputConfig: "",
                              valueType: "STRING"
                            });
                          }}
                        />
                      </div>

                      <div>
                        <Typography.Text>输出值路径</Typography.Text>
                        <Select
                          showSearch
                          allowClear
                          style={{ width: "100%", marginTop: 6 }}
                          placeholder="请选择API输出路径"
                          value={selectedContext.operand.outputPath || undefined}
                          options={selectedOutputPathOptions}
                          onChange={(value, option) => {
                            const picked = option as { valueType?: RuleOperandValueType } | undefined;
                            const nextPath = (value as string) ?? "";
                            updateSelectedOperand({
                              outputPath: nextPath,
                              machineKey: deriveMachineKeyFromOutputPath(nextPath),
                              valueType: picked?.valueType ?? selectedContext.operand.valueType
                            });
                          }}
                        />
                      </div>

                      <div>
                        <Typography.Text>入参配置（按 API注册定义）</Typography.Text>
                        {selectedInterfaceInputParams.length === 0 ? (
                          <Alert type="info" showIcon style={{ marginTop: 6 }} message="当前API未定义入参或尚未配置。" />
                        ) : (
                          <Table<InterfaceInputParamDraft>
                            size="small"
                            style={{ marginTop: 6 }}
                            rowKey={(row) => `${row.tab}:${row.name}`}
                            pagination={false}
                            dataSource={selectedInterfaceInputParams}
                            columns={[
                              {
                                title: "参数",
                                width: 220,
                                render: (_, row) => (
                                  <Space size={4}>
                                    <Typography.Text>{row.name}</Typography.Text>
                                    {row.required ? <Tag color="error">必填</Tag> : <Tag>可选</Tag>}
                                  </Space>
                                )
                              },
                              {
                                title: "来源",
                                width: 140,
                                render: (_, row) => <Tag>{row.sourceType}</Tag>
                              },
                              {
                                title: "值类型",
                                width: 120,
                                render: (_, row) => <Tag color="blue">{row.valueType}</Tag>
                              },
                              {
                                title: "取值",
                                render: (_, row) => renderInterfaceInputValueEditor(row)
                              }
                            ]}
                          />
                        )}
                      </div>

                      <Alert
                        type={selectedContext.operand.outputPath?.trim() ? "success" : "warning"}
                        showIcon
                        message={`${selectedContext.operand.interfaceName || "API名称"}.${selectedContext.operand.outputPath || "(未绑定输出值)"}`}
                      />
                    </>
                  ) : null}

                  <div>
                    <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                      <Typography.Text>预处理器</Typography.Text>
                      <Tooltip title="添加预处理器">
                        <Button size="small" icon={<PlusOutlined />} onClick={addPreprocessorBinding} />
                      </Tooltip>
                    </Space>

                    {selectedContext.operand.preprocessors.length === 0 ? (
                      <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                        暂无预处理器
                      </Typography.Paragraph>
                    ) : (
                      <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
                        {selectedContext.operand.preprocessors.map((binding) => (
                          <Space key={binding.id} style={{ width: "100%" }} align="start">
                            <Select
                              showSearch
                              allowClear
                              placeholder="选择预处理器"
                              style={{ flex: 1 }}
                              value={binding.preprocessorId}
                              options={preprocessors.map((item) => ({ label: item.name, value: item.id }))}
                              onChange={(value) => updatePreprocessorBinding(binding.id, { preprocessorId: value as number | undefined })}
                            />
                            <Input
                              style={{ flex: 1 }}
                              placeholder="参数（可选）"
                              value={binding.params}
                              onChange={(event) => updatePreprocessorBinding(binding.id, { params: event.target.value })}
                            />
                            <Tooltip title="删除预处理器">
                              <Button danger icon={<DeleteOutlined />} onClick={() => removePreprocessorBinding(binding.id)} />
                            </Tooltip>
                          </Space>
                        ))}
                      </Space>
                    )}
                  </div>
                </Space>
              )}
            </Card>
          </div>
        </Card>
      </Drawer>
    </div>
  );
}
