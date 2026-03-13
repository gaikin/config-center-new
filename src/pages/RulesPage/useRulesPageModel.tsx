import { Form, Grid, Modal, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../../services/configCenterService";
import { workflowService } from "../../services/workflowService";
import { getRightOverlayDrawerWidth } from "../../utils";
import type { InterfaceDefinition, JobSceneDefinition, LifecycleState, PageResource, PreprocessorDefinition, RuleConditionGroup, RuleDefinition, RuleLogicType, RuleOperandSourceType } from "../../types";
import type { OperandDraft, OperandSide } from "./rulesPageShared";
import {
  buildDefaultCondition,
  buildPreprocessorId,
  collectInterfaceInputParams,
  collectOutputPathMeta,
  FlatConditionDraft,
  hasDirtyOperandConfig,
  normalizeOperator,
  parseInterfaceInputConfig,
  parseJsonSafe,
  PreprocessorDraft,
  resetOperandBySource,
  RuleForm,
  SelectedOperand,
  stringifyInterfaceInputConfig,
  statusColor,
  toFlatCondition,
  toRuleOperand,
  operatorOptions,
  sourceOptions,
  valueTypeOptions
} from "./rulesPageShared";
export function useRulesPageModel() {
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
  return {
    holder, logicDrawerWidth, loading, rows, resources, scenes, preprocessors, interfaces,
    open, editing, ruleForm, logicOpen, currentRule, globalLogicType, setGlobalLogicType,
    conditionsDraft, selectedOperand, setSelectedOperand, savingQuery,
    closeRuleModal, closeLogicDrawer, openCreate, openEdit, submitRule, switchStatus, openLogic,
    addCondition, removeCondition, selectedContext, changeSelectedSourceType,
    addPreprocessorBinding, updatePreprocessorBinding, removePreprocessorBinding,
    saveConditionLogic, selectedOutputPathOptions, selectedInterfaceInputParams,
    selectedInterfaceInputConfig, updateInterfaceInputValue,
    updateCondition, updateSelectedOperand, statusColor, operatorOptions, sourceOptions, valueTypeOptions
  };
}
