import { Form, Grid, Modal, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { configCenterService } from "../../services/configCenterService";
import { workflowService } from "../../services/workflowService";
import { getRightOverlayDrawerWidth } from "../../utils";
import type {
  BusinessFieldDefinition,
  InterfaceDefinition,
  JobSceneDefinition,
  LifecycleState,
  PageFieldBinding,
  PageResource,
  PreprocessorDefinition,
  RuleConditionGroup,
  RuleDefinition,
  RuleLogicType,
  RuleOperandSourceType
} from "../../types";
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
  RulePageFieldOption,
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

export type RulesPageMode = "PAGE_RULE" | "TEMPLATE";

type RulesPageOptions = {
  initialPageResourceId?: number;
  initialTemplateRuleId?: number;
  initialSceneId?: number;
  autoOpenCreate?: boolean;
};

export function useRulesPageModel(mode: RulesPageMode = "PAGE_RULE", options: RulesPageOptions = {}) {
  const screens = Grid.useBreakpoint();
  const logicDrawerWidth = getRightOverlayDrawerWidth(Boolean(screens.lg));
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RuleDefinition[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [businessFields, setBusinessFields] = useState<BusinessFieldDefinition[]>([]);
  const [pageFieldBindings, setPageFieldBindings] = useState<PageFieldBinding[]>([]);
  const [scenes, setScenes] = useState<JobSceneDefinition[]>([]);
  const [preprocessors, setPreprocessors] = useState<PreprocessorDefinition[]>([]);
  const [interfaces, setInterfaces] = useState<InterfaceDefinition[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RuleDefinition | null>(null);
  const [reuseSourceRule, setReuseSourceRule] = useState<RuleDefinition | null>(null);
  const [ruleForm] = Form.useForm<RuleForm>();
  const watchedRuleScope = Form.useWatch("ruleScope", ruleForm);
  const watchedPageResourceId = Form.useWatch("pageResourceId", ruleForm);
  const [ruleSnapshot, setRuleSnapshot] = useState("");
  const [logicOpen, setLogicOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<RuleDefinition | null>(null);
  const [globalLogicType, setGlobalLogicType] = useState<RuleLogicType>("AND");
  const [conditionsDraft, setConditionsDraft] = useState<FlatConditionDraft[]>([buildDefaultCondition()]);
  const [selectedOperand, setSelectedOperand] = useState<SelectedOperand | null>(null);
  const [savingQuery, setSavingQuery] = useState(false);
  const [logicSnapshot, setLogicSnapshot] = useState("");
  const hasAutoOpened = useRef(false);
  const [msgApi, holder] = message.useMessage();
  const activeRuleScope = currentRule?.ruleScope ?? watchedRuleScope ?? "PAGE_RESOURCE";
  const activePageResourceId = currentRule?.pageResourceId ?? watchedPageResourceId;

  async function loadData() {
    setLoading(true);
    try {
      const [ruleData, resourceData, fieldData, sceneData, preprocessorData, interfaceData] = await Promise.all([
        configCenterService.listRules(),
        configCenterService.listPageResources(),
        configCenterService.listBusinessFields(),
        configCenterService.listJobScenes(),
        configCenterService.listPreprocessors(),
        configCenterService.listInterfaces()
      ]);
      const bindingData = (await Promise.all(
        resourceData.map((resource) => configCenterService.listPageFieldBindings(resource.id))
      )).flat();
      setRows(ruleData);
      setResources(resourceData);
      setBusinessFields(fieldData);
      setPageFieldBindings(bindingData);
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
  const templateRows = useMemo(
    () => rows.filter((row) => row.ruleScope === "SHARED"),
    [rows]
  );
  const pageRuleRows = useMemo(
    () => rows.filter((row) => row.ruleScope === "PAGE_RESOURCE"),
    [rows]
  );
  const pageFieldOptions = useMemo<RulePageFieldOption[]>(() => {
    const boundFieldCodes =
      activeRuleScope === "PAGE_RESOURCE" && typeof activePageResourceId === "number"
        ? new Set(
            pageFieldBindings
              .filter((binding) => binding.pageResourceId === activePageResourceId)
              .map((binding) => binding.businessFieldCode)
          )
        : null;

    const fields = businessFields.filter((field) => {
      if (activeRuleScope === "SHARED") {
        return field.scope === "GLOBAL";
      }
      if (typeof activePageResourceId !== "number") {
        return field.scope === "GLOBAL";
      }
      if (!boundFieldCodes?.has(field.code)) {
        return false;
      }
      return field.scope === "GLOBAL" || field.pageResourceId === activePageResourceId;
    });

    return fields.map((field) => ({
      label: `${field.scope === "GLOBAL" ? "公共字段" : "页面特有字段"} / ${field.name} (${field.code})`,
      value: field.code,
      group: field.scope === "GLOBAL" ? "公共字段" : "页面特有字段"
    }));
  }, [activePageResourceId, activeRuleScope, businessFields, pageFieldBindings]);
  function buildRuleSnapshot(values: Partial<RuleForm>) {
    return JSON.stringify({
      templateRuleId: values.templateRuleId ?? null,
      name: values.name ?? "",
      ruleScope: values.ruleScope ?? (mode === "TEMPLATE" ? "SHARED" : "PAGE_RESOURCE"),
      ruleSetCode: values.ruleSetCode ?? "",
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
    setReuseSourceRule(null);
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
    const presetPageId =
      typeof options.initialPageResourceId === "number" &&
      resources.some((item) => item.id === options.initialPageResourceId)
        ? options.initialPageResourceId
        : resources[0]?.id;
    const presetTemplate =
      mode === "PAGE_RULE" &&
      typeof options.initialTemplateRuleId === "number" &&
      templateRows.some((item) => item.id === options.initialTemplateRuleId)
        ? templateRows.find((item) => item.id === options.initialTemplateRuleId) ?? null
        : null;
    const presetSceneId =
      typeof options.initialSceneId === "number" && scenes.some((item) => item.id === options.initialSceneId)
        ? options.initialSceneId
        : undefined;
    const values: RuleForm = {
      templateRuleId: presetTemplate?.id,
      name: presetTemplate ? `${presetTemplate.name}-副本` : "",
      ruleScope: mode === "TEMPLATE" ? "SHARED" : "PAGE_RESOURCE",
      ruleSetCode: presetTemplate?.ruleSetCode ?? "",
      pageResourceId: mode === "TEMPLATE" ? undefined : presetPageId,
      priority: presetTemplate?.priority ?? 500,
      promptMode: presetTemplate?.promptMode ?? "FLOATING",
      closeMode: presetTemplate?.closeMode ?? "MANUAL_CLOSE",
      closeTimeoutSec: presetTemplate?.closeTimeoutSec,
      hasConfirmButton: presetTemplate?.hasConfirmButton ?? true,
      sceneId: presetTemplate?.sceneId ?? presetSceneId,
      status: "DRAFT",
      ownerOrgId: presetTemplate?.ownerOrgId ?? "branch-east"
    };
    setEditing(null);
    setReuseSourceRule(presetTemplate);
    ruleForm.setFieldsValue(values);
    setRuleSnapshot(buildRuleSnapshot(values));
    setOpen(true);
  }
  useEffect(() => {
    if (mode !== "PAGE_RULE" || !options.autoOpenCreate) {
      return;
    }
    if (hasAutoOpened.current || resources.length === 0) {
      return;
    }
    hasAutoOpened.current = true;
    openCreate();
  }, [mode, options.autoOpenCreate, resources.length]);
  function applyTemplate(templateId?: number) {
    const template = templateRows.find((item) => item.id === templateId) ?? null;
    setReuseSourceRule(template);
    if (!template) {
      ruleForm.setFieldValue("templateRuleId", undefined);
      return;
    }
    const currentValues = ruleForm.getFieldsValue();
    ruleForm.setFieldsValue({
      ...currentValues,
      templateRuleId: template.id,
      name: currentValues.name?.trim() ? currentValues.name : `${template.name}-副本`,
      ruleScope: "PAGE_RESOURCE",
      ruleSetCode: template.ruleSetCode,
      priority: template.priority,
      promptMode: template.promptMode,
      closeMode: template.closeMode,
      closeTimeoutSec: template.closeTimeoutSec,
      hasConfirmButton: template.hasConfirmButton,
      sceneId: template.sceneId,
      ownerOrgId: currentValues.ownerOrgId?.trim() ? currentValues.ownerOrgId : template.ownerOrgId
    });
  }
  function openEdit(row: RuleDefinition) {
    const values: RuleForm = {
      templateRuleId: row.sourceRuleId,
      name: row.name,
      ruleScope: row.ruleScope,
      ruleSetCode: row.ruleSetCode,
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
    setReuseSourceRule(null);
    ruleForm.setFieldsValue(values);
    setRuleSnapshot(buildRuleSnapshot(values));
    setOpen(true);
  }
  async function submitRule() {
    const values = await ruleForm.validateFields();
    const effectiveScope = mode === "TEMPLATE" ? "SHARED" : values.ruleScope;
    const resource =
      effectiveScope === "PAGE_RESOURCE"
        ? resources.find((item) => item.id === values.pageResourceId)
        : undefined;
    if (effectiveScope === "PAGE_RESOURCE" && !resource) {
      msgApi.error("请选择页面资源");
      return;
    }
    const scene = scenes.find((item) => item.id === values.sceneId);
    const saved = await configCenterService.upsertRule({
      id: editing?.id ?? Date.now() + Math.floor(Math.random() * 1000),
      name: values.name,
      ruleScope: effectiveScope,
      ruleSetCode: values.ruleSetCode,
      pageResourceId: resource?.id,
      pageResourceName: resource?.name,
      sourceRuleId:
        mode === "PAGE_RULE" ? (!editing ? reuseSourceRule?.id : editing?.sourceRuleId) : undefined,
      sourceRuleName:
        mode === "PAGE_RULE" ? (!editing ? reuseSourceRule?.name : editing?.sourceRuleName) : undefined,
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
    if (mode === "PAGE_RULE" && !editing && reuseSourceRule) {
      await workflowService.cloneRuleLogic(reuseSourceRule.id, saved.id);
      msgApi.success("规则模板已复用为页面规则");
    } else if (!editing) {
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
    mode, holder, logicDrawerWidth, loading,
    rows: mode === "TEMPLATE" ? templateRows : pageRuleRows,
    templates: templateRows,
    resources, scenes, preprocessors, interfaces,
    open, editing, ruleForm, logicOpen, currentRule, globalLogicType, setGlobalLogicType,
    pageFieldOptions,
    conditionsDraft, selectedOperand, setSelectedOperand, savingQuery,
    closeRuleModal, closeLogicDrawer, openCreate, applyTemplate, openEdit, submitRule, switchStatus, openLogic,
    addCondition, removeCondition, selectedContext, changeSelectedSourceType,
    addPreprocessorBinding, updatePreprocessorBinding, removePreprocessorBinding,
    saveConditionLogic, selectedOutputPathOptions, selectedInterfaceInputParams,
    selectedInterfaceInputConfig, updateInterfaceInputValue,
    updateCondition, updateSelectedOperand, statusColor, operatorOptions, sourceOptions, valueTypeOptions
  };
}
