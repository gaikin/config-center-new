import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message
} from "antd";
import { DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
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
import { buildDefaultListLookupMatcher, FlatConditionDraft, InterfaceInputParamDraft, ListLookupMatcherDraft, LOGIC_OPERATOR_WIDTH, OperandDraft, defaultInterfaceInputBinding, deriveMachineKeyFromOutputPath, interfaceInputSourceOptions, normalizeLookupSourceType, normalizeOperator, normalizeSourceType, closeModeLabel, contextOptions, listLookupSourceOptions, operatorOptions, sourceOptions, statusColor } from "./rulesPageShared";
import { OperandPill, InterfaceInputValueEditor } from "./rulesOperandRenderers";
import type { LifecycleState, PublishValidationReport, RuleDefinition, RuleLogicType, ValidationIssue } from "../../types";

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

type RuleListStatusFilter = "ALL" | LifecycleState;

const PageHeader = styled.div`
  margin-bottom: var(--space-16);
`;

const SummaryCard = styled(Card)<{ $accent: string }>`
  height: 100%;

  &::before {
    content: "";
    display: block;
    height: 4px;
    background: ${({ $accent }) => $accent};
  }

  .ant-card-body {
    padding-top: 14px;
  }
`;

const ToolbarCard = styled(Card)`
  margin-bottom: 12px;
`;

const ActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
`;

const EditorStatusBar = styled(Card)`
  margin-bottom: 12px;

  .ant-card-body {
    padding: 10px 12px;
  }
`;

const StickyEditorFooter = styled.div`
  position: sticky;
  bottom: 0;
  z-index: 12;
  margin: 12px -24px -24px;
  padding: 10px 24px 14px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
  box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.08);
`;

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
          border: "#D0D5DD",
          background: "#F8FAFC",
          text: "#344054"
        }
      : tone === "info"
        ? {
            border: "#7CB2F8",
            background: "#EAF4FF",
            text: "#175CD3"
          }
        : {
            border: "#F3C969",
            background: "#FFF7E6",
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
          <Tag
            color={tone === "info" ? "processing" : tone === "warning" ? "warning" : undefined}
            style={
              tone === "success"
                ? { marginInlineEnd: 0, borderColor: "#D0D5DD", background: "#F9FAFB", color: "#344054" }
                : { marginInlineEnd: 0 }
            }
          >
            {tone === "success" ? "已配置" : tone === "info" ? "说明" : "待处理"}
          </Tag>
          <Typography.Text style={{ color: palette.text }}>{title}</Typography.Text>
          {description ? <Typography.Text style={{ color: "#344054" }}>{description}</Typography.Text> : null}
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
  const { hasResource } = useMockSession();
  const [msgApi, msgHolder] = message.useMessage();
  const isTemplateMode = mode === "TEMPLATE";
  const pageTitle = isTemplateMode ? "模板复用" : "智能提示";
  const pageDescription = isTemplateMode
    ? "沉淀高复用规则模板。模板仅引用公共字段，供业务人员在新建页面规则时快速套用。"
    : "规则配置以页面规则为主；新建时可快速复用模板，自动带入条件与提示配置，无需先专门建立模板。保存后可直接发布当前对象。";
  const createButtonLabel = isTemplateMode ? "新建模板" : "新建规则";
  const modalTitle = editing ? (isTemplateMode ? "编辑规则模板" : "编辑规则") : isTemplateMode ? "新建规则模板" : "新建规则";
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
  const [keyword, setKeyword] = useState("");
  const [listStatusFilter, setListStatusFilter] = useState<RuleListStatusFilter>("ALL");
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
    ? getEffectivePermissionBlockedMessage(effectiveMeta.type, hasResource)
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
  const keywordValue = keyword.trim().toLowerCase();
  const displayedRows = useMemo(() => {
    return rows.filter((row) => {
      if (listStatusFilter !== "ALL" && row.status !== listStatusFilter) {
        return false;
      }
      if (!keywordValue) {
        return true;
      }
      const pageName = (row.pageResourceName ?? "").toLowerCase();
      const sourceTemplate = (row.sourceRuleName ?? "").toLowerCase();
      return (
        row.name.toLowerCase().includes(keywordValue) ||
        pageName.includes(keywordValue) ||
        sourceTemplate.includes(keywordValue)
      );
    });
  }, [keywordValue, listStatusFilter, rows]);
  const rowSummary = useMemo(() => {
    const total = rows.length;
    const draft = rows.filter((item) => item.status === "DRAFT").length;
    const active = rows.filter((item) => item.status === "ACTIVE").length;
    const disabled = rows.filter((item) => item.status === "DISABLED").length;
    return { total, draft, active, disabled };
  }, [rows]);
  Form.useWatch([], ruleForm);
  const hasUnsavedEdits = open && ruleForm.isFieldsTouched(true);
  const editorIssues = useMemo<ValidationIssue[]>(
    () => [
      ...(saveValidationReport?.fieldIssues ?? []),
      ...(saveValidationReport?.sectionIssues ?? []),
      ...(saveValidationReport?.objectIssues ?? []),
      ...logicValidationIssues
    ],
    [logicValidationIssues, saveValidationReport?.fieldIssues, saveValidationReport?.objectIssues, saveValidationReport?.sectionIssues]
  );
  const editorBlockingCount = useMemo(
    () => editorIssues.filter((issue) => issue.level === "blocking").length,
    [editorIssues]
  );
  const editorWarningCount = useMemo(
    () => editorIssues.filter((issue) => issue.level === "warning").length,
    [editorIssues]
  );
  const editorIssueShortcuts = useMemo(
    () =>
      editorIssues.slice(0, 6).map((issue) => ({
        key: issue.key,
        issue,
        label: issue.kind === "field" ? issue.label : issue.title
      })),
    [editorIssues]
  );
  const logicBlockingCount = useMemo(
    () => logicValidationIssues.filter((issue) => issue.level === "blocking").length,
    [logicValidationIssues]
  );
  const logicWarningCount = useMemo(
    () => logicValidationIssues.filter((issue) => issue.level === "warning").length,
    [logicValidationIssues]
  );
  const saveBlockingCount = saveValidationReport?.blockingCount ?? 0;
  const saveWarningCount = saveValidationReport?.warningCount ?? 0;
  const hasSaveIssues = saveBlockingCount + saveWarningCount > 0;

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

  function focusLogicIssue(field?: string) {
    setActiveEditorTab("logic");
    const matched = field?.match(/^(\d+):(left|right):/);
    if (!matched) {
      window.setTimeout(() => {
        document.getElementById("rule-section-logic")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return;
    }
    const conditionIndex = Number(matched[1]);
    const side = matched[2] as "left" | "right";
    const condition = conditionsDraft[conditionIndex];
    if (!condition) {
      return;
    }
    setSelectedOperand({ conditionId: condition.id, side });
    window.setTimeout(() => {
      document.getElementById(`logic-condition-${condition.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  function jumpToIssue(issue: ValidationIssue) {
    if (issue.section === "logic") {
      focusLogicIssue(issue.kind === "field" ? issue.field : undefined);
      return;
    }

    const sectionToTab: Record<string, string> = {
      page: "basic",
      basic: "basic",
      content: "prompt",
      confirm: "summary"
    };
    const targetSection = sectionToTab[issue.section] ?? issue.section;
    jumpToRuleSection(targetSection);

    if (issue.kind === "field") {
      const fieldName = issue.field as string;
      if (fieldName && !fieldName.includes(":")) {
        window.setTimeout(() => {
          ruleForm.scrollToField(fieldName, { block: "center" });
        }, 120);
      }
    }
  }

  function openRuleEditorTab(row: RuleDefinition, tab: "basic" | "logic") {
    setPendingOpenTab(tab);
    openEdit(row);
  }

  function buildRowMenuItems(row: RuleDefinition): MenuProps["items"] {
    return [
      {
        key: "basic",
        label: "基础配置",
        icon: <EditOutlined />,
        onClick: () => openRuleEditorTab(row, "basic")
      },
      {
        key: "logic",
        label: "条件配置",
        icon: <MoreOutlined />,
        onClick: () => openRuleEditorTab(row, "logic")
      }
    ];
  }

  function resetListFilters() {
    setKeyword("");
    setListStatusFilter("ALL");
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
        <Space direction="vertical" size={10} style={{ width: "100%", marginBottom: 12 }}>
          <Typography.Text style={{ color: "#475467" }}>
            左侧维护条件链路，右侧编辑当前选中值的来源与取值。
          </Typography.Text>
          {logicValidationIssues.length > 0 ? (
            <Collapse
              size="small"
              defaultActiveKey={logicBlockingCount > 0 ? ["logic-validation"] : []}
              items={[
                {
                  key: "logic-validation",
                  label: `条件检查：阻塞 ${logicBlockingCount} / 警告 ${logicWarningCount}`,
                  children: <ValidationReportPanel issues={logicValidationIssues} title="条件配置检查结果" />
                }
              ]}
            />
          ) : (
            <CompactHint tone="success" title="条件检查通过" description="当前条件配置无待处理问题。" />
          )}
        </Space>

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
              {conditionsDraft.map((condition, index) => {
                const issueCount = logicValidationIssues.filter((issue) => issue.field.startsWith(`${index}:`)).length;
                const isSelected = selectedOperand?.conditionId === condition.id;
                return (
                <Card
                  key={condition.id}
                  id={`logic-condition-${condition.id}`}
                  size="small"
                  style={{
                    borderColor: issueCount > 0 ? "#ffccc7" : isSelected ? "var(--cc-source-selected, #84CAFF)" : "#f0f0f0",
                    background: isSelected ? "#f7fbff" : "#fff"
                  }}
                  bodyStyle={{ padding: 12 }}
                >
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Space size={[8, 4]} wrap style={{ width: "100%", justifyContent: "space-between" }}>
                      <Space size={[8, 4]} wrap>
                        <Tag color="blue">条件 {index + 1}</Tag>
                        {issueCount > 0 ? <Tag color="error">问题 {issueCount}</Tag> : null}
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
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
                        alignItems: "center",
                        gap: 8,
                        width: "100%"
                      }}
                    >
                      <div style={{ minWidth: 0, border: "1px solid #d9e8ff", borderRadius: 8, padding: "6px 8px", background: "#fff" }}>
                        <Tag color="processing" style={{ marginInlineEnd: 8 }}>左值</Tag>
                        <OperandPill conditionId={condition.id} side="left" operand={condition.left} selectedOperand={selectedOperand} onSelect={setSelectedOperand} />
                      </div>
                      <Select
                        style={{ width: LOGIC_OPERATOR_WIDTH, minWidth: LOGIC_OPERATOR_WIDTH, maxWidth: LOGIC_OPERATOR_WIDTH }}
                        value={condition.operator}
                        options={operatorOptions}
                        onChange={(value) =>
                          updateCondition(condition.id, (previous) => ({ ...previous, operator: normalizeOperator(value) }))
                        }
                      />
                      <div style={{ minWidth: 0, border: "1px solid #d9e8ff", borderRadius: 8, padding: "6px 8px", background: "#fff" }}>
                        <Tag color="processing" style={{ marginInlineEnd: 8 }}>右值</Tag>
                        {condition.operator === "EXISTS" ? (
                          <Tag>无需右值</Tag>
                        ) : (
                          <OperandPill conditionId={condition.id} side="right" operand={condition.right} selectedOperand={selectedOperand} onSelect={setSelectedOperand} />
                        )}
                      </div>
                    </div>
                  </Space>
                </Card>
                );
              })}
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

                <PanelField label="来源类型">
                  <Select
                    style={{ width: "100%" }}
                    value={selectedContext.operand.sourceType}
                    options={sourceOptions}
                    onChange={(value) => changeSelectedSourceType(normalizeSourceType(value))}
                  />
                </PanelField>

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
                        onChange={(value) => {
                          const nextPath = (value as string) ?? "";
                          updateSelectedOperand({
                            outputPath: nextPath,
                            machineKey: deriveMachineKeyFromOutputPath(nextPath)
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
                              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                <Typography.Text type="secondary">
                                  API注册仅定义入参契约；来源与取值映射在智能提示中按规则单独配置。
                                </Typography.Text>
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
                                          {row.validationConfig.required ? <Tag color="error">必填</Tag> : <Tag>可选</Tag>}
                                        </Space>
                                      )
                                    },
                                    {
                                      title: "来源",
                                      width: 140,
                                      render: (_, row) => {
                                        const binding = selectedInterfaceInputConfig[row.name] ?? defaultInterfaceInputBinding();
                                        return (
                                          <Select
                                            size="small"
                                            value={binding.sourceType}
                                            options={interfaceInputSourceOptions}
                                            onChange={(value) =>
                                              updateInterfaceInputValue(row.name, {
                                                sourceType: value,
                                                sourceValue: ""
                                              })
                                            }
                                          />
                                        );
                                      }
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
                                          binding={selectedInterfaceInputConfig[row.name] ?? defaultInterfaceInputBinding()}
                                          pageFieldOptions={pageFieldOptions}
                                          updateInterfaceInputValue={updateInterfaceInputValue}
                                        />
                                      )
                                    }
                                  ]}
                                />
                              </Space>
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
    const permissionBlocked = getEffectivePermissionBlockedMessage(action.type, hasResource);
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
        <PageHeader>
          <Typography.Title level={4}>{pageTitle}</Typography.Title>
          <Typography.Paragraph type="secondary">{pageDescription}</Typography.Paragraph>
        </PageHeader>
      ) : null}

      {publishNotice ? (
        <PublishContinuationAlert
          objectLabel={publishNotice.objectLabel}
          objectName={publishNotice.objectName}
          warningCount={publishNotice.warningCount}
          actionLabel={getEffectiveActionMeta("DRAFT").label}
          actionDisabled={Boolean(getEffectivePermissionBlockedMessage("PUBLISH", hasResource))}
          actionDisabledReason={getEffectivePermissionBlockedMessage("PUBLISH", hasResource) ?? undefined}
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

      {!embedded ? (
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={24} sm={12} xl={6}>
            <SummaryCard $accent="linear-gradient(90deg, #2465f2 0%, #58a2ff 100%)">
              <Statistic title={isTemplateMode ? "模板总数" : "规则总数"} value={rowSummary.total} />
            </SummaryCard>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <SummaryCard $accent="linear-gradient(90deg, #8f55ed 0%, #bf8bff 100%)">
              <Statistic title="草稿" value={rowSummary.draft} />
            </SummaryCard>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <SummaryCard $accent="linear-gradient(90deg, #16945f 0%, #47b983 100%)">
              <Statistic title="已生效" value={rowSummary.active} />
            </SummaryCard>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <SummaryCard $accent="linear-gradient(90deg, #ce7f27 0%, #e9b15b 100%)">
              <Statistic title="已停用" value={rowSummary.disabled} />
            </SummaryCard>
          </Col>
        </Row>
      ) : null}

      <ToolbarCard>
        <Row gutter={[10, 10]} align="middle">
          <Col xs={24} lg={10}>
            <Input.Search
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={isTemplateMode ? "搜索模板名称" : "搜索规则名称、页面资源或来源模板"}
            />
          </Col>
          <Col xs={24} lg={14}>
            <ActionBar>
              <Segmented
                value={listStatusFilter}
                onChange={(value) => setListStatusFilter(value as RuleListStatusFilter)}
                options={[
                  { label: "全部", value: "ALL" },
                  { label: "草稿", value: "DRAFT" },
                  { label: "生效", value: "ACTIVE" },
                  { label: "停用", value: "DISABLED" },
                  { label: "过期", value: "EXPIRED" }
                ]}
              />
              <Button onClick={resetListFilters}>重置筛选</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} aria-label="create-rule">
                {createButtonLabel}
              </Button>
            </ActionBar>
          </Col>
        </Row>
      </ToolbarCard>

      <Card
        extra={<Typography.Text type="secondary">当前展示 {displayedRows.length} 条</Typography.Text>}
      >
        <Table<RuleDefinition>
          rowKey="id"
          loading={loading}
          dataSource={displayedRows}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
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
              width: 250,
              render: (_, row) => {
                const actionMeta = getEffectiveActionMeta(row.status);
                const actionBlocked = getEffectivePermissionBlockedMessage(actionMeta.type, hasResource);
                return (
                  <Space>
                    <Button size="small" onClick={() => openRuleEditorTab(row, "basic")}>
                      编辑
                    </Button>
                    <Dropdown menu={{ items: buildRowMenuItems(row) }} trigger={["click"]}>
                      <Button size="small" icon={<MoreOutlined />}>
                        更多
                      </Button>
                    </Dropdown>
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
        footer={null}
      >
        <Form form={ruleForm} layout="vertical">
          <Form.Item hidden name="ruleScope">
            <Input />
          </Form.Item>

          <EditorStatusBar size="small">
            <Space align="center" size={[8, 8]} wrap style={{ width: "100%", justifyContent: "space-between" }}>
              <Space size={[8, 4]} wrap>
                {hasUnsavedEdits ? (
                  <Tag color="warning">未保存更改</Tag>
                ) : (
                  <Tag style={{ borderColor: "#D0D5DD", background: "#F9FAFB", color: "#344054" }}>内容已保存</Tag>
                )}
                <Tag color={editorBlockingCount > 0 ? "error" : "default"}>阻塞 {editorBlockingCount}</Tag>
                <Tag color={editorWarningCount > 0 ? "warning" : "default"}>警告 {editorWarningCount}</Tag>
                <Typography.Text type="secondary">
                  {editorBlockingCount > 0 ? "请先处理阻塞问题后再保存。" : "可直接保存；建议同步处理提示项。"}
                </Typography.Text>
              </Space>
              {editorIssueShortcuts.length > 0 ? (
                <Space size={[6, 6]} wrap>
                  {editorIssueShortcuts.map((item) => (
                    <Button key={item.key} size="small" onClick={() => jumpToIssue(item.issue)}>
                      {item.label}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">暂无待定位问题</Typography.Text>
              )}
            </Space>
          </EditorStatusBar>

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
                          <Form.Item name="sceneId" label="关联作业场景（可选）" extra="可联动作业；不配置时仅关闭提示。">
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
                                <Typography.Text style={{ color: "#475467" }}>页面：{currentPageName}</Typography.Text>
                                <Typography.Text style={{ color: "#475467" }}>
                                  提示模式：{watchedPromptMode ? promptModeLabelMap[watchedPromptMode] : "-"} / 关闭方式：
                                  {ruleForm.getFieldValue("closeMode") ? closeModeLabel[ruleForm.getFieldValue("closeMode") as RuleDefinition["closeMode"]] : "-"}
                                </Typography.Text>
                                <Typography.Text style={{ color: "#475467" }}>条件摘要：{conditionSummary}</Typography.Text>
                                <Typography.Text strong>{promptPreviewTitle}</Typography.Text>
                                <div
                                  style={{
                                    border: "1px solid #B8D7FF",
                                    background: "#F4F9FF",
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

                            {hasSaveIssues ? (
                              <Collapse
                                size="small"
                                defaultActiveKey={saveBlockingCount > 0 ? ["save-validation"] : []}
                                items={[
                                  {
                                    key: "save-validation",
                                    label: `保存检查：阻塞 ${saveBlockingCount} / 警告 ${saveWarningCount}`,
                                    children: <ValidationReportPanel report={saveValidationReport} title="保存前检查结果" />
                                  }
                                ]}
                              />
                            ) : (
                              <CompactHint tone="success" title="保存检查通过" description="当前无阻塞项，可直接保存。" />
                            )}

                            {previewResult ? (
                              <Alert
                                showIcon
                                type={previewResult.matched ? "success" : "info"}
                                message={previewResult.matched ? "预览通过" : "预览提示"}
                                description={previewResult.detail}
                              />
                            ) : (
                              <Typography.Text style={{ color: "#475467" }}>
                                建议执行一次预览，确认提示展示效果与规则表达。
                              </Typography.Text>
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

          <StickyEditorFooter>
            <Space align="center" size={[8, 8]} wrap style={{ width: "100%", justifyContent: "space-between" }}>
              <Space size={[8, 4]} wrap>
                {editorBlockingCount > 0 ? (
                  <Tag color="error">存在 {editorBlockingCount} 个阻塞问题</Tag>
                ) : (
                  <Tag style={{ borderColor: "#D0D5DD", background: "#F9FAFB", color: "#344054" }}>保存校验通过</Tag>
                )}
                {editorWarningCount > 0 ? <Tag color="warning">提示 {editorWarningCount}</Tag> : null}
              </Space>
              <Space>
                <Button onClick={closeRuleModal}>取消</Button>
                {!isTemplateMode ? (
                  <Button loading={previewLoading} onClick={() => void runWizardPreview()}>
                    执行预览
                  </Button>
                ) : null}
                <Button type="primary" onClick={() => void submitRule()}>
                  {isTemplateMode ? "保存" : "保存规则"}
                </Button>
              </Space>
            </Space>
          </StickyEditorFooter>
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


