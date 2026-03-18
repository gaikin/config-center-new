import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message
} from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined, InfoCircleOutlined, MoreOutlined, PartitionOutlined, PlusOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styled from "styled-components";
import { EffectiveConfirmModal } from "../../components/EffectiveConfirmModal";
import { PublishContinuationAlert } from "../../components/PublishContinuationAlert";
import { ValidationReportPanel } from "../../components/ValidationReportPanel";
import { EffectiveScopeMode, getEffectiveActionMeta, getEffectivePermissionBlockedMessage, getPublishValidationByResource } from "../../effectiveFlow";
import { lifecycleLabelMap } from "../../enumLabels";
import { orgOptions } from "../../orgOptions";
import { useMockSession } from "../../session/mockSession";
import { useJobScenesPageModel } from "./useJobScenesPageModel";
import {
  buildExecutionMode,
  derivePreviewBeforeExecute,
  deriveTriggerMode,
  getRunModeLabel,
  getTriggerModeLabel,
  nodeTypeLabel,
  StatusFilter,
  type TriggerMode
} from "./jobScenesPageShared";
import type { ExecutionMode, JobSceneDefinition, JobScenePreviewField, LifecycleState, PublishValidationReport } from "../../types";

type EffectiveTarget = {
  id: number;
  name: string;
  status: LifecycleState;
  source: "row" | "notice";
};

const DEFAULT_FLOATING_BUTTON_LABEL = "重新执行";
const DEFAULT_FLOATING_BUTTON_X = 86;
const DEFAULT_FLOATING_BUTTON_Y = 78;

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

const SceneTypeCard = styled(Card)`
  margin-bottom: 12px;
`;

const ScenePresetCard = styled(Card)`
  width: 320px;
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

export function JobScenesPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const {
    holder,
    statusFilter,
    setStatusFilter,
    filteredRows,
    openCreate,
    openEdit,
    switchStatus,
    openBuilder,
    openPreview,
    loading,
    linkedRulesByScene,
    open,
    closeSceneModal,
    submitScene,
    form,
    resources,
    editing,
    builderOpen,
    closeBuilder,
    savingFlow,
    saveFlowLayout,
    autoLayoutNodes,
    builderScene,
    setSelectedNodeId,
    flowNodes,
    flowEdges,
    onFlowNodesChange,
    onFlowEdgesChange,
    onConnect,
    setReactFlowInstance,
    nodeLibrary,
    addNodeFromLibrary,
    selectedNode,
    selectedNodeListData,
    listDatas,
    nodeDetailForm,
    watchedNodeType,
    saveSelectedNode,
    removeSelectedNode,
    previewOpen,
    setPreviewOpen,
    previewScene,
    previewRows,
    previewSelectedKeys,
    setPreviewSelectedKeys,
    previewLoading,
    previewExecuting,
    executePreview,
    drawerWidth,
    statusColor,
    autoOpenCreateRef,
    sceneSaveValidationReport,
    nodeValidationIssues,
    previewValidationIssues,
    publishNotice,
    dismissPublishNotice,
    publishSceneNow,
    restoreSceneNow
  } = useJobScenesPageModel();
  const { hasResource } = useMockSession();
  const [msgApi, msgHolder] = message.useMessage();
  const [effectiveTarget, setEffectiveTarget] = useState<EffectiveTarget | null>(null);
  const [effectiveLoading, setEffectiveLoading] = useState(false);
  const [effectiveSubmitting, setEffectiveSubmitting] = useState(false);
  const [effectiveValidationReport, setEffectiveValidationReport] = useState<PublishValidationReport | null>(null);
  const [effectiveBlockedMessage, setEffectiveBlockedMessage] = useState<string | null>(null);
  const [effectiveScopeMode, setEffectiveScopeMode] = useState<EffectiveScopeMode>("ALL_ORGS");
  const [effectiveScopeOrgIds, setEffectiveScopeOrgIds] = useState<string[]>([]);
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
    (effectiveMeta?.type !== "PUBLISH" || Boolean(effectiveValidationReport?.pass)) &&
    (effectiveMeta?.type !== "PUBLISH" || effectiveScopeMode !== "CUSTOM_ORGS" || effectiveScopeOrgIds.length > 0) &&
    !modalBlockedMessage;
  const [searchParams] = useSearchParams();
  const pageResourceFilter = Number(searchParams.get("pageResourceId") ?? "");
  const executionModeParam = searchParams.get("executionMode");
  const sceneNameParam = searchParams.get("sceneName");
  const quickAction = searchParams.get("action");
  const hasPageFilter = Number.isFinite(pageResourceFilter) && pageResourceFilter > 0;
  const presetPageName = resources.find((item) => item.id === pageResourceFilter)?.name;
  const presetExecutionMode = (
    executionModeParam === "AUTO_WITHOUT_PROMPT" ||
    executionModeParam === "AUTO_AFTER_PROMPT" ||
    executionModeParam === "PREVIEW_THEN_EXECUTE" ||
    executionModeParam === "FLOATING_BUTTON"
  )
    ? executionModeParam
    : undefined;

  useEffect(() => {
    if (!hasPageFilter || quickAction !== "create" || autoOpenCreateRef.current) {
      return;
    }
    autoOpenCreateRef.current = true;
    openCreate({
      pageResourceId: pageResourceFilter,
      executionMode: presetExecutionMode,
      name: sceneNameParam ?? undefined
    });
  }, [autoOpenCreateRef, hasPageFilter, openCreate, pageResourceFilter, presetExecutionMode, quickAction, sceneNameParam]);

  const visibleRows = useMemo(() => {
    if (!hasPageFilter) {
      return filteredRows;
    }
    return filteredRows.filter((item) => item.pageResourceId === pageResourceFilter);
  }, [filteredRows, hasPageFilter, pageResourceFilter]);
  const keywordValue = keyword.trim().toLowerCase();
  const searchedRows = useMemo(() => {
    if (!keywordValue) {
      return visibleRows;
    }
    return visibleRows.filter((item) => {
      return item.name.toLowerCase().includes(keywordValue) || item.pageResourceName.toLowerCase().includes(keywordValue);
    });
  }, [keywordValue, visibleRows]);
  const sceneSummary = useMemo(() => {
    const total = visibleRows.length;
    const draft = visibleRows.filter((item) => item.status === "DRAFT").length;
    const active = visibleRows.filter((item) => item.status === "ACTIVE").length;
    const disabled = visibleRows.filter((item) => item.status === "DISABLED").length;
    return { total, draft, active, disabled };
  }, [visibleRows]);
  const watchedExecutionMode = Form.useWatch("executionMode", form) as ExecutionMode | undefined;
  const watchedPreviewBeforeExecute = Form.useWatch("previewBeforeExecute", form) as boolean | undefined;
  const watchedFloatingButtonEnabled = Form.useWatch("floatingButtonEnabled", form) as boolean | undefined;
  const selectedTriggerMode: TriggerMode = watchedExecutionMode ? deriveTriggerMode(watchedExecutionMode) : "AUTO";
  const selectedPreviewBeforeExecute = Boolean(watchedPreviewBeforeExecute);
  const floatingRetriggerEnabled = selectedTriggerMode === "BUTTON" || Boolean(watchedFloatingButtonEnabled);
  const linkedFloatingPromptRules = useMemo(() => {
    if (!editing?.id) {
      return [] as Array<{ id: number; name: string }>;
    }
    return (linkedRulesByScene.get(editing.id) ?? [])
      .filter((rule) => rule.promptMode === "FLOATING")
      .map((rule) => ({ id: rule.id, name: rule.name }));
  }, [editing?.id, linkedRulesByScene]);
  const promptPriorityConflict = watchedExecutionMode === "AUTO_WITHOUT_PROMPT" && linkedFloatingPromptRules.length > 0;
  const currentSceneStatus: LifecycleState = editing?.status ?? "DRAFT";

  const sceneCards = [
    {
      key: "auto-run",
      title: "自动执行",
      desc: "提示完成后自动进入作业流程，默认直接执行，可选预览确认。",
      mode: "AUTO_AFTER_PROMPT" as const
    },
    {
      key: "button-run",
      title: "按钮触发",
      desc: "提示完成后展示悬浮按钮，用户点击后再执行。",
      mode: "FLOATING_BUTTON" as const
    }
  ];

  function buildRowMenuItems(row: JobSceneDefinition): MenuProps["items"] {
    return [
      {
        key: "edit",
        label: "编辑",
        icon: <EditOutlined />,
        onClick: () => openEdit(row)
      },
      {
        key: "builder",
        label: "作业编排",
        icon: <PartitionOutlined />,
        onClick: () => void openBuilder(row)
      },
      {
        key: "preview",
        label: "预览确认",
        icon: <EyeOutlined />,
        onClick: () => void openPreview(row)
      }
    ];
  }

  function resetListFilters() {
    setKeyword("");
    setStatusFilter("ALL");
  }

  async function openEffectiveAction(target: EffectiveTarget) {
    const action = getEffectiveActionMeta(target.status);
    const permissionBlocked = getEffectivePermissionBlockedMessage(action.type, hasResource);
    if (permissionBlocked) {
      msgApi.warning(permissionBlocked);
      return;
    }

    setEffectiveTarget(target);
    setEffectiveLoading(false);
    setEffectiveValidationReport(null);
    setEffectiveBlockedMessage(null);
    setEffectiveScopeMode("ALL_ORGS");
    setEffectiveScopeOrgIds([]);

    if (action.type !== "PUBLISH") {
      return;
    }
    setEffectiveLoading(true);
    try {
      const validation = await getPublishValidationByResource("JOB_SCENE", target.id);
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
        const success = await publishSceneNow(
          effectiveTarget.id,
          effectiveTarget.name,
          effectiveScopeMode === "CUSTOM_ORGS" ? effectiveScopeOrgIds : []
        );
        if (!success) {
          const validation = await getPublishValidationByResource("JOB_SCENE", effectiveTarget.id);
          setEffectiveValidationReport(validation?.report ?? null);
          return;
        }
      } else {
        const row = visibleRows.find((item) => item.id === effectiveTarget.id) ?? filteredRows.find((item) => item.id === effectiveTarget.id);
        if (!row) {
          msgApi.warning("对象状态已变化，请刷新后重试。");
          return;
        }
        if (effectiveMeta.type === "RESTORE") {
          const restored = await restoreSceneNow(
            row,
            effectiveScopeMode === "CUSTOM_ORGS" ? effectiveScopeOrgIds : []
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
    } finally {
      setEffectiveSubmitting(false);
    }
  }

  return (
    <div>
      {holder}
      {msgHolder}
      <PageHeader>
        <Typography.Title level={4}>智能作业</Typography.Title>
      </PageHeader>
      {publishNotice ? (
        <PublishContinuationAlert
          objectLabel="作业场景"
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
      {hasPageFilter ? (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          message={`已切换到页面：${presetPageName ?? "当前页面"}`}
        />
      ) : null}

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard $accent="linear-gradient(90deg, #2465f2 0%, #58a2ff 100%)">
            <Statistic title="作业场景总数" value={sceneSummary.total} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard $accent="linear-gradient(90deg, #8f55ed 0%, #bf8bff 100%)">
            <Statistic title="草稿场景" value={sceneSummary.draft} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard $accent="linear-gradient(90deg, #16945f 0%, #47b983 100%)">
            <Statistic title="已启用" value={sceneSummary.active} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard $accent="linear-gradient(90deg, #ce7f27 0%, #e9b15b 100%)">
            <Statistic title="已停用" value={sceneSummary.disabled} />
          </SummaryCard>
        </Col>
      </Row>

      <SceneTypeCard title="场景类型（业务视角）">
        <Space size={[8, 8]} wrap>
          {sceneCards.map((item) => (
            <ScenePresetCard key={item.key} size="small" title={item.title}>
              <Space direction="vertical">
                <Typography.Text type="secondary">{item.desc}</Typography.Text>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    openCreate({
                      pageResourceId: hasPageFilter ? pageResourceFilter : undefined,
                      executionMode: item.mode,
                      name: sceneNameParam ?? `${item.title}-${new Date().getTime()}`
                    })
                  }
                >
                  按该场景创建
                </Button>
              </Space>
            </ScenePresetCard>
          ))}
        </Space>
      </SceneTypeCard>

      <ToolbarCard>
        <Row gutter={[10, 10]} align="middle">
          <Col xs={24} lg={9}>
            <Input.Search
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索场景名称或所属页面"
            />
          </Col>
          <Col xs={24} lg={15}>
            <ActionBar>
              <Segmented
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                options={[
                  { label: "全部", value: "ALL" },
                  { label: "草稿", value: "DRAFT" },
                  { label: "启用", value: "ACTIVE" },
                  { label: "停用", value: "DISABLED" },
                  { label: "过期", value: "EXPIRED" }
                ]}
              />
              <Button onClick={resetListFilters}>重置筛选</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  openCreate({
                    pageResourceId: hasPageFilter ? pageResourceFilter : undefined,
                    executionMode: presetExecutionMode,
                    name: sceneNameParam ?? undefined
                  })
                }
                aria-label="create-scene"
              >
                新建场景
              </Button>
            </ActionBar>
          </Col>
        </Row>
      </ToolbarCard>

      <Card
        extra={<Typography.Text type="secondary">当前展示 {searchedRows.length} 项</Typography.Text>}
      >
        <Table<JobSceneDefinition>
          rowKey="id"
          loading={loading}
          dataSource={searchedRows}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
          columns={[
            { title: "场景名称", dataIndex: "name", width: 220 },
            { title: "所属页面", dataIndex: "pageResourceName", width: 160 },
            {
              title: "执行策略",
              width: 280,
              render: (_, row) => {
                const triggerMode = deriveTriggerMode(row.executionMode);
                const previewBeforeExecute = derivePreviewBeforeExecute(row);
                const floatingEnabled = row.floatingButtonEnabled ?? row.executionMode === "FLOATING_BUTTON";
                const shouldShowRetriggerTag = triggerMode === "AUTO" && floatingEnabled;
                const isDefault = triggerMode === "AUTO" && !previewBeforeExecute && !shouldShowRetriggerTag;
                if (isDefault) {
                  return null;
                }
                return (
                  <Space size={[6, 4]} wrap>
                    {triggerMode === "BUTTON" ? <Tag color="blue">按钮触发</Tag> : null}
                    {previewBeforeExecute ? <Tag color="gold">预览确认</Tag> : null}
                    {shouldShowRetriggerTag ? <Tag color="processing">补充按钮</Tag> : null}
                  </Space>
                );
              }
            },
            {
              title: "触发关联",
              width: 240,
              render: (_, row) => {
                const linkedRules = linkedRulesByScene.get(row.id) ?? [];
                if (linkedRules.length === 0) {
                  return <Typography.Text type="secondary">未关联规则</Typography.Text>;
                }
                return (
                  <Space size={[4, 4]} wrap>
                    {linkedRules.map((rule) => (
                      <Tag key={rule.id} color="processing">
                        {rule.name}
                      </Tag>
                    ))}
                  </Space>
                );
              }
            },
            { title: "节点数", dataIndex: "nodeCount", width: 80 },
            { title: "人工基准(秒)", dataIndex: "manualDurationSec", width: 120 },
            { title: "状态", width: 100, render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag> },
            {
              title: "操作",
              width: 230,
              render: (_, row) => {
                const actionMeta = getEffectiveActionMeta(row.status);
                const actionBlocked = getEffectivePermissionBlockedMessage(actionMeta.type, hasResource);
                return (
                  <Space wrap>
                    <Button size="small" onClick={() => openEdit(row)}>
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

      <Modal title={editing ? "编辑场景" : "新建场景"} open={open} onCancel={closeSceneModal} onOk={() => void submitScene()} width={680}>
        <Form form={form} layout="vertical">
          <Space size={8} wrap style={{ marginBottom: 12 }}>
            <Tag color="processing">保存即草稿</Tag>
            <Tag color="processing">节点数自动统计</Tag>
            <Typography.Text type="secondary">仅需配置页面与执行方式</Typography.Text>
          </Space>
          <ValidationReportPanel report={sceneSaveValidationReport} title="保存前检查结果" />
          {promptPriorityConflict ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="提示优先：静默执行不会生效"
              description={`当前已关联浮窗提示规则：${linkedFloatingPromptRules
                .map((rule) => rule.name)
                .join("、")}。运行时将按提示配置弹窗。`}
            />
          ) : null}
          <Form.Item name="name" label="场景名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="pageResourceId" label="页面资源" rules={[{ required: true }]}><Select options={resources.map((r) => ({ label: r.name, value: r.id }))} /></Form.Item>
          <Form.Item hidden name="executionMode">
            <Input />
          </Form.Item>
          <Form.Item hidden name="floatingButtonEnabled">
            <Input />
          </Form.Item>
          <Form.Item label="触发方式" required>
            <Segmented
              value={selectedTriggerMode}
              options={[
                { label: "自动执行", value: "AUTO" },
                { label: "按钮触发", value: "BUTTON" }
              ]}
              onChange={(value) => {
                const nextTriggerMode = value as TriggerMode;
                const nextExecutionMode = buildExecutionMode(nextTriggerMode, selectedPreviewBeforeExecute);
                form.setFieldValue("executionMode", nextExecutionMode);
                if (nextTriggerMode === "BUTTON") {
                  form.setFieldValue("floatingButtonEnabled", true);
                  if (!form.getFieldValue("floatingButtonLabel")) {
                    form.setFieldValue("floatingButtonLabel", DEFAULT_FLOATING_BUTTON_LABEL);
                  }
                  if (typeof form.getFieldValue("floatingButtonX") !== "number") {
                    form.setFieldValue("floatingButtonX", DEFAULT_FLOATING_BUTTON_X);
                  }
                  if (typeof form.getFieldValue("floatingButtonY") !== "number") {
                    form.setFieldValue("floatingButtonY", DEFAULT_FLOATING_BUTTON_Y);
                  }
                } else if (form.getFieldValue("floatingButtonEnabled") === undefined) {
                  form.setFieldValue("floatingButtonEnabled", false);
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="previewBeforeExecute"
            label="预览确认"
            valuePropName="checked"
            style={{ marginBottom: 12 }}
          >
            <Switch
              checkedChildren="开启"
              unCheckedChildren="关闭"
              onChange={(checked) => {
                const currentTrigger = deriveTriggerMode((form.getFieldValue("executionMode") as ExecutionMode) ?? "AUTO_AFTER_PROMPT");
                form.setFieldValue("executionMode", buildExecutionMode(currentTrigger, checked));
              }}
            />
          </Form.Item>
          <Form.Item label="悬浮按钮补充入口" style={{ marginBottom: 12 }}>
            <Space align="center" style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text type="secondary">
                用于让用户在主流程完成后重复触发同一作业。
              </Typography.Text>
              <Switch
                checked={floatingRetriggerEnabled}
                disabled={selectedTriggerMode === "BUTTON"}
                onChange={(checked) => {
                  form.setFieldValue("floatingButtonEnabled", checked);
                  if (checked) {
                    if (!form.getFieldValue("floatingButtonLabel")) {
                      form.setFieldValue("floatingButtonLabel", DEFAULT_FLOATING_BUTTON_LABEL);
                    }
                    if (typeof form.getFieldValue("floatingButtonX") !== "number") {
                      form.setFieldValue("floatingButtonX", DEFAULT_FLOATING_BUTTON_X);
                    }
                    if (typeof form.getFieldValue("floatingButtonY") !== "number") {
                      form.setFieldValue("floatingButtonY", DEFAULT_FLOATING_BUTTON_Y);
                    }
                  }
                }}
              />
            </Space>
          </Form.Item>
          {floatingRetriggerEnabled ? (
            <Card
              size="small"
              style={{ marginBottom: 12 }}
              title={
                <Space size={8}>
                  <Typography.Text>悬浮按钮配置</Typography.Text>
                  <Tag color="error">必填</Tag>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <Form.Item
                  name="floatingButtonLabel"
                  label="按钮文案"
                  rules={[{ required: true, message: "请输入按钮文案" }]}
                  style={{ marginBottom: 8 }}
                >
                  <Input maxLength={16} placeholder="如：重新执行" />
                </Form.Item>
                <Space align="start" size={12} wrap>
                  <Form.Item
                    name="floatingButtonX"
                    label="横坐标 X(%)"
                    rules={[{ required: true, message: "请输入X坐标" }]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={0} max={100} precision={0} />
                  </Form.Item>
                  <Form.Item
                    name="floatingButtonY"
                    label="纵坐标 Y(%)"
                    rules={[{ required: true, message: "请输入Y坐标" }]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={0} max={100} precision={0} />
                  </Form.Item>
                </Space>
                <Typography.Text type="secondary">
                  坐标按页面可视区域百分比记录，便于不同分辨率下保持相对位置。
                </Typography.Text>
              </Space>
            </Card>
          ) : (
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
              当前为自动执行，无需配置悬浮按钮。
            </Typography.Text>
          )}
          <Form.Item label="状态">
            <Space size={8} wrap>
              <Tag color={statusColor[currentSceneStatus]}>{lifecycleLabelMap[currentSceneStatus]}</Tag>
              <Typography.Text type="secondary">
                {editing ? "当前线上状态仅展示，保存时会生成草稿版本。" : "新建场景默认为草稿。"}
              </Typography.Text>
              <Tooltip title="状态变更请使用列表中的“立即生效 / 暂停生效 / 恢复生效”操作。">
                <InfoCircleOutlined style={{ color: "var(--text-secondary)" }} />
              </Tooltip>
            </Space>
          </Form.Item>
          <Form.Item name="manualDurationSec" label="人工基准(秒)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={builderScene ? `作业编排: ${builderScene.name}` : "作业编排"}
        placement="right"
        width={drawerWidth}
        open={builderOpen}
        onClose={closeBuilder}
        extra={
          <Space>
            <Button size="small" disabled={!builderScene} onClick={() => (builderScene ? void openPreview(builderScene) : undefined)}>
              打开预览确认
            </Button>
            <Button onClick={autoLayoutNodes}>自动排版</Button>
            <Button loading={savingFlow} onClick={() => void saveFlowLayout()}>保存编排</Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Card title="节点编排区" size="small">
            <div style={{ display: "flex", gap: 12, alignItems: "stretch", overflowX: "auto" }}>
              <Card title="节点库" style={{ flex: "0 0 220px" }}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  {nodeLibrary.map((item) => (
                    <Button
                      key={item.nodeType}
                      block
                      disabled={item.nodeType === "list_lookup" && listDatas.length === 0}
                      onClick={() => void addNodeFromLibrary(item.nodeType)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Space>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  点击节点类型即可加入画布。
                </Typography.Paragraph>
                {listDatas.length === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 12 }}
                    message="名单检索节点暂不可用"
                    description={
                      <Space direction="vertical" size={4}>
                        <Typography.Text type="secondary">请先到高级配置维护名单数据后，再添加名单检索节点。</Typography.Text>
                        <Button size="small" type="primary" onClick={() => navigate("/advanced?tab=list-data")}>
                          去维护名单
                        </Button>
                      </Space>
                    }
                  />
                ) : null}
              </Card>

              <Card title="编排画布" style={{ flex: "1 0 680px", minWidth: 540 }}>
                {flowNodes.length === 0 ? (
                  <Alert type="warning" showIcon message="当前场景暂无节点，请先从左侧节点库添加。" style={{ marginBottom: 12 }} />
                ) : null}
                <div style={{ width: "100%", height: 520, border: "1px solid #f0f0f0", borderRadius: 8 }}>
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      onNodesChange={onFlowNodesChange}
                      onEdgesChange={onFlowEdgesChange}
                      onConnect={onConnect}
                      onInit={(instance) => setReactFlowInstance(instance)}
                      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                      onPaneClick={() => setSelectedNodeId(null)}
                      minZoom={0.15}
                      fitView={flowNodes.length > 0}
                      fitViewOptions={{ padding: 0.1, minZoom: 0.15, maxZoom: 1.2 }}
                    >
                      <MiniMap zoomable pannable />
                      <Controls />
                      <Background />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  拖拽节点调整布局，连线定义执行顺序，点击节点后在右侧编辑属性。
                </Typography.Paragraph>
              </Card>

              <Card title="节点属性" style={{ flex: "0 0 320px", minWidth: 320 }}>
                {!selectedNode ? (
                  <Typography.Text type="secondary">请先在画布中点击一个节点，再编辑节点属性。</Typography.Text>
                ) : (
                  <>
                    <ValidationReportPanel issues={nodeValidationIssues} title="节点属性还有待处理问题" />
                    <Form form={nodeDetailForm} layout="vertical">
                      <Form.Item name="name" label="节点名称" rules={[{ required: true, message: "请输入节点名称" }]}>
                        <Input placeholder="请输入节点名称" />
                      </Form.Item>
                      <Form.Item name="nodeType" label="节点类型" rules={[{ required: true }]}>
                        <Select options={Object.entries(nodeTypeLabel).map(([value, label]) => ({ label, value }))} />
                      </Form.Item>
                      <Form.Item name="enabled" label="启用状态" rules={[{ required: true }]}>
                        <Select options={[{ label: "启用", value: true }, { label: "停用", value: false }]} />
                      </Form.Item>

                      {watchedNodeType === "page_get" ? (
                        <Form.Item name="field" label="读取字段" rules={[{ required: true, message: "请输入字段名" }]}>
                          <Input placeholder="如: customer_id" />
                        </Form.Item>
                      ) : null}

                      {watchedNodeType === "api_call" ? (
                        <>
                          <Form.Item name="interfaceId" label="接口ID" rules={[{ required: true, message: "请输入接口ID" }]}>
                            <InputNumber min={1} style={{ width: "100%" }} />
                          </Form.Item>
                          <Form.Item name="forceFail" label="模拟失败">
                            <Select options={[{ label: "否", value: false }, { label: "是", value: true }]} />
                          </Form.Item>
                        </>
                      ) : null}

                      {watchedNodeType === "list_lookup" ? (
                        listDatas.length === 0 ? (
                          <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 12 }}
                            message="当前没有可用名单数据"
                            description={
                              <Space direction="vertical" size={4}>
                                <Typography.Text type="secondary">名单检索节点依赖名单中心资产，请先维护名单数据。</Typography.Text>
                                <Button size="small" type="primary" onClick={() => navigate("/advanced?tab=list-data")}>
                                  去维护名单
                                </Button>
                              </Space>
                            }
                          />
                        ) : (
                          <>
                            <Form.Item name="listDataId" label="名单数据" rules={[{ required: true, message: "请选择名单数据" }]}>
                              <Select
                                showSearch
                                optionFilterProp="label"
                                options={listDatas.map((item) => ({
                                  label: `${item.name} / ${item.importColumns.length} 个导入字段`,
                                  value: item.id
                                }))}
                                onChange={(value) => {
                                  const picked = listDatas.find((item) => item.id === value);
                                  const currentMatchColumn = nodeDetailForm.getFieldValue("matchColumn");
                                  nodeDetailForm.setFieldsValue({
                                    listDataId: value as number | undefined,
                                    matchColumn:
                                      picked?.importColumns.includes(currentMatchColumn)
                                        ? currentMatchColumn
                                        : picked?.importColumns[0] ?? ""
                                  });
                                }}
                              />
                            </Form.Item>
                            <Form.Item name="matchColumn" label="匹配字段" rules={[{ required: true, message: "请选择匹配字段" }]}>
                              <Select
                                showSearch
                                placeholder={selectedNodeListData ? "请选择匹配字段" : "请先选择名单数据"}
                                options={(selectedNodeListData?.importColumns ?? []).map((item) => ({ label: item, value: item }))}
                              />
                            </Form.Item>
                            <Form.Item name="inputSource" label="输入来源" rules={[{ required: true, message: "请输入输入来源" }]}>
                              <Input placeholder="如: customer_id（页面字段或上游结果键）" />
                            </Form.Item>
                            <Form.Item name="resultKey" label="结果键名" rules={[{ required: true, message: "请输入结果键名" }]}>
                              <Input placeholder="如: high_risk_match" />
                            </Form.Item>
                          </>
                        )
                      ) : null}

                      {watchedNodeType === "js_script" ? (
                        <Form.Item name="script" label="脚本标识" rules={[{ required: true, message: "请输入脚本标识" }]}>
                          <Input placeholder="如: maskMobile" />
                        </Form.Item>
                      ) : null}

                      {watchedNodeType === "page_set" ? (
                        <>
                          <Form.Item name="target" label="写入目标字段" rules={[{ required: true, message: "请输入目标字段" }]}>
                            <Input placeholder="如: risk_score" />
                          </Form.Item>
                          <Form.Item name="value" label="写入值(可选)">
                            <Input placeholder="可留空，使用上游结果" />
                          </Form.Item>
                        </>
                      ) : null}
                    </Form>

                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Typography.Text type="secondary">修改后请先保存节点属性</Typography.Text>
                      <Space>
                        <Button type="primary" onClick={() => void saveSelectedNode()}>
                          保存属性
                        </Button>
                        <Popconfirm title="确认删除当前节点?" onConfirm={() => void removeSelectedNode()}>
                          <Tooltip title="删除节点">
                            <Button danger icon={<DeleteOutlined />} aria-label="delete-node" />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </Space>
                  </>
                )}
              </Card>
            </div>
          </Card>
        </Space>
      </Drawer>

      <Modal
        title={previewScene ? `预览确认：${previewScene.name}` : "预览确认"}
        open={previewOpen}
        width={980}
        confirmLoading={previewExecuting}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => void executePreview()}
        okText="确认写入"
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Card size="small" title="作业摘要">
            <Space wrap>
              <Tag>{previewScene?.name ?? "-"}</Tag>
              <Tag color="blue">
                {previewScene ? getTriggerModeLabel(deriveTriggerMode(previewScene.executionMode)) : "-"}
              </Tag>
              <Tag>{previewScene ? getRunModeLabel(derivePreviewBeforeExecute(previewScene)) : "-"}</Tag>
              <Tag>字段总数 {previewRows.length}</Tag>
              <Tag color="processing">待写入 {previewSelectedKeys.length}</Tag>
              <Tag color={previewRows.some((item) => item.abnormal) ? "red" : "green"}>
                {previewRows.some((item) => item.abnormal) ? "存在异常字段" : "无异常字段"}
              </Tag>
            </Space>
          </Card>

          {previewRows.some((item) => item.abnormal) ? (
            <Alert
              type="warning"
              showIcon
              message="有异常字段，请先取消勾选后再执行。"
            />
          ) : (
            <Typography.Text type="secondary">请勾选需要写入的字段，确认后执行。</Typography.Text>
          )}

          <ValidationReportPanel issues={previewValidationIssues} title="预览提醒" />

          <Table<JobScenePreviewField>
            rowKey="key"
            loading={previewLoading}
            pagination={false}
            rowSelection={{
              selectedRowKeys: previewSelectedKeys,
              onChange: (keys) => setPreviewSelectedKeys(keys as string[]),
              getCheckboxProps: (record) => ({ disabled: record.abnormal })
            }}
            dataSource={previewRows}
            columns={[
              { title: "字段名称", dataIndex: "fieldName", width: 140 },
              { title: "原值", dataIndex: "originalValue", width: 160 },
              { title: "拟写入值", dataIndex: "nextValue", width: 180 },
              { title: "数据来源", dataIndex: "source", width: 220 },
              {
                title: "状态",
                width: 120,
                render: (_, row) =>
                  row.abnormal ? (
                    <Tooltip title="异常字段已被预览校验拦截，执行时会自动跳过。">
                      <Tag color="red">异常</Tag>
                    </Tooltip>
                  ) : (
                    <Tag color="green">正常</Tag>
                  )
              }
            ]}
            rowClassName={(record) => (record.abnormal ? "preview-row-abnormal" : "")}
          />
        </Space>
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
          onScopeModeChange={setEffectiveScopeMode}
          onScopeOrgIdsChange={setEffectiveScopeOrgIds}
          onCancel={() => setEffectiveTarget(null)}
          onConfirm={() => void confirmEffectiveAction()}
        />
      ) : null}
    </div>
  );
}







