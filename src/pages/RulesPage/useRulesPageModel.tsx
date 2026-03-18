import { Form, Grid, Modal, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { getOrgLabel } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import { workflowService } from "../../services/workflowService";
import { createId, getRightOverlayDrawerWidth } from "../../utils";
import { createFieldIssue, validateRuleDraftPayload } from "../../validation/formRules";
import { parsePromptContentConfig, stringifyPromptContentConfig } from "../../promptContent";
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
import type { InterfaceInputBindingDraft, OperandDraft, OperandSide, PromptVariableOption } from "./rulesPageShared";
import {
  buildDefaultCondition,
  buildPreprocessorId,
  collectInterfaceInputParams,
  collectOutputPathMeta,
  contextOptions,
  defaultInterfaceInputBinding,
  deriveMachineKeyFromOutputPath,
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
  resourceId: number;
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

function toRuleDraftPayload(row: RuleDefinition): RuleDefinition {
  return {
    ...row,
    status: "DRAFT"
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
  const [currentRule, setCurrentRule] = useState<RuleDefinition | null>(null);
  const [logicLoading, setLogicLoading] = useState(false);
  const [globalLogicType, setGlobalLogicType] = useState<RuleLogicType>("AND");
  const [conditionsDraft, setConditionsDraft] = useState<FlatConditionDraft[]>([buildDefaultCondition()]);
  const [listLookupDrafts, setListLookupDrafts] = useState<RuleListLookupCondition[]>([]);
  const [selectedOperand, setSelectedOperand] = useState<SelectedOperand | null>(null);
  const [savingQuery, setSavingQuery] = useState(false);
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
  const promptVariableOptions = useMemo<PromptVariableOption[]>(() => {
    const result: PromptVariableOption[] = [];
    const seenKeys = new Set<string>();
    const exampleValues: Record<string, string> = {
      customer_id: "62220001",
      id_no: "330102199001010011",
      mobile: "13800138000",
      account_purpose: "经营结算",
      collateral_type: "房产抵押",
      org_id: "branch-east",
      operator_role: "客户经理",
      channel: "柜面",
      user_role: "新员工",
      score: "92",
      riskLevel: "高风险",
      name: "张三"
    };

    for (const field of pageFieldOptions) {
      if (seenKeys.has(field.value)) {
        continue;
      }
      seenKeys.add(field.value);
      result.push({
        key: field.value,
        label: field.label.split("/").pop()?.trim() ?? field.value,
        exampleValue: exampleValues[field.value] ?? `${field.label.split("/").pop()?.trim() ?? field.value}示例`,
        sourceType: "PAGE_FIELD"
      });
    }

    for (const item of contextOptions) {
      if (seenKeys.has(item)) {
        continue;
      }
      seenKeys.add(item);
      result.push({
        key: item,
        label: item,
        exampleValue: exampleValues[item] ?? `${item}-示例`,
        sourceType: "CONTEXT"
      });
    }

    const collectInterfaceVariables = (
      outputs: unknown[],
      interfaceName: string
    ) => {
      for (const item of outputs) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const row = item as { name?: unknown; path?: unknown; children?: unknown[] };
        const outputPath = typeof row.path === "string" ? row.path : "";
        const key = deriveMachineKeyFromOutputPath(outputPath);
        const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : key;
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          result.push({
            key,
            label: `API / ${interfaceName} / ${name}`,
            exampleValue: exampleValues[key] ?? `${name}示例`,
            sourceType: "INTERFACE_FIELD"
          });
        }
        if (Array.isArray(row.children)) {
          collectInterfaceVariables(row.children, interfaceName);
        }
      }
    };

    for (const target of interfaces) {
      collectInterfaceVariables(parseJsonSafe<unknown[]>(target.outputConfigJson, []), target.name);
    }

    return result;
  }, [interfaces, pageFieldOptions]);
  function buildRuleSnapshot(values: Partial<RuleForm>) {
    return JSON.stringify({
      templateRuleId: values.templateRuleId ?? null,
      name: values.name ?? "",
      ruleScope: values.ruleScope ?? (mode === "TEMPLATE" ? "SHARED" : "PAGE_RESOURCE"),
      pageResourceId: values.pageResourceId ?? null,
      priority: values.priority ?? 1,
      promptMode: values.promptMode ?? "FLOATING",
      titleSuffix: values.titleSuffix ?? "",
      bodyTemplate: values.bodyTemplate ?? "",
      bodyEditorStateJson: values.bodyEditorStateJson ?? "",
      closeMode: values.closeMode ?? "MANUAL_CLOSE",
      closeTimeoutSec: values.closeTimeoutSec ?? null,
      hasConfirmButton: values.hasConfirmButton ?? true,
      sceneId: values.sceneId ?? null,
      status: "DRAFT",
      ownerOrgId: values.ownerOrgId ?? ""
    });
  }
  function closeRuleModalDirectly() {
    setOpen(false);
    setEditing(null);
    setCurrentRule(null);
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
    const presetPromptContent = parsePromptContentConfig(presetTemplate?.promptContentConfigJson);
    const values: RuleForm = {
      templateRuleId: presetTemplate?.id,
      name: presetTemplate ? `${presetTemplate.name}-副本` : "",
      ruleScope: mode === "TEMPLATE" ? "SHARED" : "PAGE_RESOURCE",
      pageResourceId: mode === "TEMPLATE" ? undefined : presetPageId,
      priority: presetTemplate?.priority ?? 500,
      promptMode: presetTemplate?.promptMode ?? "FLOATING",
      titleSuffix: presetPromptContent.titleSuffix,
      bodyTemplate: presetPromptContent.bodyTemplate,
      bodyEditorStateJson: presetPromptContent.bodyEditorStateJson,
      closeMode: presetTemplate?.closeMode ?? "MANUAL_CLOSE",
      closeTimeoutSec: presetTemplate?.closeTimeoutSec,
      hasConfirmButton: true,
      sceneId: presetTemplate?.sceneId ?? presetSceneId,
      status: "DRAFT",
      ownerOrgId: presetTemplate?.ownerOrgId ?? "branch-east"
    };
    setEditing(null);
    setCurrentRule(null);
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
    const promptContent = parsePromptContentConfig(template?.promptContentConfigJson);
    ruleForm.setFieldsValue({
      ...currentValues,
      templateRuleId: template.id,
      name: currentValues.name?.trim() ? currentValues.name : `${template.name}-副本`,
      ruleScope: "PAGE_RESOURCE",
      priority: template.priority,
      promptMode: template.promptMode,
      titleSuffix: currentValues.titleSuffix?.trim() ? currentValues.titleSuffix : promptContent.titleSuffix,
      bodyTemplate: currentValues.bodyTemplate?.trim() ? currentValues.bodyTemplate : promptContent.bodyTemplate,
      bodyEditorStateJson: currentValues.bodyEditorStateJson?.trim() ? currentValues.bodyEditorStateJson : promptContent.bodyEditorStateJson,
      closeMode: template.closeMode,
      closeTimeoutSec: template.closeTimeoutSec,
      hasConfirmButton: true,
      sceneId: template.sceneId,
      ownerOrgId: currentValues.ownerOrgId?.trim() ? currentValues.ownerOrgId : template.ownerOrgId
    });
  }
  function openEdit(row: RuleDefinition) {
    const promptContent = parsePromptContentConfig(row.promptContentConfigJson);
    const values: RuleForm = {
      templateRuleId: row.sourceRuleId,
      name: row.name,
      ruleScope: row.ruleScope,
      pageResourceId: row.pageResourceId,
      priority: row.priority,
      promptMode: row.promptMode,
      titleSuffix: promptContent.titleSuffix,
      bodyTemplate: promptContent.bodyTemplate,
      bodyEditorStateJson: promptContent.bodyEditorStateJson,
      closeMode: row.closeMode,
      closeTimeoutSec: row.closeTimeoutSec,
      hasConfirmButton: true,
      sceneId: row.sceneId,
      status: "DRAFT",
      ownerOrgId: row.ownerOrgId
    };
    setEditing(row);
    setCurrentRule(row);
    setReuseSourceRule(null);
    setPublishNotice(null);
    ruleForm.setFieldsValue(values);
    setRuleSnapshot(buildRuleSnapshot(values));
    setSaveValidationReport(null);
    setOpen(true);
    setLogicValidationIssues([]);
    setLogicLoading(true);
    void loadLogic(row)
      .catch((error) => {
        msgApi.error(error instanceof Error ? error.message : "条件配置加载失败");
      })
      .finally(() => {
        setLogicLoading(false);
      });
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
        promptContentConfigJson: stringifyPromptContentConfig({
          titleSuffix: values.titleSuffix,
          bodyTemplate: values.bodyTemplate,
          bodyEditorStateJson: values.bodyEditorStateJson
        }),
        closeMode: values.closeMode ?? "MANUAL_CLOSE",
        closeTimeoutSec: values.closeTimeoutSec,
        hasConfirmButton: true,
        sceneId: values.sceneId,
        ownerOrgId: values.ownerOrgId ?? "",
        availablePromptVariableKeys: promptVariableOptions.map((item) => item.key)
      },
      rows
    );
  }, [editing?.id, mode, open, promptVariableOptions, rows, watchedRuleValues]);
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
      promptContentConfigJson: stringifyPromptContentConfig({
        titleSuffix: values.titleSuffix,
        bodyTemplate: values.bodyTemplate,
        bodyEditorStateJson: values.bodyEditorStateJson
      }),
      closeMode: values.closeMode,
      closeTimeoutSec: values.closeMode === "TIMER_THEN_MANUAL" ? values.closeTimeoutSec : undefined,
      hasConfirmButton: true,
      sceneId: values.sceneId,
      sceneName: scene?.name,
      effectiveStartAt: editing?.effectiveStartAt,
      effectiveEndAt: editing?.effectiveEndAt,
      status: "DRAFT",
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
      warningCount: result.report.warningCount,
      resourceId: saved.id
    });
    closeRuleModalDirectly();
    await loadData();
  }

  async function publishRuleNow(
    ruleId: number,
    ruleName: string,
    options?: {
      effectiveOrgIds?: string[];
      effectiveStartAt?: string;
      effectiveEndAt?: string;
    }
  ): Promise<boolean> {
    const pendingRows = await configCenterService.listPendingItems();
    const pending = pendingRows.find((item) => item.resourceType === "RULE" && item.resourceId === ruleId);
    if (!pending) {
      msgApi.warning("当前对象没有可生效版本，请先保存草稿。");
      return false;
    }
    const normalizedEffectiveOrgIds = options?.effectiveOrgIds ?? [];
    const result = await configCenterService.publishPendingItem(pending.id, "person-business-manager", options);
    if (!result.success) {
      msgApi.error("生效未通过，请先处理阻断项后再试。");
      return false;
    }
    const effectiveTimeSummary =
      options?.effectiveStartAt && options?.effectiveEndAt
        ? `，时间 ${options.effectiveStartAt} ~ ${options.effectiveEndAt}`
        : "";
    msgApi.success(
      `已生效：${ruleName}（${normalizedEffectiveOrgIds.length > 0 ? normalizedEffectiveOrgIds.map((orgId) => getOrgLabel(orgId)).join("、") : "全部机构"}${effectiveTimeSummary}）`
    );
    await loadData();
    return true;
  }

  async function publishNoticeNow() {
    if (!publishNotice) {
      return;
    }
    const success = await publishRuleNow(publishNotice.resourceId, publishNotice.objectName);
    if (success) {
      setPublishNotice(null);
    }
  }

  async function restoreRuleNow(
    row: RuleDefinition,
    options?: {
      effectiveOrgIds?: string[];
      effectiveStartAt?: string;
      effectiveEndAt?: string;
    }
  ): Promise<boolean> {
    const draftResult = await configCenterService.saveRuleDraft(toRuleDraftPayload(row));
    if (!draftResult.success || !draftResult.data) {
      msgApi.error(draftResult.report.summary);
      return false;
    }
    return publishRuleNow(draftResult.data.id, draftResult.data.name, options);
  }

  async function switchStatus(row: RuleDefinition) {
    const next: LifecycleState = row.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await configCenterService.updateRuleStatus(row.id, next);
    msgApi.success(`规则状态已切换为 ${next}`);
    await loadData();
  }
  async function openLogic(row: RuleDefinition) {
    setCurrentRule(row);
    setLogicValidationIssues([]);
    setLogicLoading(true);
    try {
      await loadLogic(row);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "条件配置加载失败");
    } finally {
      setLogicLoading(false);
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
      const requiredInputs = collectInterfaceInputParams(target).filter((item) => item.validationConfig.required);
      const inputConfig = parseInterfaceInputConfig(draft.interfaceInputConfig);
      for (const input of requiredInputs) {
        const value = (inputConfig[input.name]?.sourceValue ?? "").trim();
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
  function updateInterfaceInputValue(paramName: string, patch: Partial<InterfaceInputBindingDraft>) {
    const current = selectedInterfaceInputConfig[paramName] ?? defaultInterfaceInputBinding();
    const nextValue = {
      ...current,
      ...patch
    };
    const nextConfig = {
      ...selectedInterfaceInputConfig,
      [paramName]: nextValue
    };
    if (!nextValue.sourceValue.trim()) {
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
      2: allIssues.filter((issue) => issue.section === "content").length,
      3: logicValidationIssues.length,
      4: allIssues.filter((issue) => issue.section === "confirm").length
    };
  }, [activeSaveValidationReport, logicValidationIssues]);
  return {
    mode, holder, logicDrawerWidth, loading,
    rows: mode === "TEMPLATE" ? templateRows : pageRuleRows,
    templates: templateRows,
    resources, scenes, preprocessors, interfaces, listDatas,
    open, editing, ruleForm, currentRule, logicLoading, globalLogicType, setGlobalLogicType,
    pageFieldOptions,
    promptVariableOptions,
    conditionsDraft, listLookupDrafts, selectedOperand, setSelectedOperand, savingQuery,
    closeRuleModal, openCreate, applyTemplate, openEdit, submitRule, switchStatus, openLogic,
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
    dismissPublishNotice: () => setPublishNotice(null),
    publishNoticeNow,
    publishRuleNow,
    restoreRuleNow
  };
}

function isTemplateMode(mode: RulesPageMode) {
  return mode === "TEMPLATE";
}
