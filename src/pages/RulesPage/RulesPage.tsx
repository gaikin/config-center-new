import { Alert, Button, Card, Collapse, Drawer, Form, Input, InputNumber, Modal, Select, Space, Steps, Table, Tag, Tooltip, Typography, message } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrgSelect } from "../../components/DirectoryFields";
import { EffectiveConfirmModal } from "../../components/EffectiveConfirmModal";
import { PublishContinuationAlert } from "../../components/PublishContinuationAlert";
import { ValidationReportPanel } from "../../components/ValidationReportPanel";
import { EffectiveScopeMode, getEffectiveActionMeta, getEffectivePermissionBlockedMessage, getPublishValidationByResource } from "../../effectiveFlow";
import { lifecycleLabelMap, promptModeLabelMap } from "../../enumLabels";
import { getOrgLabel, orgOptions } from "../../orgOptions";
import { DEFAULT_PROMPT_TITLE, renderPromptTemplate } from "../../promptContent";
import { configCenterService } from "../../services/configCenterService";
import { useMockSession } from "../../session/mockSession";
import { PromptTemplateEditor, type PromptTemplateEditorHandle } from "./PromptTemplateEditor";
import { RulesPageMode, useRulesPageModel } from "./useRulesPageModel";
import { buildDefaultListLookupMatcher, InterfaceInputParamDraft, ListLookupMatcherDraft, LOGIC_OPERATOR_WIDTH, deriveMachineKeyFromOutputPath, normalizeLookupSourceType, normalizeOperator, normalizeSourceType, closeModeLabel, contextOptions, listLookupSourceOptions, operatorOptions, sourceOptions, statusColor, valueTypeOptions } from "./rulesPageShared";
import { OperandPill, InterfaceInputValueEditor } from "./rulesOperandRenderers";
import type { LifecycleState, PublishValidationReport, RuleDefinition, RuleLogicType, RuleOperandValueType } from "../../types";

type RulesPageProps = {
  mode?: RulesPageMode;
  embedded?: boolean;
  initialPageResourceId?: number;
  initialTemplateRuleId?: number;
  initialSceneId?: number;
  autoOpenCreate?: boolean;
};

type EffectiveTarget = {
  id: number;
  name: string;
  status: LifecycleState;
  source: "row" | "notice";
};

function CompactHint({
  tone = "warning",
  title,
  description,
  extra
}: {
  tone?: "warning" | "success" | "info";
  title: string;
  description?: string;
  extra?: React.ReactNode;
}) {
  const palette =
    tone === "success"
      ? {
          border: "#B7E0C0",
          background: "#F6FFED",
          text: "#237804"
        }
      : tone === "info"
        ? {
            border: "#91CAFF",
            background: "#EFF8FF",
            text: "#175CD3"
          }
        : {
            border: "#FEC84B",
            background: "#FFFAEB",
            text: "#B54708"
          };

  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        background: palette.background,
        borderRadius: 8,
        padding: "8px 10px"
      }}
    >
      <Space size={[8, 4]} wrap style={{ width: "100%", justifyContent: "space-between" }}>
        <Space size={[8, 4]} wrap>
          <Tag color={tone === "success" ? "success" : tone === "info" ? "processing" : "warning"} style={{ marginInlineEnd: 0 }}>
            {tone === "success" ? "已配置" : tone === "info" ? "说明" : "待处理"}
          </Tag>
          <Typography.Text style={{ color: palette.text }}>{title}</Typography.Text>
          {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
        </Space>
        {extra}
      </Space>
    </div>
  );
}

function PanelField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function PanelGrid({
  children
}: {
  children: React.ReactNode;
}) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>{children}</div>;
}

export function RulesPage({
  mode = "PAGE_RULE",
  embedded = false,
  initialPageResourceId,
  initialTemplateRuleId,
  initialSceneId,
  autoOpenCreate
}: RulesPageProps) {
  const {
    holder,
    logicDrawerWidth,
    loading,
    rows,
    templates,
    resources,
    scenes,
    preprocessors,
    interfaces,
    listDatas,
    open,
    editing,
    ruleForm,
    logicOpen,
    currentRule,
    globalLogicType,
    setGlobalLogicType,
    pageFieldOptions,
    promptVariableOptions,
    conditionsDraft,
    selectedOperand,
    setSelectedOperand,
    savingQuery,
    closeRuleModal,
    closeLogicDrawer,
    openCreate,
    applyTemplate,
    openEdit,
    submitRule,
    switchStatus,
    openLogic,
    addCondition,
    removeCondition,
    selectedContext,
    changeSelectedSourceType,
    addPreprocessorBinding,
    updatePreprocessorBinding,
    removePreprocessorBinding,
    saveConditionLogic,
    selectedOutputPathOptions,
    selectedInterfaceInputParams,
    selectedInterfaceInputConfig,
    updateInterfaceInputValue,
    updateCondition,
    updateSelectedOperand,
    saveValidationReport,
    logicValidationIssues,
    selectedOperandIssues,
    hasSelectedOperandDirtyConfig,
    wizardStepIssues,
    publishNotice,
    dismissPublishNotice,
    publishRuleNow,
    restoreRuleNow
  } = useRulesPageModel(mode, { initialPageResourceId, initialTemplateRuleId, initialSceneId, autoOpenCreate });
  const navigate = useNavigate();
  const { hasAction } = useMockSession();
  const [msgApi, msgHolder] = message.useMessage();
  const isTemplateMode = mode === "TEMPLATE";
  const pageTitle = isTemplateMode ? "模板复用" : "智能提示";
  const pageDescription = isTemplateMode
    ? "沉淀高复用规则模板。模板仅引用公共字段，供业务人员在新建页面规则时快速套用。"
    : "规则配置以页面规则为主；新建时可快速复用模板，自动带入条件与提示配置，无需先专门建立模板。保存后可直接发布当前对象。";
  const createButtonLabel = isTemplateMode ? "新建模板" : "新建规则";
  const modalTitle = editing ? (isTemplateMode ? "编辑规则模板" : "编辑规则") : isTemplateMode ? "新建规则模板" : "新建规则";
  const modalAlert = isTemplateMode
    ? {
        message: "模板中心面向高复用规则沉淀。",
        description: "模板只允许使用公共字段，不绑定具体页面；业务人员建规则时可选择模板，自动带入条件逻辑和提示配置。"
      }
    : {
        message: "以页面规则为主，新建时可直接套用模板。",
        description: "模板是快捷来源，不是业务人员的主操作对象；选择模板后会自动带入条件逻辑、提示方式和关闭策略。"
      };
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedPromptVariable, setSelectedPromptVariable] = useState<string>();
  const promptEditorRef = useRef<PromptTemplateEditorHandle | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ matched: boolean; detail: string } | null>(null);
  const [effectiveTarget, setEffectiveTarget] = useState<EffectiveTarget | null>(null);
  const [effectiveLoading, setEffectiveLoading] = useState(false);
  const [effectiveSubmitting, setEffectiveSubmitting] = useState(false);
  const [effectiveValidationReport, setEffectiveValidationReport] = useState<PublishValidationReport | null>(null);
  const [effectiveBlockedMessage, setEffectiveBlockedMessage] = useState<string | null>(null);
  const [effectiveScopeMode, setEffectiveScopeMode] = useState<EffectiveScopeMode>("ALL_ORGS");
  const [effectiveScopeOrgIds, setEffectiveScopeOrgIds] = useState<string[]>([]);
  const [effectiveStartAt, setEffectiveStartAt] = useState("");
  const [effectiveEndAt, setEffectiveEndAt] = useState("");
  const watchedPromptMode = Form.useWatch("promptMode", ruleForm);
  const watchedTitleSuffix = Form.useWatch("titleSuffix", ruleForm);
  const watchedBodyTemplate = Form.useWatch("bodyTemplate", ruleForm);
  const effectiveMeta = effectiveTarget ? getEffectiveActionMeta(effectiveTarget.status) : null;
  const effectiveScopeOptions = useMemo(
    () => orgOptions.map((item) => ({ label: item.label, value: String(item.value) })),
    []
  );
  const effectivePermissionBlockedMessage = effectiveMeta
    ? getEffectivePermissionBlockedMessage(effectiveMeta.type, hasAction)
    : null;
  const modalBlockedMessage = effectiveBlockedMessage ?? effectivePermissionBlockedMessage;
  const canEffectiveConfirm =
    Boolean(effectiveMeta) &&
    (effectiveMeta?.type === "DISABLE" || Boolean(effectiveStartAt.trim() && effectiveEndAt.trim() && effectiveStartAt.trim() <= effectiveEndAt.trim())) &&
    (effectiveMeta?.type === "DISABLE" || effectiveScopeMode !== "CUSTOM_ORGS" || effectiveScopeOrgIds.length > 0) &&
    (effectiveMeta?.type !== "PUBLISH" || Boolean(effectiveValidationReport?.pass)) &&
    !modalBlockedMessage;
  const selectedListData = useMemo(() => {
    if (selectedContext?.operand.sourceType !== "LIST_LOOKUP_FIELD") {
      return null;
    }
    return listDatas.find((item) => item.id === selectedContext.operand.listDataId) ?? null;
  }, [listDatas, selectedContext]);
  const selectedListOutputOptions = useMemo(
    () => selectedListData?.outputFields.map((item) => ({ label: item, value: item })) ?? [],
    [selectedListData]
  );
  const promptPreviewValues = useMemo(
    () =>
      promptVariableOptions.reduce<Record<string, string>>((acc, item) => {
        acc[item.key] = item.exampleValue;
        return acc;
      }, {}),
    [promptVariableOptions]
  );
  const promptPreviewTitle = watchedTitleSuffix?.trim() ? `${DEFAULT_PROMPT_TITLE} · ${watchedTitleSuffix.trim()}` : DEFAULT_PROMPT_TITLE;
  const promptPreviewBody = renderPromptTemplate(watchedBodyTemplate ?? "", promptPreviewValues);

  function updateListMatchers(
    updater:
      | ListLookupMatcherDraft[]
      | ((previous: ListLookupMatcherDraft[]) => ListLookupMatcherDraft[])
  ) {
    if (!selectedContext || selectedContext.operand.sourceType !== "LIST_LOOKUP_FIELD") {
      return;
    }
    const currentMatchers = selectedContext.operand.listMatchers;
    const nextMatchers = typeof updater === "function" ? updater(currentMatchers) : updater;
    updateSelectedOperand({ listMatchers: nextMatchers });
  }

  function addListMatcher() {
    updateListMatchers((previous) => [...previous, buildDefaultListLookupMatcher()]);
  }

  function updateListMatcher(
    matcherId: string,
    patch: Partial<ListLookupMatcherDraft>
  ) {
    updateListMatchers((previous) =>
      previous.map((item) => (item.id === matcherId ? { ...item, ...patch } : item))
    );
  }

  function removeListMatcher(matcherId: string) {
    updateListMatchers((previous) => {
      if (previous.length <= 1) {
        return [buildDefaultListLookupMatcher()];
      }
      return previous.filter((item) => item.id !== matcherId);
    });
  }

  function insertPromptVariable(variableKey: string) {
    promptEditorRef.current?.insertVariable(variableKey);
  }

  function handlePromptVariableDragStart(event: React.DragEvent<HTMLElement>, variableKey: string) {
    event.dataTransfer.setData("text/plain", `{{${variableKey}}}`);
    event.dataTransfer.effectAllowed = "copy";
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    setWizardStep(0);
    setPreviewResult(null);
  }, [open, editing?.id, isTemplateMode]);

  const stepItems = useMemo(() => {
    if (isTemplateMode) {
      return [];
    }
    return [
      { title: wizardStepIssues[0] > 0 ? `选页面 (${wizardStepIssues[0]})` : "选页面" },
      { title: wizardStepIssues[1] > 0 ? `基础配置 (${wizardStepIssues[1]})` : "基础配置" },
      { title: wizardStepIssues[2] > 0 ? `提示内容 (${wizardStepIssues[2]})` : "提示内容" },
      { title: wizardStepIssues[3] > 0 ? `预览 (${wizardStepIssues[3]})` : "预览" },
      { title: wizardStepIssues[4] > 0 ? `保存 (${wizardStepIssues[4]})` : "保存" }
    ];
  }, [isTemplateMode, wizardStepIssues]);

  async function runWizardPreview() {
    const values = await ruleForm.validateFields([
      "name",
      "priority",
      "promptMode",
      "titleSuffix",
      "bodyTemplate",
      "closeMode",
      "ownerOrgId",
      ...(ruleForm.getFieldValue("closeMode") === "TIMER_THEN_MANUAL" ? ["closeTimeoutSec"] : []),
      "sceneId"
    ]);

    setPreviewLoading(true);
    try {
      if (editing) {
        const result = await configCenterService.previewRule(editing.id);
        setPreviewResult({
          matched: result.matched,
          detail: result.detail
        });
      } else {
        setPreviewResult({
          matched: true,
          detail: `规则「${values.name}」预览通过：已完成字段完整性检查，可继续保存。`
        });
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleWizardNext() {
    if (wizardStep === 0) {
      await ruleForm.validateFields(["pageResourceId"]);
      setWizardStep(1);
      return;
    }
    if (wizardStep === 1) {
      await ruleForm.validateFields([
        "name",
        "priority",
        "promptMode",
        "closeMode",
        "ownerOrgId",
        ...(ruleForm.getFieldValue("closeMode") === "TIMER_THEN_MANUAL" ? ["closeTimeoutSec"] : []),
        "sceneId"
      ]);
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      await ruleForm.validateFields(["titleSuffix", "bodyTemplate"]);
      setWizardStep(3);
      return;
    }
    if (wizardStep === 3) {
      await runWizardPreview();
      setWizardStep(4);
      return;
    }
    await submitRule();
  }

  async function openEffectiveAction(target: EffectiveTarget) {
    const action = getEffectiveActionMeta(target.status);
    const permissionBlocked = getEffectivePermissionBlockedMessage(action.type, hasAction);
    if (permissionBlocked) {
      msgApi.warning(permissionBlocked);
      return;
    }
    const targetRule = rows.find((item) => item.id === target.id);

    setEffectiveTarget(target);
    setEffectiveLoading(false);
    setEffectiveBlockedMessage(null);
    setEffectiveValidationReport(null);
    setEffectiveScopeMode("ALL_ORGS");
    setEffectiveScopeOrgIds([]);
    setEffectiveStartAt(targetRule?.effectiveStartAt ?? "");
    setEffectiveEndAt(targetRule?.effectiveEndAt ?? "");

    if (action.type !== "PUBLISH") {
      return;
    }

    setEffectiveLoading(true);
    try {
      const validation = await getPublishValidationByResource("RULE", target.id);
      if (!validation) {
        setEffectiveBlockedMessage("当前对象没有待发布版本，请先保存草稿。");
        return;
      }
      setEffectiveValidationReport(validation.report);
    } catch (error) {
      setEffectiveBlockedMessage(error instanceof Error ? error.message : "加载生效检查结果失败");
    } finally {
      setEffectiveLoading(false);
    }
  }

  async function confirmEffectiveAction() {
    if (!effectiveTarget || !effectiveMeta) {
      return;
    }
    setEffectiveSubmitting(true);
    try {
      if (effectiveMeta.type === "PUBLISH") {
        const success = await publishRuleNow(
          effectiveTarget.id,
          effectiveTarget.name,
          {
            effectiveOrgIds: effectiveScopeMode === "CUSTOM_ORGS" ? effectiveScopeOrgIds : [],
            effectiveStartAt,
            effectiveEndAt
          }
        );
        if (!success) {
          const validation = await getPublishValidationByResource("RULE", effectiveTarget.id);
          setEffectiveValidationReport(validation?.report ?? null);
          return;
        }
      } else {
        const row = rows.find((item) => item.id === effectiveTarget.id);
        if (!row) {
          msgApi.warning("对象状态已变化，请刷新后重试。");
          return;
        }
        if (effectiveMeta.type === "RESTORE") {
          const restored = await restoreRuleNow(
            row,
            {
              effectiveOrgIds: effectiveScopeMode === "CUSTOM_ORGS" ? effectiveScopeOrgIds : [],
              effectiveStartAt,
              effectiveEndAt
            }
          );
          if (!restored) {
            return;
          }
        } else {
          await switchStatus(row);
        }
      }

      if (effectiveTarget.source === "notice") {
        dismissPublishNotice();
      }
      setEffectiveTarget(null);
      setEffectiveValidationReport(null);
      setEffectiveBlockedMessage(null);
      setEffectiveStartAt("");
      setEffectiveEndAt("");
    } finally {
      setEffectiveSubmitting(false);
    }
  }
  return (
    <div>
      {holder}
      {msgHolder}
      {!embedded ? (
        <>
          <Typography.Title level={4}>{pageTitle}</Typography.Title>
          <Typography.Paragraph type="secondary">{pageDescription}</Typography.Paragraph>
        </>
      ) : null}

      {publishNotice ? (
        <PublishContinuationAlert
          objectLabel={publishNotice.objectLabel}
          objectName={publishNotice.objectName}
          warningCount={publishNotice.warningCount}
          actionLabel={getEffectiveActionMeta("DRAFT").label}
          actionDisabled={Boolean(getEffectivePermissionBlockedMessage("PUBLISH", hasAction))}
          actionDisabledReason={getEffectivePermissionBlockedMessage("PUBLISH", hasAction) ?? undefined}
          onGoPublish={() =>
            void openEffectiveAction({
              id: publishNotice.resourceId,
              name: publishNotice.objectName,
              status: "DRAFT",
              source: "notice"
            })
          }
          onClose={dismissPublishNotice}
        />
      ) : null}

      <Card
        extra={
          <Tooltip title={createButtonLabel}>
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
            { title: isTemplateMode ? "模板名称" : "规则名称", dataIndex: "name", width: 200 },
            ...(isTemplateMode
              ? [
                  {
                    title: "字段范围",
                    width: 140,
                    render: () => <Tag color="blue">仅公共字段</Tag>
                  }
                ]
              : [
                  {
                    title: "页面资源",
                    width: 160,
                    render: (_: unknown, row: RuleDefinition) =>
                      row.pageResourceName ?? <Typography.Text type="secondary">未绑定页面</Typography.Text>
                  },
                  {
                    title: "来源模板",
                    width: 160,
                    render: (_: unknown, row: RuleDefinition) =>
                      row.sourceRuleName ?? <Typography.Text type="secondary">独立规则</Typography.Text>
                  }
                ]),
            { title: "优先级", dataIndex: "priority", width: 90 },
            {
              title: "提示模式",
              dataIndex: "promptMode",
              width: 100,
              render: (value: RuleDefinition["promptMode"]) => promptModeLabelMap[value]
            },
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
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
            },
            {
              title: "操作",
              width: 360,
              render: (_, row) => {
                const actionMeta = getEffectiveActionMeta(row.status);
                const actionBlocked = getEffectivePermissionBlockedMessage(actionMeta.type, hasAction);
                return (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>
                    {isTemplateMode ? "编辑模板" : "编辑基础"}
                  </Button>
                  <Button size="small" onClick={() => void openLogic(row)}>
                    {isTemplateMode ? "编辑模板条件" : "高级条件"}
                  </Button>
                  <Button
                    size="small"
                    type={actionMeta.type === "PUBLISH" ? "primary" : "default"}
                    disabled={Boolean(actionBlocked)}
                    title={actionBlocked ?? undefined}
                    onClick={() =>
                      void openEffectiveAction({
                        id: row.id,
                        name: row.name,
                        status: row.status,
                        source: "row"
                      })
                    }
                  >
                    {actionMeta.label}
                  </Button>
                </Space>
                );
              }
            }
          ]}
        />
      </Card>

      <Modal
        title={modalTitle}
        open={open}
        onCancel={closeRuleModal}
        width={720}
        footer={
          isTemplateMode
            ? [
                <Button key="cancel" onClick={closeRuleModal}>
                  取消
                </Button>,
                <Button key="save" type="primary" onClick={() => void submitRule()}>
                  保存
                </Button>
              ]
            : [
                <Button
                  key="back"
                  onClick={() => {
                    if (wizardStep === 0) {
                      closeRuleModal();
                      return;
                    }
                    setWizardStep((prev) => Math.max(prev - 1, 0));
                  }}
                >
                  {wizardStep === 0 ? "取消" : "上一步"}
                </Button>,
                <Button key="next" type="primary" loading={wizardStep === 2 && previewLoading} onClick={() => void handleWizardNext()}>
                  {wizardStep === 3 ? "保存规则" : "下一步"}
                </Button>
              ]
        }
      >
        <Form form={ruleForm} layout="vertical">
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {modalAlert.message} {modalAlert.description}
          </Typography.Paragraph>
          <Form.Item hidden name="ruleScope">
            <Input />
          </Form.Item>

          {!isTemplateMode ? <Steps current={wizardStep} size="small" items={stepItems} style={{ marginBottom: 12 }} /> : null}

          {!isTemplateMode && wizardStep === 0 ? (
            <ValidationReportPanel
              report={saveValidationReport}
              sections={["page"]}
              title="当前步骤还有待处理问题"
            />
          ) : null}

          {!isTemplateMode && wizardStep === 1 ? (
            <ValidationReportPanel
              report={saveValidationReport}
              sections={["basic"]}
              title="基础配置还有待处理问题"
            />
          ) : null}

          {!isTemplateMode && wizardStep === 2 ? (
            <ValidationReportPanel
              report={saveValidationReport}
              sections={["content"]}
              title="提示内容还有待处理问题"
            />
          ) : null}

          {isTemplateMode || wizardStep === 0 ? (
            !editing && !isTemplateMode ? (
              <>
                <Form.Item
                  name="pageResourceId"
                  label="页面资源"
                  rules={[{ required: true, message: "请选择页面资源" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={resources.map((item) => ({ label: item.name, value: item.id }))}
                  />
                </Form.Item>
                <Form.Item name="templateRuleId" label="场景模板">
                  <Select
                    allowClear
                    showSearch
                    placeholder={templates.length > 0 ? "可选：套用已沉淀模板" : "暂无可复用模板"}
                    optionFilterProp="label"
                    options={templates.map((item) => ({
                      label: item.name,
                      value: item.id
                    }))}
                    onChange={(value) => applyTemplate(value as number | undefined)}
                  />
                </Form.Item>
              </>
            ) : !isTemplateMode ? (
              <>
                <Form.Item
                  name="pageResourceId"
                  label="页面资源"
                  rules={[{ required: true, message: "请选择页面资源" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={resources.map((item) => ({ label: item.name, value: item.id }))}
                  />
                </Form.Item>
                <Form.Item label="来源模板">
                  <Input value={editing?.sourceRuleName ?? "独立规则"} readOnly />
                </Form.Item>
              </>
            ) : (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                模板不绑定页面，只能使用公共字段。需要页面特有字段时，请在页面规则里补充。
              </Typography.Paragraph>
            )
          ) : null}

          {isTemplateMode || wizardStep === 1 ? (
            <>
              <Form.Item name="name" label={isTemplateMode ? "模板名称" : "规则名称"} rules={[{ required: true, message: `请输入${isTemplateMode ? "模板" : "规则"}名称` }]}>
                <Input />
              </Form.Item>
              <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                <InputNumber min={1} max={999} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="promptMode" label="提示模式" rules={[{ required: true }]}>
                <Select options={[{ label: promptModeLabelMap.SILENT, value: "SILENT" }, { label: promptModeLabelMap.FLOATING, value: "FLOATING" }]} />
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
              <Form.Item name="sceneId" label="关联作业场景（可选）" extra="点击“确定”时可选联动作业场景；未配置时仅关闭提示。">
                <Select allowClear options={scenes.map((scene) => ({ label: scene.name, value: scene.id }))} />
              </Form.Item>
              <Form.Item label="状态">
                <Tag color="default">草稿（发布后生效）</Tag>
              </Form.Item>
              <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true, message: "请选择组织范围" }]}>
                <OrgSelect />
              </Form.Item>
              {!isTemplateMode ? (
                <Button onClick={() => (editing ? void openLogic(editing) : undefined)} disabled={!editing}>
                  配置高级条件
                </Button>
              ) : null}
            </>
          ) : null}

          {!isTemplateMode && wizardStep === 2 ? (
            <Card size="small" title="提示内容配置">
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                <Typography.Text type="secondary">
                  标题前缀固定为“{DEFAULT_PROMPT_TITLE}”，本期不开放配置。
                </Typography.Text>
                <Form.Item
                  name="titleSuffix"
                  label="标题后缀"
                  rules={[{ max: 20, message: "标题后缀最多 20 个字符" }]}
                >
                  <Input maxLength={20} placeholder="例如：贷款高风险客户" />
                </Form.Item>
                <div>
                  <Typography.Text type="secondary">可用变量（支持拖拽到正文）</Typography.Text>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {promptVariableOptions.map((item) => (
                      <Tag
                        key={item.key}
                        color="processing"
                        draggable
                        style={{ cursor: "grab", userSelect: "none" }}
                        onClick={() => insertPromptVariable(item.key)}
                        onDragStart={(event) => handlePromptVariableDragStart(event, item.key)}
                      >
                        {item.label}
                      </Tag>
                    ))}
                  </div>
                </div>
                <Space.Compact style={{ width: "100%" }}>
                  <Select
                    style={{ width: "100%" }}
                    allowClear
                    placeholder="选择变量后插入正文"
                    value={selectedPromptVariable}
                    options={promptVariableOptions.map((item) => ({ label: `${item.label}（${item.key}）`, value: item.key }))}
                    onChange={(value) => setSelectedPromptVariable(value)}
                  />
                  <Button
                    onClick={() => {
                      if (!selectedPromptVariable) {
                        return;
                      }
                      insertPromptVariable(selectedPromptVariable);
                      setSelectedPromptVariable(undefined);
                    }}
                  >
                    插入变量
                  </Button>
                </Space.Compact>
                <Form.Item
                  name="bodyTemplate"
                  label="提示正文"
                  rules={[
                    { required: true, message: "请输入提示正文" },
                    { max: 300, message: "提示正文最多 300 个字符" },
                    {
                      validator: (_, value: string | undefined) => {
                        const text = value ?? "";
                        const matched = Array.from(text.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g), (item) => item[1]);
                        const invalidKeys = Array.from(new Set(matched.filter((key) => !promptVariableOptions.some((item) => item.key === key))));
                        return invalidKeys.length > 0 ? Promise.reject(new Error(`存在未注册变量：${invalidKeys.join("、")}`)) : Promise.resolve();
                      }
                    }
                  ]}
                  extra={`${(watchedBodyTemplate ?? "").length} / 300`}
                >
                  <PromptTemplateEditor
                    ref={promptEditorRef}
                    value={watchedBodyTemplate ?? ""}
                    variableOptions={promptVariableOptions}
                    placeholder="请输入提示正文，可点击或拖拽变量到此处"
                    onChange={(nextValue) => ruleForm.setFieldValue("bodyTemplate", nextValue)}
                  />
                </Form.Item>
              </Space>
            </Card>
          ) : null}

          {!isTemplateMode && wizardStep === 3 ? (
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Card size="small" title="浮窗预览（固定预览样式）">
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {watchedPromptMode === "SILENT" ? (
                    <Alert
                      type="info"
                      showIcon
                      message="当前仅展示浮窗预览效果"
                      description="如果运行时选择静默提示，实际展示会弱于下方预览。"
                    />
                  ) : null}
                  <div
                    style={{
                      border: "1px solid #B2DDFF",
                      background: "#F8FBFF",
                      borderRadius: 12,
                      padding: 16
                    }}
                  >
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <Typography.Text strong>{promptPreviewTitle}</Typography.Text>
                      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                        {promptPreviewBody || "请输入提示正文后查看浮窗预览效果。"}
                      </Typography.Paragraph>
                      <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                        <Button disabled>取消</Button>
                        <Button type="primary" disabled>
                          确定
                        </Button>
                      </Space>
                    </Space>
                  </div>
                </Space>
              </Card>
              <ValidationReportPanel
                issues={logicValidationIssues}
                title="高级条件还有待处理问题"
              />
              <Alert
                showIcon
                type={previewResult?.matched ? "success" : "info"}
                message={previewResult?.matched ? "预览通过" : "请执行预览"}
                description={previewResult?.detail ?? "保存前可执行一次预览，确认规则表达和触发方式。"}
              />
              <Space>
                <Button loading={previewLoading} type="primary" onClick={() => void runWizardPreview()}>
                  执行预览
                </Button>
                <Button onClick={() => (editing ? void openLogic(editing) : undefined)} disabled={!editing}>
                  编辑高级条件
                </Button>
              </Space>
            </Space>
          ) : null}

          {!isTemplateMode && wizardStep === 4 ? (
            <Card size="small" title="保存确认">
              {(() => {
                const summaryPromptMode = ruleForm.getFieldValue("promptMode") as RuleDefinition["promptMode"] | undefined;
                const summaryCloseMode = ruleForm.getFieldValue("closeMode") as RuleDefinition["closeMode"] | undefined;
                return (
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <ValidationReportPanel report={saveValidationReport} title="保存前检查结果" />
                    <Tag color="blue">{ruleForm.getFieldValue("name")}</Tag>
                    <Typography.Text type="secondary">
                      页面：{
                        resources.find((item) => item.id === ruleForm.getFieldValue("pageResourceId"))?.name ?? "未绑定页面"
                      }
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      提示模式：{summaryPromptMode ? promptModeLabelMap[summaryPromptMode] : "-"} / 关闭方式：
                      {summaryCloseMode ? closeModeLabel[summaryCloseMode] : "-"}
                    </Typography.Text>
                    <Typography.Text type="secondary">标题：{promptPreviewTitle}</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      正文预览：{promptPreviewBody || "未填写提示正文"}
                    </Typography.Paragraph>
                    <Typography.Text type="secondary">
                      状态：草稿（发布后生效），组织范围：{getOrgLabel(ruleForm.getFieldValue("ownerOrgId"))}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      保存后会进入待发布列表，可直接发布当前对象。
                    </Typography.Text>
                  </Space>
                );
              })()}
            </Card>
          ) : null}
        </Form>
      </Modal>

      <Drawer
        title={currentRule ? `${isTemplateMode ? "模板高级条件" : "高级条件"}: ${currentRule.name}` : isTemplateMode ? "模板高级条件" : "高级条件"}
        placement="right"
        width={logicDrawerWidth}
        open={logicOpen}
        onClose={closeLogicDrawer}
      >
        <Card
          title="高级条件配置（单层）"
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
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            所有普通条件与名单字段来源会一并保存。多个提示同时命中时，会按优先级依次展示。
          </Typography.Paragraph>

          <ValidationReportPanel issues={logicValidationIssues} title="高级条件还有待处理问题" compact maxPreviewItems={3} />

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
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {conditionsDraft.map((condition, index) => (
                  <Card
                    key={condition.id}
                    size="small"
                    style={{
                      borderColor:
                        selectedOperand?.conditionId === condition.id ? "var(--cc-source-selected, #84CAFF)" : "#f0f0f0"
                    }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", width: "100%", minWidth: 0, overflow: "hidden" }}>
                      <Tag color="blue">条件 {index + 1}</Tag>
                      <OperandPill conditionId={condition.id} side="left" operand={condition.left} selectedOperand={selectedOperand} onSelect={setSelectedOperand} />
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
                        <OperandPill conditionId={condition.id} side="right" operand={condition.right} selectedOperand={selectedOperand} onSelect={setSelectedOperand} />
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
                <Typography.Text type="secondary">先在左侧点击要编辑的左值或右值。</Typography.Text>
              ) : (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <ValidationReportPanel issues={selectedOperandIssues} title="当前值还有待处理问题" compact />
                  {hasSelectedOperandDirtyConfig ? (
                    <CompactHint title="当前来源下已有配置内容" description="切换来源类型后会自动清理旧配置。" />
                  ) : null}
                  <Typography.Text type="secondary">
                    当前正在编辑：条件 {selectedContext.index + 1} - {selectedContext.side === "left" ? "左值" : "右值"}
                  </Typography.Text>

                  <PanelGrid>
                    <PanelField label="来源类型">
                      <Select
                        style={{ width: "100%" }}
                        value={selectedContext.operand.sourceType}
                        options={sourceOptions}
                        onChange={(value) => changeSelectedSourceType(normalizeSourceType(value))}
                      />
                    </PanelField>

                    <PanelField label="值类型">
                      {selectedContext.operand.sourceType === "INTERFACE_FIELD" ? (
                        <Input value={selectedContext.operand.valueType} readOnly />
                      ) : (
                        <Select
                          style={{ width: "100%" }}
                          value={selectedContext.operand.valueType}
                          options={valueTypeOptions}
                          onChange={(value) => updateSelectedOperand({ valueType: value as RuleOperandValueType })}
                        />
                      )}
                    </PanelField>
                  </PanelGrid>

                  {selectedContext.operand.sourceType === "CONST" ? (
                    <div>
                      <Typography.Text>值</Typography.Text>
                      <Input
                        style={{ marginTop: 8 }}
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
                        style={{ width: "100%", marginTop: 8 }}
                        placeholder="请选择页面字段"
                        value={selectedContext.operand.displayValue || undefined}
                        optionFilterProp="label"
                        options={pageFieldOptions}
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
                        style={{ width: "100%", marginTop: 8 }}
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
                          style={{ width: "100%", marginTop: 8 }}
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
                          style={{ width: "100%", marginTop: 8 }}
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

                      <Collapse
                        size="small"
                        items={[
                          {
                            key: "api-inputs",
                            label: `入参配置（${selectedInterfaceInputParams.length}）`,
                            children:
                              selectedInterfaceInputParams.length === 0 ? (
                                <Typography.Text type="secondary">当前 API 没有配置入参，可直接继续。</Typography.Text>
                              ) : (
                                <Table<InterfaceInputParamDraft>
                                  size="small"
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
                                      render: (_, row) => (
                                        <InterfaceInputValueEditor
                                          param={row}
                                          pageFieldOptions={pageFieldOptions}
                                          selectedInterfaceInputConfig={selectedInterfaceInputConfig}
                                          updateInterfaceInputValue={updateInterfaceInputValue}
                                        />
                                      )
                                    }
                                  ]}
                                />
                              )
                          }
                        ]}
                      />
                      <CompactHint
                        tone={selectedContext.operand.outputPath?.trim() ? "success" : "warning"}
                        title={`${selectedContext.operand.interfaceName || "API名称"}.${selectedContext.operand.outputPath || "(未绑定输出值)"}`}
                        description={selectedContext.operand.outputPath?.trim() ? "接口输出已绑定" : "请选择一个 API 输出路径"}
                      />
                    </>
                  ) : null}

                  {selectedContext.operand.sourceType === "LIST_LOOKUP_FIELD" ? (
                    listDatas.length === 0 ? (
                      <Alert
                        type="warning"
                        showIcon
                        message="当前没有可用名单数据"
                        description={
                          <Space direction="vertical" size={4}>
                            <Typography.Text type="secondary">请先到高级配置维护名单资产，再回到规则里使用名单字段来源。</Typography.Text>
                            <Button size="small" type="primary" onClick={() => navigate("/advanced?tab=list-data")}>
                              去维护名单
                            </Button>
                          </Space>
                        }
                      />
                    ) : (
                      <>
                        <div>
                          <Typography.Text>名单数据</Typography.Text>
                          <Select
                            showSearch
                            allowClear
                            style={{ width: "100%", marginTop: 8 }}
                            placeholder="请选择名单数据"
                            value={selectedContext.operand.listDataId}
                            optionFilterProp="label"
                            options={listDatas.map((item) => ({
                              label: `${item.name} / ${item.importColumns.length} 个导入字段`,
                              value: item.id
                            }))}
                            onChange={(value) => {
                              const picked = listDatas.find((item) => item.id === value);
                              const resultField = selectedContext.operand.resultField?.trim() ?? "";
                              const nextMatchers =
                                selectedContext.operand.listMatchers.length > 0
                                  ? selectedContext.operand.listMatchers.map((item, index) => ({
                                      ...item,
                                      matchColumn:
                                        picked?.importColumns.includes(item.matchColumn)
                                          ? item.matchColumn
                                          : index === 0
                                            ? picked?.importColumns[0] ?? ""
                                            : ""
                                    }))
                                  : [
                                      {
                                        ...buildDefaultListLookupMatcher(),
                                        matchColumn: picked?.importColumns[0] ?? ""
                                      }
                                    ];
                              const nextResultField = picked?.outputFields.includes(resultField) ? resultField : "";
                              updateSelectedOperand({
                                listDataId: value as number | undefined,
                                listDataName: picked?.name,
                                matchColumn: picked?.importColumns[0] ?? "",
                                listMatchers: nextMatchers,
                                resultField: nextResultField,
                                displayValue: `${picked?.name ?? "名单"}.${nextResultField || "(未绑定输出字段)"}`,
                                machineKey: nextResultField
                              });
                            }}
                          />
                        </div>

                        <PanelField label="输出字段">
                          <Select
                            showSearch
                            allowClear
                            placeholder={selectedListOutputOptions.length > 0 ? "请选择输出字段" : "当前名单未配置输出字段"}
                            value={selectedContext.operand.resultField}
                            options={selectedListOutputOptions}
                            onChange={(value) => {
                              const nextField = (value as string) ?? "";
                              const listName = selectedContext.operand.listDataName?.trim() || "名单";
                              updateSelectedOperand({
                                resultField: nextField,
                                machineKey: nextField.trim(),
                                displayValue: `${listName}.${nextField.trim() || "(未绑定输出字段)"}`
                              });
                            }}
                          />
                        </PanelField>
                        <CompactHint
                          tone={selectedContext.operand.resultField?.trim() ? "success" : "warning"}
                          title={`${selectedContext.operand.listDataName || "名单"}.${selectedContext.operand.resultField || "(未绑定输出字段)"}`}
                          description={`已完成检索键 ${selectedContext.operand.listMatchers.filter((item) => item.matchColumn.trim() && item.sourceValue.trim()).length} / ${selectedContext.operand.listMatchers.length}`}
                        />
                        <Collapse
                          size="small"
                          items={[
                            {
                              key: "list-matchers",
                              label: `检索键配置（${selectedContext.operand.listMatchers.length}）`,
                              extra: (
                                <Tooltip title="新增检索键">
                                  <Button
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      addListMatcher();
                                    }}
                                  />
                                </Tooltip>
                              ),
                              children: (
                                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                  {selectedContext.operand.listMatchers.map((matcher, index) => (
                                    <div
                                      key={matcher.id}
                                      style={{
                                        border: "1px solid #f0f0f0",
                                        borderRadius: 8,
                                        padding: 10
                                      }}
                                    >
                                      <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                        <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                                          <Typography.Text strong>检索键 {index + 1}</Typography.Text>
                                          <Tooltip title="删除检索键">
                                            <Button
                                              type="text"
                                              danger
                                              size="small"
                                              icon={<DeleteOutlined />}
                                              onClick={() => removeListMatcher(matcher.id)}
                                            />
                                          </Tooltip>
                                        </Space>
                                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(120px, 140px)", gap: 8 }}>
                                          <Select
                                            showSearch
                                            allowClear
                                            placeholder="选择匹配列"
                                            value={matcher.matchColumn || undefined}
                                            options={(selectedListData?.importColumns ?? []).map((item) => ({ label: item, value: item }))}
                                            onChange={(value) => updateListMatcher(matcher.id, { matchColumn: (value as string) ?? "" })}
                                          />
                                          <Select
                                            value={matcher.sourceType}
                                            options={listLookupSourceOptions}
                                            onChange={(value) =>
                                              updateListMatcher(matcher.id, {
                                                sourceType: normalizeLookupSourceType(value as string),
                                                sourceValue: ""
                                              })
                                            }
                                          />
                                        </div>
                                        {matcher.sourceType === "PAGE_FIELD" ? (
                                          <Select
                                            showSearch
                                            allowClear
                                            placeholder="请选择页面字段"
                                            value={matcher.sourceValue || undefined}
                                            optionFilterProp="label"
                                            options={pageFieldOptions}
                                            onChange={(value) => updateListMatcher(matcher.id, { sourceValue: (value as string) ?? "" })}
                                          />
                                        ) : matcher.sourceType === "CONTEXT" ? (
                                          <Select
                                            showSearch
                                            allowClear
                                            placeholder="请选择上下文变量"
                                            value={matcher.sourceValue || undefined}
                                            options={contextOptions.map((item) => ({ label: item, value: item }))}
                                            onChange={(value) => updateListMatcher(matcher.id, { sourceValue: (value as string) ?? "" })}
                                          />
                                        ) : (
                                          <Input
                                            placeholder={matcher.sourceType === "CONST" ? "请输入固定值" : "请输入接口输出标识"}
                                            value={matcher.sourceValue}
                                            onChange={(event) => updateListMatcher(matcher.id, { sourceValue: event.target.value })}
                                          />
                                        )}
                                      </Space>
                                    </div>
                                  ))}
                                </Space>
                              )
                            }
                          ]}
                        />
                      </>
                    )
                  ) : null}

                  <Collapse
                    size="small"
                    items={[
                      {
                        key: "preprocessors",
                        label: `预处理器（${selectedContext.operand.preprocessors.length}）`,
                        extra: (
                          <Tooltip title="添加预处理器">
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={(event) => {
                                event.stopPropagation();
                                addPreprocessorBinding();
                              }}
                            />
                          </Tooltip>
                        ),
                        children:
                          selectedContext.operand.preprocessors.length === 0 ? (
                            <Typography.Text type="secondary">暂无预处理器</Typography.Text>
                          ) : (
                            <Space direction="vertical" style={{ width: "100%" }}>
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
                          )
                      }
                    ]}
                  />
                </Space>
              )}
            </Card>
          </div>
        </Card>

      </Drawer>

      {effectiveTarget && effectiveMeta ? (
        <EffectiveConfirmModal
          open
          objectName={effectiveTarget.name}
          action={effectiveMeta}
          loading={effectiveLoading}
          confirming={effectiveSubmitting}
          canConfirm={canEffectiveConfirm}
          blockedMessage={modalBlockedMessage}
          validationReport={effectiveValidationReport}
          scopeMode={effectiveScopeMode}
          scopeOrgIds={effectiveScopeOrgIds}
          scopeOptions={effectiveScopeOptions}
          effectiveStartAt={effectiveStartAt}
          effectiveEndAt={effectiveEndAt}
          onScopeModeChange={setEffectiveScopeMode}
          onScopeOrgIdsChange={setEffectiveScopeOrgIds}
          onEffectiveStartAtChange={setEffectiveStartAt}
          onEffectiveEndAtChange={setEffectiveEndAt}
          onCancel={() => {
            setEffectiveTarget(null);
            setEffectiveValidationReport(null);
            setEffectiveBlockedMessage(null);
            setEffectiveStartAt("");
            setEffectiveEndAt("");
          }}
          onConfirm={() => void confirmEffectiveAction()}
        />
      ) : null}
    </div>
  );
}


