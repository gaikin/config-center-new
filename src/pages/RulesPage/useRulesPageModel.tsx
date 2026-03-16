import { Form, Grid, Modal, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { configCenterService } from "../../services/configCenterService";
import { workflowService } from "../../services/workflowService";
import { createId, getRightOverlayDrawerWidth } from "../../utils";
import { createFieldIssue, validateRuleDraftPayload } from "../../validation/formRules";
import type {
  BusinessFieldDefinition,
  FieldValidationIssue,
  InterfaceDefinition,
  JobSceneDefinition,
  LifecycleState,
  ListDataDefinition,
  PageFieldBinding,
  PageResource,
  PreprocessorDefinition,
  RuleConditionGroup,
  RuleDefinition,
  RuleLogicType,
  RuleOperandSourceType,
  RuleListLookupCondition,
  SaveValidationReport
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

type PublishNotice = {
  objectLabel: string;
  objectName: string;
  warningCount: number;
};

function cloneListLookupConditions(conditions: RuleDefinition["listLookupConditions"] = []): RuleListLookupCondition[] {
  return conditions.map((item) => ({ ...item }));
}

function buildDefaultListLookupCondition(listDatas: ListDataDefinition[]): RuleListLookupCondition {
  const picked = listDatas[0];
  return {
    id: createId("list-lookup"),
    sourceType: "PAGE_FIELD",
    sourceValue: "",
    listDataId: picked?.id,
    listDataName: picked?.name,
    matchColumn: picked?.importColumns[0] ?? "",
    judgement: "MATCHED"
  };
}

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
  const [listDatas, setListDatas] = useState<ListDataDefinition[]>([]);
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
  const [listLookupDrafts, setListLookupDrafts] = useState<RuleListLookupCondition[]>([]);
  const [selectedOperand, setSelectedOperand] = useState<SelectedOperand | null>(null);
  const [savingQuery, setSavingQuery] = useState(false);
  const [logicSnapshot, setLogicSnapshot] = useState("");
  const [saveValidationReport, setSaveValidationReport] = useState<SaveValidationReport | null>(null);
  const [logicValidationIssues, setLogicValidationIssues] = useState<FieldValidationIssue[]>([]);
  const [publishNotice, setPublishNotice] = useState<PublishNotice | null>(null);
  const hasAutoOpened = useRef(false);
  const [msgApi, holder] = message.useMessage();
  const activeRuleScope = currentRule?.ruleScope ?? watchedRuleScope ?? "PAGE_RESOURCE";
  const activePageResourceId = currentRule?.pageResourceId ?? watchedPageResourceId;
  const watchedRuleValues = Form.useWatch([], ruleForm) as Partial<RuleForm> | undefined;

  async function loadData() {
    setLoading(true);
    try {
      const [ruleData, resourceData, fieldData, sceneData, preprocessorData, interfaceData, listDataRows] = await Promise.all([
        configCenterService.listRules(),
        configCenterService.listPageResources(),
        configCenterService.listBusinessFields(),
        configCenterService.listJobScenes(),
        configCenterService.listPreprocessors(),
        configCenterService.listInterfaces(),
        configCenterService.listListDatas()
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
      setListDatas(listDataRows);
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
      label: `${field.scope === "GLOBAL" ? "公共字段" : "页面字段"} / ${field.name}`,
      value: field.code,
      group: field.scope === "GLOBAL" ? "公共字段" : "页面特有字段"
    }));
  }, [activePageResourceId, activeRuleScope, businessFields, pageFieldBindings]);
  function buildRuleSnapshot(values: Partial<RuleForm>) {
    return JSON.stringify({
      templateRuleId: values.templateRuleId ?? null,
      name: values.name ?? "",
      ruleScope: values.ruleScope ?? (mode === "TEMPLATE" ? "SHARED" : "PAGE_RESOURCE"),
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
  function buildLogicSnapshot(
    nextLogicType: RuleLogicType,
    nextConditions: FlatConditionDraft[],
    nextListLookupConditions: RuleListLookupCondition[]
  ) {
    return JSON.stringify({
      globalLogicType: nextLogicType,
      conditions: nextConditions,
      listLookupConditions: nextListLookupConditions
    });
  }
  function closeRuleModalDirectly() {
    setOpen(false);
    setEditing(null);
    setReuseSourceRule(null);
    setRuleSnapshot("");
    setSaveValidationReport(null);
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
    const current = buildLogicSnapshot(globalLogicType, conditionsDraft, listLookupDrafts);
    if (logicSnapshot && current !== logicSnapshot) {
      Modal.confirm({
        title: "条件逻辑尚未保存",
        content: "关闭后将丢失当前条件编辑结果，是否继续？",
        okText: "仍然关闭",
        cancelText: "继续编辑",
        onOk: () => {
          setLogicOpen(false);
          setLogicSnapshot("");
          setLogicValidationIssues([]);
        }
      });
      return;
    }
    setLogicOpen(false);
    setLogicSnapshot("");
    setLogicValidationIssues([]);
  }
  async function loadLogic(rule: RuleDefinition) {
    const [groupData, conditionData] = await Promise.all([
      workflowService.listRuleConditionGroups(rule.id),
      workflowService.listRuleConditions(rule.id)
    ]);
    const rootGroup = groupData
      .filter((item) => !item.parentGroupId)
      .sort((a, b) => a.id - b.id)[0];
    setGlobalLogicType(rootGroup?.logicType ?? "AND");
    const nextConditions = conditionData.sort((a, b) => a.id - b.id).map(toFlatCondition);
    const safeConditions = nextConditions.length > 0 ? nextConditions : [buildDefaultCondition()];
    const nextListLookupConditions = cloneListLookupConditions(rule.listLookupConditions);
    setConditionsDraft(safeConditions);
    setListLookupDrafts(nextListLookupConditions);
    setSelectedOperand({ conditionId: safeConditions[0].id, side: "left" });
    setLogicSnapshot(buildLogicSnapshot(rootGroup?.logicType ?? "AND", safeConditions, nextListLookupConditions));
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
    setPublishNotice(null);
    ruleForm.setFieldsValue(values);
    setRuleSnapshot(buildRuleSnapshot(values));
    setSaveValidationReport(null);
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
    setPublishNotice(null);
    ruleForm.setFieldsValue(values);
    setRuleSnapshot(buildRuleSnapshot(values));
    setSaveValidationReport(null);
    setOpen(true);
  }
  const liveSaveValidationReport = useMemo(() => {
    if (!open) {
      return null;
    }
    const values = watchedRuleValues ?? {};
    const effectiveScope = mode === "TEMPLATE" ? "SHARED" : values.ruleScope ?? "PAGE_RESOURCE";
    return validateRuleDraftPayload(
      {
        id: editing?.id ?? -1,
        name: values.name ?? "",
        ruleScope: effectiveScope,
        pageResourceId: effectiveScope === "PAGE_RESOURCE" ? values.pageResourceId : undefined,
        priority: values.priority ?? 1,
        promptMode: values.promptMode ?? "FLOATING",
        closeMode: values.closeMode ?? "MANUAL_CLOSE",
        closeTimeoutSec: values.closeTimeoutSec,
        hasConfirmButton: values.hasConfirmButton ?? true,
        sceneId: values.sceneId,
        ownerOrgId: values.ownerOrgId ?? ""
      },
      rows
    );
  }, [editing?.id, mode, open, rows, watchedRuleValues]);
  const activeSaveValidationReport = liveSaveValidationReport ?? saveValidationReport;
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
    const result = await configCenterService.saveRuleDraft({
      id: editing?.id ?? Date.now() + Math.floor(Math.random() * 1000),
      name: values.name,
      ruleScope: effectiveScope,
      ruleSetCode: editing?.ruleSetCode ?? createId(mode === "TEMPLATE" ? "rule-template" : "rule"),
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
    setSaveValidationReport(result.report);
    if (!result.success || !result.data) {
      msgApi.error(result.report.summary);
      return;
    }
    const saved = result.data;
    const savedObjectLabel = isTemplateMode(mode) ? "模板" : "规则";
    const savedMessage =
      result.report.warningCount > 0
        ? `${savedObjectLabel}已保存草稿，另有 ${result.report.warningCount} 个待处理项`
        : mode === "PAGE_RULE" && !editing && reuseSourceRule
          ? "规则模板已复用为页面规则，并已进入待发布列表"
          : !editing
            ? `${savedObjectLabel}已创建，并已进入待发布列表`
            : saved.id !== editing.id
              ? `${savedObjectLabel}已更新，已自动生成待发布版本`
              : `${savedObjectLabel}已更新`;
    if (mode === "PAGE_RULE" && !editing && reuseSourceRule) {
      await workflowService.cloneRuleLogic(reuseSourceRule.id, saved.id);
    }
    msgApi.success(savedMessage);
    setPublishNotice({
      objectLabel: savedObjectLabel,
      objectName: saved.name,
      warningCount: result.report.warningCount
    });
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
    setLogicValidationIssues([]);
    try {
      await loadLogic(row);
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
  function addListLookupCondition() {
    setListLookupDrafts((previous) => [...previous, buildDefaultListLookupCondition(listDatas)]);
  }
  function updateListLookupCondition(
    conditionId: string,
    patch: Partial<RuleListLookupCondition> | ((previous: RuleListLookupCondition) => RuleListLookupCondition)
  ) {
    setListLookupDrafts((previous) =>
      previous.map((item) => {
        if (item.id !== conditionId) {
          return item;
        }
        return typeof patch === "function" ? patch(item) : { ...item, ...patch };
      })
    );
  }
  function removeListLookupCondition(conditionId: string) {
    setListLookupDrafts((previous) => previous.filter((item) => item.id !== conditionId));
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
  function validateOperand(draft: OperandDraft, label: string, conditionIndex: number): FieldValidationIssue[] {
    const issues: FieldValidationIssue[] = [];
    const fieldLabel = `条件 ${conditionIndex + 1}${label === "left" ? " 左值" : " 右值"}`;
    if (draft.sourceType === "INTERFACE_FIELD") {
      if (!draft.interfaceName?.trim()) {
        issues.push(
          createFieldIssue({
            section: "logic",
            field: `${conditionIndex}:${label}:interfaceName`,
            label: fieldLabel,
            message: "请选择 API 来源"
          })
        );
      }
      if (!draft.outputPath?.trim()) {
        issues.push(
          createFieldIssue({
            section: "logic",
            field: `${conditionIndex}:${label}:outputPath`,
            label: fieldLabel,
            message: "请选择 API 输出路径"
          })
        );
      }
      const target = interfaces.find((item) => item.id === draft.interfaceId);
      const requiredInputs = collectInterfaceInputParams(target).filter((item) => item.required);
      const inputConfig = parseInterfaceInputConfig(draft.interfaceInputConfig);
      for (const input of requiredInputs) {
        const value = (inputConfig[input.name] ?? input.sourceValue ?? "").trim();
        if (!value) {
          issues.push(
            createFieldIssue({
              section: "logic",
              field: `${conditionIndex}:${label}:input:${input.name}`,
              label: fieldLabel,
              message: `缺少必填 API 入参：${input.name}`
            })
          );
        }
      }
    } else if (draft.sourceType === "LIST_LOOKUP_FIELD") {
      if (!draft.listDataId) {
        issues.push(
          createFieldIssue({
            section: "logic",
            field: `${conditionIndex}:${label}:listDataId`,
            label: fieldLabel,
            message: "请选择名单数据"
          })
        );
      }
      if (!listDatas.some((item) => item.id === draft.listDataId)) {
        issues.push(
          createFieldIssue({
            section: "logic",
            field: `${conditionIndex}:${label}:listDataId`,
            label: fieldLabel,
            message: "所选名单不存在"
          })
        );
      }
      const validMatchers = draft.listMatchers.filter((item) => item.matchColumn.trim() && item.sourceValue.trim());
      if (validMatchers.length === 0) {
        issues.push(
          createFieldIssue({
            section: "logic",
            field: `${conditionIndex}:${label}:listMatchers`,
            label: fieldLabel,
            message: "请至少配置一个检索键"
          })
        );
      }
      for (const [matcherIndex, matcher] of draft.listMatchers.entries()) {
        if (!matcher.matchColumn.trim() && !matcher.sourceValue.trim()) {
          continue;
        }
        if (!matcher.matchColumn.trim()) {
          issues.push(
            createFieldIssue({
              section: "logic",
              field: `${conditionIndex}:${label}:matcher:${matcherIndex}:matchColumn`,
              label: fieldLabel,
              message: `检索键 ${matcherIndex + 1} 缺少匹配列`
            })
          );
        }
        if (!matcher.sourceValue.trim()) {
          issues.push(
            createFieldIssue({
              section: "logic",
              field: `${conditionIndex}:${label}:matcher:${matcherIndex}:sourceValue`,
              label: fieldLabel,
              message: `检索键 ${matcherIndex + 1} 缺少取值来源`
            })
          );
        }
      }
      if (!draft.resultField?.trim()) {
        issues.push(
          createFieldIssue({
            section: "logic",
            field: `${conditionIndex}:${label}:resultField`,
            label: fieldLabel,
            message: "请选择输出字段"
          })
        );
      }
      const pickedList = listDatas.find((item) => item.id === draft.listDataId);
      if (pickedList && draft.resultField?.trim() && !pickedList.outputFields.includes(draft.resultField.trim())) {
        issues.push(
          createFieldIssue({
            section: "logic",
            field: `${conditionIndex}:${label}:resultField`,
            label: fieldLabel,
            message: "输出字段必须从名单输出字段中选择"
          })
        );
      }
    } else if (!draft.displayValue.trim()) {
      issues.push(
        createFieldIssue({
          section: "logic",
          field: `${conditionIndex}:${label}:displayValue`,
          label: fieldLabel,
          message: "请输入比较值"
        })
      );
    }
    const invalidPreprocessor = draft.preprocessors.find((item) => typeof item.preprocessorId !== "number");
    if (invalidPreprocessor) {
      issues.push(
        createFieldIssue({
          section: "logic",
          field: `${conditionIndex}:${label}:preprocessor`,
          label: fieldLabel,
          message: "存在未完成选择的数据转换规则"
        })
      );
    }
    return issues;
  }
  async function saveConditionLogic() {
    if (!currentRule) {
      return;
    }
    const nextIssues: FieldValidationIssue[] = [];
    for (const [index, condition] of conditionsDraft.entries()) {
      nextIssues.push(...validateOperand(condition.left, "left", index));
      if (condition.operator !== "EXISTS") {
        nextIssues.push(...validateOperand(condition.right, "right", index));
      }
    }
    setLogicValidationIssues(nextIssues);
    if (nextIssues.some((issue) => issue.level === "blocking")) {
      msgApi.error("高级条件存在未处理问题，请先修复后再保存");
      return;
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
      setLogicValidationIssues([]);
      setLogicSnapshot(buildLogicSnapshot(globalLogicType, conditionsDraft, listLookupDrafts));
      await loadLogic(currentRule);
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
  const selectedOperandIssues = useMemo(() => {
    if (!selectedContext) {
      return [] as FieldValidationIssue[];
    }
    return validateOperand(selectedContext.operand, selectedContext.side, selectedContext.index);
  }, [interfaces, selectedContext]);
  const wizardStepIssues = useMemo(() => {
    const allIssues = activeSaveValidationReport
      ? [...activeSaveValidationReport.fieldIssues, ...activeSaveValidationReport.sectionIssues, ...activeSaveValidationReport.objectIssues]
      : [];
    return {
      0: allIssues.filter((issue) => issue.section === "page").length,
      1: allIssues.filter((issue) => issue.section === "basic").length,
      2: logicValidationIssues.length,
      3: allIssues.filter((issue) => issue.section === "confirm").length
    };
  }, [activeSaveValidationReport, logicValidationIssues]);
  return {
    mode, holder, logicDrawerWidth, loading,
    rows: mode === "TEMPLATE" ? templateRows : pageRuleRows,
    templates: templateRows,
    resources, scenes, preprocessors, interfaces, listDatas,
    open, editing, ruleForm, logicOpen, currentRule, globalLogicType, setGlobalLogicType,
    pageFieldOptions,
    conditionsDraft, listLookupDrafts, selectedOperand, setSelectedOperand, savingQuery,
    closeRuleModal, closeLogicDrawer, openCreate, applyTemplate, openEdit, submitRule, switchStatus, openLogic,
    addCondition, removeCondition, addListLookupCondition, updateListLookupCondition, removeListLookupCondition,
    selectedContext, changeSelectedSourceType,
    addPreprocessorBinding, updatePreprocessorBinding, removePreprocessorBinding,
    saveConditionLogic, selectedOutputPathOptions, selectedInterfaceInputParams,
    selectedInterfaceInputConfig, updateInterfaceInputValue,
    updateCondition, updateSelectedOperand, statusColor, operatorOptions, sourceOptions, valueTypeOptions,
    saveValidationReport: activeSaveValidationReport,
    logicValidationIssues,
    selectedOperandIssues,
    hasSelectedOperandDirtyConfig: Boolean(selectedContext && hasDirtyOperandConfig(selectedContext.operand)),
    wizardStepIssues,
    publishNotice,
    dismissPublishNotice: () => setPublishNotice(null)
  };
}

function isTemplateMode(mode: RulesPageMode) {
  return mode === "TEMPLATE";
}
