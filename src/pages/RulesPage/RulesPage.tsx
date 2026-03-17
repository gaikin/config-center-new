import { Alert, Button, Card, Collapse, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Tooltip, Typography, message } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EffectiveConfirmModal } from "../../components/EffectiveConfirmModal";
import { PublishContinuationAlert } from "../../components/PublishContinuationAlert";
import { ValidationReportPanel } from "../../components/ValidationReportPanel";
import { EffectiveScopeMode, getEffectiveActionMeta, getEffectivePermissionBlockedMessage, getPublishValidationByResource } from "../../effectiveFlow";
import { lifecycleLabelMap, promptModeLabelMap } from "../../enumLabels";
import { getOrgLabel, orgOptions } from "../../orgOptions";
import { DEFAULT_PROMPT_TITLE } from "../../promptContent";
import { configCenterService } from "../../services/configCenterService";
import { useMockSession } from "../../session/mockSession";
import { PromptRichPreview } from "./PromptRichPreview";
import { PromptTemplateEditor } from "./PromptTemplateEditor";
import { RulesPageMode, useRulesPageModel } from "./useRulesPageModel";
import { buildDefaultListLookupMatcher, FlatConditionDraft, InterfaceInputParamDraft, ListLookupMatcherDraft, LOGIC_OPERATOR_WIDTH, OperandDraft, deriveMachineKeyFromOutputPath, normalizeLookupSourceType, normalizeOperator, normalizeSourceType, closeModeLabel, contextOptions, listLookupSourceOptions, operatorOptions, sourceOptions, statusColor, valueTypeOptions } from "./rulesPageShared";
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

function summarizeOperand(operand: OperandDraft) {
  switch (operand.sourceType) {
    case "PAGE_FIELD":
    case "CONTEXT":
    case "CONST":
      return operand.displayValue?.trim() || "未配置";
    case "INTERFACE_FIELD":
      return operand.interfaceName?.trim() && operand.outputPath?.trim()
        ? `${operand.interfaceName}.${operand.outputPath}`
        : operand.interfaceName?.trim() || "未绑定 API 输出";
    case "LIST_LOOKUP_FIELD":
      return operand.listDataName?.trim() && operand.resultField?.trim()
        ? `${operand.listDataName}.${operand.resultField}`
        : operand.listDataName?.trim() || "未绑定名单输出";
    default:
      return "未配置";
  }
}

function summarizeCondition(condition: FlatConditionDraft) {
  const operatorLabel = operatorOptions.find((item) => item.value === condition.operator)?.label ?? condition.operator;
  if (condition.operator === "EXISTS") {
    return `${summarizeOperand(condition.left)} ${operatorLabel}`;
  }
  return `${summarizeOperand(condition.left)} ${operatorLabel} ${summarizeOperand(condition.right)}`;
}

function IssueQuickNavCard({
  items,
  onJump
}: {
  items: Array<{ key: string; label: string; count: number }>;
  onJump: (key: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card size="small" title="问题定位">
      <Space direction="vertical" style={{ width: "100%" }} size={8}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onJump(item.key)}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid #f0f0f0",
              borderRadius: 8,
              background: "#fff",
              padding: "8px 10px",
              cursor: "pointer"
            }}
          >
            <span style={{ color: "rgba(0,0,0,0.88)" }}>{item.label}</span>
            <Tag color="error" style={{ marginInlineEnd: 0 }}>
              {item.count}
            </Tag>
          </button>
        ))}
      </Space>
    </Card>
  );
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
    logicLoading,
    globalLogicType,
    setGlobalLogicType,
    pageFieldOptions,
    promptVariableOptions,
    conditionsDraft,
    selectedOperand,
    setSelectedOperand,
    savingQuery,
    closeRuleModal,
    openCreate,
    applyTemplate,
    openEdit,
    submitRule,
    switchStatus,
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ matched: boolean; detail: string } | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<"basic" | "logic">("basic");
  const [pendingOpenTab, setPendingOpenTab] = useState<"basic" | "logic" | null>(null);
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
  const watchedTemplateRuleId = Form.useWatch("templateRuleId", ruleForm);
  const watchedTitleSuffix = Form.useWatch("titleSuffix", ruleForm);
  const watchedBodyTemplate = Form.useWatch("bodyTemplate", ruleForm);
  const watchedBodyEditorStateJson = Form.useWatch("bodyEditorStateJson", ruleForm);
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
  const promptEditorKey = `${editing?.id ?? "create"}-${watchedTemplateRuleId ?? "none"}`;
  const ownerOrgLabel = getOrgLabel(ruleForm.getFieldValue("ownerOrgId"));
  const quickNavItems = useMemo(
    () =>
      [
        { key: "basic", label: "基础信息", count: wizardStepIssues[0] + wizardStepIssues[1] },
        { key: "prompt", label: "提示内容", count: wizardStepIssues[2] },
        { key: "logic", label: "条件配置", count: wizardStepIssues[3] },
        { key: "summary", label: "保存确认", count: wizardStepIssues[4] }
      ].filter((item) => item.count > 0),
    [wizardStepIssues]
  );
  const conditionSummary = useMemo(() => {
    if (!editing) {
      return "新建规则保存后再补充命中条件。";
    }
    if (logicLoading) {
      return "条件加载中...";
    }
    if (conditionsDraft.length === 0) {
      return "暂无条件";
    }
    const joiner = globalLogicType === "AND" ? " 且 " : " 或 ";
    const pieces = conditionsDraft.slice(0, 2).map((item) => summarizeCondition(item));
    const suffix = conditionsDraft.length > 2 ? ` 等 ${conditionsDraft.length} 条` : "";
    return `${globalLogicType === "AND" ? "满足全部条件" : "满足任一条件"}：${pieces.join(joiner)}${suffix}`;
  }, [conditionsDraft, editing, globalLogicType, logicLoading]);
  const currentPageName =
    resources.find((item) => item.id === ruleForm.getFieldValue("pageResourceId"))?.name ?? "未绑定页面";

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

  useEffect(() => {
    if (!open) {
      return;
    }
    setPreviewResult(null);
    setActiveEditorTab(pendingOpenTab ?? "basic");
    setPendingOpenTab(null);
  }, [open, editing?.id, isTemplateMode]);

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

  function jumpToRuleSection(key: string) {
    const anchorMap: Record<string, string> = {
      basic: "rule-section-basic",
      prompt: "rule-section-prompt",
      logic: "rule-section-logic",
      summary: "rule-section-summary"
    };
    setActiveEditorTab(key === "logic" ? "logic" : "basic");
    window.setTimeout(() => {
      const target = document.getElementById(anchorMap[key]);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function openRuleEditorTab(row: RuleDefinition, tab: "basic" | "logic") {
    setPendingOpenTab(tab);
    openEdit(row);
  }

  function renderLogicEditorContent() {
    if (!editing) {
      return (
        <CompactHint
          tone="info"
          title="保存规则后再补充条件"
          description="先完成规则基础信息与提示内容；保存草稿后会在此处继续编辑命中条件。"
        />
      );
    }

    if (logicLoading) {
      return <Alert type="info" showIcon message="条件加载中" description="正在准备当前规则的命中条件，请稍候。" />;
    }

    return (
      <>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          用自然语言方式整理命中逻辑，左侧按条件链路排布，右侧就近修改字段来源与取值。
        </Typography.Paragraph>

        <ValidationReportPanel issues={logicValidationIssues} title="条件配置还有待处理问题" compact maxPreviewItems={4} />

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
          <Typography.Text type="secondary">{conditionSummary}</Typography.Text>
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
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Space size={[8, 4]} wrap style={{ width: "100%", justifyContent: "space-between" }}>
                      <Space size={[8, 4]} wrap>
                        <Tag color="blue">条件 {index + 1}</Tag>
                        <Typography.Text type="secondary">{summarizeCondition(condition)}</Typography.Text>
                      </Space>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        aria-label="delete-condition"
                        onClick={() => removeCondition(condition.id)}
                      />
                    </Space>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", width: "100%", minWidth: 0, overflow: "hidden" }}>
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
                    </div>
                  </Space>
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
      </>
    );
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
                  <Button size="small" onClick={() => openRuleEditorTab(row, "basic")}>
                    基础配置
                  </Button>
                  <Button size="small" onClick={() => openRuleEditorTab(row, "logic")}>
                    条件配置
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
        width={isTemplateMode ? 720 : 1240}
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
                  key="cancel"
                  onClick={closeRuleModal}
                >
                  取消
                </Button>,
                <Button key="preview" loading={previewLoading} onClick={() => void runWizardPreview()}>
                  执行预览
                </Button>,
                <Button key="save" type="primary" onClick={() => void submitRule()}>
                  保存规则
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

          <Tabs
            activeKey={activeEditorTab}
            onChange={(key) => setActiveEditorTab(key as "basic" | "logic")}
            items={[
              {
                key: "basic",
                label: "基础配置",
                children: (
                  <div style={{ display: "grid", gridTemplateColumns: isTemplateMode ? "minmax(0,1fr)" : "minmax(0,1.7fr) minmax(320px, 0.9fr)", gap: 16, alignItems: "start" }}>
                    <Space direction="vertical" style={{ width: "100%" }} size={16}>
                      {!isTemplateMode ? (
                        <CompactHint
                          tone="info"
                          title="基础配置放在这里统一维护"
                          description="保存后再次进入时，会默认直接落到“条件配置”页签。"
                        />
                      ) : null}

                      {!isTemplateMode ? (
                        <Card id="rule-section-basic" size="small" title="触发对象">
                          {!editing ? (
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
                          ) : (
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
                          )}
                        </Card>
                      ) : (
                        <Card id="rule-section-basic" size="small" title="模板范围">
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            模板不绑定页面，只能使用公共字段。业务人员套用模板时，再把模板转换为页面规则。
                          </Typography.Paragraph>
                        </Card>
                      )}

                      <Card size="small" title="规则与行为">
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
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
                          <Form.Item name="sceneId" label="关联作业场景（可选）" extra="点击“确定”时可选联动作业场景；未配置时仅关闭提示。">
                            <Select allowClear options={scenes.map((scene) => ({ label: scene.name, value: scene.id }))} />
                          </Form.Item>
                          <Form.Item label="状态">
                            <Tag color="default">草稿（发布后生效）</Tag>
                          </Form.Item>
                        </div>
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
                        <Form.Item name="ownerOrgId" hidden rules={[{ required: true, message: "请选择组织范围" }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item label="组织范围">
                          <Input value={ownerOrgLabel} readOnly disabled placeholder="系统自动带出" />
                        </Form.Item>
                      </Card>

                      <Card id="rule-section-prompt" size="small" title="提示内容">
                        <Space direction="vertical" style={{ width: "100%" }} size={16}>
                          <Form.Item name="titleSuffix" hidden rules={[{ max: 20, message: "标题后缀最多 20 个字符" }]}>
                            <Input />
                          </Form.Item>
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
                              key={promptEditorKey}
                              value={watchedBodyTemplate ?? ""}
                              editorStateJson={watchedBodyEditorStateJson ?? ""}
                              variableOptions={promptVariableOptions}
                              placeholder="请输入提示正文，可点击或拖拽变量到此处"
                              onChange={(nextValue, nextEditorStateJson) =>
                                ruleForm.setFieldsValue({
                                  bodyTemplate: nextValue,
                                  bodyEditorStateJson: nextEditorStateJson
                                })
                              }
                            />
                          </Form.Item>
                        </Space>
                      </Card>
                    </Space>

                    {!isTemplateMode ? (
                      <div>
                        <div style={{ position: "sticky", top: 0 }}>
                          <Space direction="vertical" style={{ width: "100%" }} size={16}>
                            <IssueQuickNavCard items={quickNavItems} onJump={jumpToRuleSection} />

                            <Card id="rule-section-summary" size="small" title="实时摘要">
                              <Space direction="vertical" style={{ width: "100%" }} size={10}>
                                <Tag color="blue">{ruleForm.getFieldValue("name") || "未命名规则"}</Tag>
                                <Typography.Text type="secondary">页面：{currentPageName}</Typography.Text>
                                <Typography.Text type="secondary">
                                  提示模式：{watchedPromptMode ? promptModeLabelMap[watchedPromptMode] : "-"} / 关闭方式：
                                  {ruleForm.getFieldValue("closeMode") ? closeModeLabel[ruleForm.getFieldValue("closeMode") as RuleDefinition["closeMode"]] : "-"}
                                </Typography.Text>
                                <Typography.Text type="secondary">条件摘要：{conditionSummary}</Typography.Text>
                                <Typography.Text strong>{promptPreviewTitle}</Typography.Text>
                                <div
                                  style={{
                                    border: "1px solid #B2DDFF",
                                    background: "#F8FBFF",
                                    borderRadius: 12,
                                    padding: 16
                                  }}
                                >
                                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                                    {watchedPromptMode === "SILENT" ? (
                                      <Alert
                                        type="info"
                                        showIcon
                                        message="当前仅展示浮窗样式预览"
                                        description="若运行时选择静默提示，实际效果会弱于此处展示。"
                                      />
                                    ) : null}
                                    <div style={{ whiteSpace: "pre-wrap", color: "rgba(0,0,0,0.88)" }}>
                                      {watchedBodyTemplate ? (
                                        <PromptRichPreview
                                          bodyTemplate={watchedBodyTemplate}
                                          bodyEditorStateJson={watchedBodyEditorStateJson}
                                          previewValues={promptPreviewValues}
                                        />
                                      ) : (
                                        "请输入提示正文后查看预览效果。"
                                      )}
                                    </div>
                                    <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                                      <Button disabled>取消</Button>
                                      <Button type="primary" disabled>
                                        确定
                                      </Button>
                                    </Space>
                                  </Space>
                                </div>
                                <Typography.Text type="secondary">
                                  状态：草稿（发布后生效），组织范围：{ownerOrgLabel}
                                </Typography.Text>
                              </Space>
                            </Card>

                            <ValidationReportPanel report={saveValidationReport} title="保存前检查结果" />

                            {previewResult ? (
                              <Alert
                                showIcon
                                type={previewResult.matched ? "success" : "info"}
                                message={previewResult.matched ? "预览通过" : "预览提示"}
                                description={previewResult.detail}
                              />
                            ) : (
                              <CompactHint tone="info" title="建议先执行一次预览" description="保存前先检查提示展示效果与规则表达是否符合预期。" />
                            )}
                          </Space>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              },
              {
                key: "logic",
                label: isTemplateMode ? "模板条件" : "条件配置",
                children: (
                  <Space direction="vertical" style={{ width: "100%" }} size={16}>
                    {!isTemplateMode ? (
                      <CompactHint
                        tone="info"
                        title="条件配置是高频操作区"
                        description="后续修改规则时，可直接进入此页签调整命中逻辑。"
                      />
                    ) : null}
                    <Card
                      id="rule-section-logic"
                      size="small"
                      title={isTemplateMode ? "模板条件" : "条件配置"}
                      extra={
                        editing ? (
                          <Space>
                            <Tooltip title="新增条件">
                              <Button icon={<PlusOutlined />} onClick={addCondition} />
                            </Tooltip>
                            <Button type="primary" loading={savingQuery} onClick={() => void saveConditionLogic()}>
                              保存条件逻辑
                            </Button>
                          </Space>
                        ) : null
                      }
                    >
                      {renderLogicEditorContent()}
                    </Card>
                  </Space>
                )
              }
            ]}
          />
        </Form>
      </Modal>

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


