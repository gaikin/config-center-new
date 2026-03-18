import {
  AutoComplete,
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
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from "antd";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CopyOutlined, EditOutlined, MoreOutlined, PlayCircleOutlined } from "@ant-design/icons";
import styled from "styled-components";
import { OrgSelect } from "../../components/DirectoryFields";
import { EffectiveConfirmModal } from "../../components/EffectiveConfirmModal";
import { PublishContinuationAlert } from "../../components/PublishContinuationAlert";
import { ValidationReportPanel } from "../../components/ValidationReportPanel";
import { EffectiveScopeMode, getEffectiveActionMeta, getEffectivePermissionBlockedMessage, getPublishValidationByResource } from "../../effectiveFlow";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { getOrgLabel, orgOptions } from "../../orgOptions";
import { useMockSession } from "../../session/mockSession";
import { useInterfacesPageModel } from "./useInterfacesPageModel";
import {
  ApiRegisterForm,
  DebugEnv,
  InputTabKey,
  statusColor,
  tabLabels,
  valueTypeOptions,
  type StatusFilter
} from "./interfacesPageShared";
import type { ApiOutputParam, ApiValueType, InterfaceDefinition, LifecycleState, PublishValidationReport } from "../../types";

const wizardSteps = ["选用途", "基础信息", "参数示例", "在线测试", "保存"];

type EffectiveTarget = {
  id: number;
  name: string;
  status: LifecycleState;
  source: "row" | "notice";
};

type OutputEditorRow = ApiOutputParam & {
  suggestedPath: string;
};

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
  margin-bottom: var(--space-12);
`;

const ActionBar = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
`;

const StepHint = styled(Alert)`
  margin-bottom: var(--space-12);
`;

const ParamWorkbenchGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);

  @media (max-width: 1280px) {
    grid-template-columns: 1fr;
  }
`;

const StatStrip = styled.div`
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 12px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const StatTile = styled.div<{ $accent: string }>`
  border: 1px solid var(--cc-border-subtle, rgba(27, 99, 240, 0.15));
  border-radius: 10px;
  padding: 8px 10px;
  background: ${({ $accent }) => $accent};

  .ant-typography.ant-typography-secondary {
    color: var(--color-text-secondary) !important;
    font-weight: 500;
  }
`;

const WorkbenchCard = styled(Card)`
  height: 100%;

  .ant-card-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
`;

const OutputJsonPreview = styled.pre`
  margin: 0;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(27, 99, 240, 0.12);
  background: linear-gradient(180deg, #f7faff 0%, #fdfefe 100%);
  color: var(--color-text-primary);
  max-height: 420px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
`;

function collectPathsFromSample(value: unknown, basePath = "$.data"): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [basePath];
    }
    const first = value[0];
    if (first !== null && typeof first === "object") {
      return [basePath, ...collectPathsFromSample(first, `${basePath}[0]`)];
    }
    return [basePath];
  }

  if (typeof value !== "object") {
    return [basePath];
  }

  const paths = [basePath];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    paths.push(...collectPathsFromSample(child, `${basePath}.${key}`));
  }
  return paths;
}

function collectOutputConfigPaths(rows: ApiOutputParam[]): string[] {
  const paths: string[] = [];
  const walk = (items: ApiOutputParam[]) => {
    for (const row of items) {
      if (row.path) {
        paths.push(row.path);
      }
      if (row.children && row.children.length > 0) {
        walk(row.children);
      }
    }
  };
  walk(rows);
  return paths;
}

export function InterfacesPage() {
  const [searchParams] = useSearchParams();
  const ownerOrgFilter = searchParams.get("ownerOrgId");
  const quickAction = searchParams.get("action");
  const useCase = searchParams.get("useCase");
  const autoOpenCreateRef = useRef(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [pathPreviewEnv, setPathPreviewEnv] = useState<DebugEnv>("TEST");
  const [outputEditorMode, setOutputEditorMode] = useState<"TABLE" | "JSON">("TABLE");
  const [outputPathAdvancedMode, setOutputPathAdvancedMode] = useState(false);

  const {
    holder,
    statusFilter,
    setStatusFilter,
    openCreate,
    loading,
    filteredRows,
    openEdit,
    openClone,
    openDebug,
    openDebugDraft,
    switchStatus,
    editing,
    drawerWidth,
    drawerOpen,
    closeDrawer,
    submit,
    form,
    inputTab,
    setInputTab,
    parseBodyTemplate,
    addInputRow,
    inputColumns,
    inputConfig,
    addOutputRow,
    outputSampleJson,
    setOutputSampleJson,
    parseOutputSample,
    outputConfig,
    updateOutputRow,
    removeOutputRow,
    debugTarget,
    debugOpen,
    setDebugOpen,
    runDebug,
    debugEnv,
    setDebugEnv,
    debugPayload,
    setDebugPayload,
    debugResult,
    saveValidationReport,
    inputValidationIssues,
    outputValidationIssues,
    publishNotice,
    dismissPublishNotice,
    publishInterfaceNow,
    restoreInterfaceNow
  } = useInterfacesPageModel();
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

  const visibleRows = useMemo(() => {
    if (!ownerOrgFilter) {
      return filteredRows;
    }
    return filteredRows.filter((item) => item.ownerOrgId === ownerOrgFilter);
  }, [filteredRows, ownerOrgFilter]);

  const keywordValue = keyword.trim().toLowerCase();
  const searchedRows = useMemo(() => {
    if (!keywordValue) {
      return visibleRows;
    }
    return visibleRows.filter((item) => {
      return (
        item.name.toLowerCase().includes(keywordValue) ||
        item.description.toLowerCase().includes(keywordValue) ||
        item.testPath.toLowerCase().includes(keywordValue) ||
        item.prodPath.toLowerCase().includes(keywordValue)
      );
    });
  }, [keywordValue, visibleRows]);

  const statusSummary = useMemo(() => {
    const total = visibleRows.length;
    const draft = visibleRows.filter((item) => item.status === "DRAFT").length;
    const active = visibleRows.filter((item) => item.status === "ACTIVE").length;
    const disabled = visibleRows.filter((item) => item.status === "DISABLED").length;
    return { total, draft, active, disabled };
  }, [visibleRows]);

  const previewPath = Form.useWatch(pathPreviewEnv === "TEST" ? "testPath" : "prodPath", form);

  const pathAssistOptions = useMemo(() => {
    const set = new Set<string>();
    for (const path of collectOutputConfigPaths(outputConfig)) {
      if (path.trim()) {
        set.add(path.trim());
      }
    }

    const raw = outputSampleJson.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        const base =
          parsed && typeof parsed === "object" && !Array.isArray(parsed) && "data" in (parsed as Record<string, unknown>)
            ? (parsed as Record<string, unknown>).data
            : parsed;
        for (const path of collectPathsFromSample(base, "$.data")) {
          if (path.trim()) {
            set.add(path.trim());
          }
        }
      } catch {
        // Ignore parse errors here; validation panel already reports them.
      }
    }

    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value }));
  }, [outputConfig, outputSampleJson]);

  const requestParamTotal = useMemo(
    () => inputConfig.headers.length + inputConfig.query.length + inputConfig.path.length + inputConfig.body.length,
    [inputConfig]
  );

  const buildSuggestedPath = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "$.data";
    }
    return `$.data.${trimmed}`;
  };

  const outputEditorRows = useMemo<OutputEditorRow[]>(() => {
    return outputConfig.map((row) => ({
      ...row,
      suggestedPath: buildSuggestedPath(row.name ?? "")
    }));
  }, [outputConfig]);

  useEffect(() => {
    if (quickAction !== "create" || autoOpenCreateRef.current) {
      return;
    }
    autoOpenCreateRef.current = true;
    openCreate({
      ownerOrgId: ownerOrgFilter ?? "branch-east",
      name: "",
      description: useCase ?? ""
    });
  }, [openCreate, ownerOrgFilter, quickAction, useCase]);

  useEffect(() => {
    if (drawerOpen) {
      setWizardStep(0);
      setPathPreviewEnv("TEST");
      setOutputEditorMode("TABLE");
      setOutputPathAdvancedMode(false);
    }
  }, [drawerOpen]);

  async function goNextStep() {
    if (wizardStep === 0) {
      await form.validateFields(["name", "description", "method"]);
    }
    if (wizardStep === 1) {
      await form.validateFields(["testPath", "prodPath", "timeoutMs", "retryTimes", "status", "ownerOrgId"]);
    }
    setWizardStep((prev) => Math.min(prev + 1, wizardSteps.length - 1));
  }

  function useTemplateCreate() {
    openCreate({
      ownerOrgId: ownerOrgFilter ?? "branch-east",
      name: "客户信息查询模板",
      description: "用于表单辅助录入的通用查询接口模板。",
      method: "POST",
      testPath: "/test/customer/profile/query",
      prodPath: "/customer/profile/query"
    });
  }

  function copyTestPathToProd() {
    const testPath = form.getFieldValue("testPath");
    if (!testPath || !String(testPath).trim()) {
      msgApi.warning("请先填写测试环境路径");
      return;
    }
    form.setFieldValue("prodPath", String(testPath).trim());
    msgApi.success("已复制测试路径到生产路径");
  }

  function buildRowMenuItems(row: InterfaceDefinition): MenuProps["items"] {
    return [
      {
        key: "edit",
        label: "编辑",
        icon: <EditOutlined />,
        onClick: () => openEdit(row)
      },
      {
        key: "clone",
        label: "复制创建",
        icon: <CopyOutlined />,
        onClick: () => openClone(row)
      },
      {
        key: "debug",
        label: "在线测试",
        icon: <PlayCircleOutlined />,
        onClick: () => openDebug(row)
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
      const validation = await getPublishValidationByResource("INTERFACE", target.id);
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
        const success = await publishInterfaceNow(
          effectiveTarget.id,
          effectiveTarget.name,
          effectiveScopeMode === "CUSTOM_ORGS" ? effectiveScopeOrgIds : []
        );
        if (!success) {
          const validation = await getPublishValidationByResource("INTERFACE", effectiveTarget.id);
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
          const restored = await restoreInterfaceNow(
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

  function renderOutputEditorTable(rows: OutputEditorRow[]) {
    const patchRow = (row: OutputEditorRow, patch: Partial<ApiOutputParam>) => {
      updateOutputRow(row.id, patch);
    };

    const removeRowById = (row: OutputEditorRow) => removeOutputRow(row.id);

    return (
      <Table<OutputEditorRow>
        rowKey="id"
        pagination={false}
        size="small"
        dataSource={rows}
        scroll={{ x: 980 }}
        columns={[
          {
            title: "字段名",
            width: 160,
            render: (_, row) => {
              const isManualPath = row.pathMode === "MANUAL";
              return (
                <Input
                  value={row.name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    patchRow(row, {
                      name: nextName,
                      path: isManualPath ? row.path : buildSuggestedPath(nextName),
                      pathMode: isManualPath ? "MANUAL" : "AUTO"
                    });
                  }}
                />
              );
            }
          },
          {
            title: "路径",
            width: outputPathAdvancedMode ? 320 : 280,
            render: (_, row) => {
              const isManualPath = row.pathMode === "MANUAL";
              const displayPath = isManualPath ? row.path : row.suggestedPath;
              if (!outputPathAdvancedMode) {
                return (
                  <Space size={6} wrap>
                    <Typography.Text code>{displayPath || "-"}</Typography.Text>
                    <Tag color={isManualPath ? "gold" : "blue"}>{isManualPath ? "手动" : "自动"}</Tag>
                  </Space>
                );
              }
              return (
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  <AutoComplete
                    options={pathAssistOptions}
                    value={displayPath}
                    onChange={(value) => patchRow(row, { path: value, pathMode: "MANUAL" })}
                    placeholder="如 $.data.score"
                  />
                  <Space size={6} wrap>
                    <Tag color={isManualPath ? "gold" : "blue"}>{isManualPath ? "手动路径" : "自动路径"}</Tag>
                    {isManualPath ? (
                      <Button
                        size="small"
                        onClick={() => patchRow(row, { path: row.suggestedPath, pathMode: "AUTO" })}
                      >
                        恢复自动
                      </Button>
                    ) : null}
                  </Space>
                </Space>
              );
            }
          },
          {
            title: "描述",
            width: 160,
            render: (_, row) => (
              <Input value={row.description} onChange={(event) => patchRow(row, { description: event.target.value })} />
            )
          },
          {
            title: "类型",
            width: 120,
            render: (_, row) => (
              <Select
                value={row.valueType}
                options={valueTypeOptions}
                onChange={(value) =>
                  patchRow(row, {
                    valueType: value as ApiValueType,
                    children: value === "OBJECT" || value === "ARRAY" ? row.children ?? [] : []
                  })
                }
              />
            )
          },
          {
            title: "操作",
            width: 88,
            render: (_, row) => (
              <Space size={6}>
                <Button danger size="small" onClick={() => removeRowById(row)}>
                  删除
                </Button>
              </Space>
            )
          }
        ]}
      />
    );
  }

  return (
    <div>
      {holder}
      {msgHolder}
      <PageHeader>
        <Typography.Title level={4}>API注册</Typography.Title>
      </PageHeader>
      {publishNotice ? (
        <PublishContinuationAlert
          objectLabel="API"
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
      {ownerOrgFilter ? (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          message={`已按机构过滤：${getOrgLabel(ownerOrgFilter)}`}
          description="该过滤来自菜单管理详情中的“新建关联 API”快捷动作。"
        />
      ) : null}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} lg={6}>
          <SummaryCard $accent="linear-gradient(90deg, #2465f2 0%, #58a2ff 100%)">
            <Statistic title="接口总数" value={statusSummary.total} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <SummaryCard $accent="linear-gradient(90deg, #8f55ed 0%, #bf8bff 100%)">
            <Statistic title="草稿接口" value={statusSummary.draft} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <SummaryCard $accent="linear-gradient(90deg, #16945f 0%, #47b983 100%)">
            <Statistic title="已生效" value={statusSummary.active} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <SummaryCard $accent="linear-gradient(90deg, #ce7f27 0%, #e9b15b 100%)">
            <Statistic title="已停用" value={statusSummary.disabled} />
          </SummaryCard>
        </Col>
      </Row>

      <ToolbarCard>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} lg={10}>
            <Input.Search
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索 API 名称、用途、测试路径或生产路径"
            />
          </Col>
          <Col xs={24} lg={14}>
            <ActionBar>
              <Segmented
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                options={[
                  { label: "全部", value: "ALL" },
                  { label: "草稿", value: "DRAFT" },
                  { label: "生效", value: "ACTIVE" },
                  { label: "停用", value: "DISABLED" },
                  { label: "失效", value: "EXPIRED" }
                ]}
              />
              <Button onClick={resetListFilters}>重置筛选</Button>
              <Button onClick={useTemplateCreate}>从模板创建</Button>
              <Button type="primary" onClick={() => openCreate()}>
                新建 API注册
              </Button>
            </ActionBar>
          </Col>
        </Row>
      </ToolbarCard>

      <Card
        extra={
          <Typography.Text type="secondary">当前展示 {searchedRows.length} 条记录</Typography.Text>
        }
      >
        <Table<InterfaceDefinition>
          rowKey="id"
          loading={loading}
          dataSource={searchedRows}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"] }}
          columns={[
            { title: "API名称", dataIndex: "name", width: 180 },
            { title: "接口用途", dataIndex: "description", width: 220 },
            {
              title: "方法与路径",
              width: 320,
              render: (_, row) => (
                <Space direction="vertical" size={4}>
                  <Space>
                    <Tag color="geekblue">{row.method}</Tag>
                    <Typography.Text>{row.testPath || "-"}</Typography.Text>
                    <Tag>测试</Tag>
                  </Space>
                  <Space>
                    <Tag color="cyan">{row.method}</Tag>
                    <Typography.Text>{row.prodPath || "-"}</Typography.Text>
                    <Tag color="green">生产</Tag>
                  </Space>
                </Space>
              )
            },
            {
              title: "引用关系",
              width: 240,
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  <Tag>{`页面(${getOrgLabel(row.ownerOrgId)})`}</Tag>
                  <Tag>规则(2)</Tag>
                  <Tag>作业(1)</Tag>
                </Space>
              )
            },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
            },
            {
              title: "操作",
              width: 220,
              render: (_, row) => {
                const actionMeta = getEffectiveActionMeta(row.status);
                const actionBlocked = getEffectivePermissionBlockedMessage(actionMeta.type, hasResource);
                return (
                  <Space>
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

      <Drawer
        title={editing ? `编辑 API注册：${editing.name}` : "新建 API注册"}
        placement="right"
        width={drawerWidth}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setWizardStep((prev) => Math.max(prev - 1, 0))} disabled={wizardStep === 0}>
              上一步
            </Button>
            {wizardStep < wizardSteps.length - 1 ? (
              <Button type="primary" onClick={() => void goNextStep()}>
                下一步
              </Button>
            ) : (
              <Button type="primary" onClick={() => void submit()}>
                保存接口
              </Button>
            )}
          </Space>
        }
      >
        <Steps
          current={wizardStep}
          size="small"
          style={{ marginBottom: 12 }}
          items={wizardSteps.map((title) => ({ title }))}
        />

        <Form form={form} layout="vertical">
          {wizardStep === 0 ? (
            <ValidationReportPanel report={saveValidationReport} sections={["purpose"]} title="当前步骤还有待处理问题" />
          ) : null}

          {wizardStep === 0 ? (
            <Card title="步骤 1：选用途" size="small">
              <StepHint
                showIcon
                type="info"
                message="建议先写清楚用途与调用对象"
              />
              <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                <Input maxLength={128} />
              </Form.Item>
              <Form.Item name="description" label="用途说明" rules={[{ required: true, message: "请输入用途说明" }]}>
                <Input.TextArea rows={3} maxLength={300} />
              </Form.Item>
              <Form.Item name="method" label="调用方式" rules={[{ required: true, message: "请选择方法" }]}>
                <Select options={["GET", "POST", "PUT", "DELETE"].map((v) => ({ label: v, value: v }))} />
              </Form.Item>
              <Space>
                <Button onClick={useTemplateCreate}>从常用模板创建</Button>
              </Space>
            </Card>
          ) : null}

          {wizardStep === 1 ? (
            <ValidationReportPanel report={saveValidationReport} sections={["basic"]} title="基础信息还有待处理问题" />
          ) : null}

          {wizardStep === 1 ? (
            <Card title="步骤 2：填基础信息" size="small">
              <StepHint
                showIcon
                type="info"
                message="测试路径和生产路径建议同时维护"
              />
              <Row gutter={12}>
                <Col span={24}>
                  <Form.Item name="ownerOrgId" label="机构范围" rules={[{ required: true, message: "请选择机构范围" }]}>
                    <OrgSelect />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="testPath" label="测试环境路径" rules={[{ required: true, message: "请输入测试路径" }]}>
                    <Input placeholder="如 /test/risk/score/query" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="prodPath" label="生产环境路径" rules={[{ required: true, message: "请输入生产路径" }]}>
                    <Input placeholder="如 /risk/score/query" />
                  </Form.Item>
                </Col>
              </Row>
              <Space style={{ marginBottom: 12 }} wrap>
                <Segmented
                  value={pathPreviewEnv}
                  onChange={(value) => setPathPreviewEnv(value as DebugEnv)}
                  options={[
                    { label: "测试路径预览", value: "TEST" },
                    { label: "生产路径预览", value: "PROD" }
                  ]}
                />
                <Button icon={<CopyOutlined />} onClick={copyTestPathToProd}>
                  测试路径复制到生产
                </Button>
                <Typography.Text type="secondary">
                  当前预览：{previewPath || "-"}
                </Typography.Text>
              </Space>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="timeoutMs" label="超时(ms)" rules={[{ required: true, message: "请输入超时" }]}>
                    <InputNumber min={1} max={5000} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="retryTimes" label="重试次数" rules={[{ required: true, message: "请输入重试次数" }]}>
                    <InputNumber min={0} max={3} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                <Select options={lifecycleOptions} />
              </Form.Item>
              <Form.Item name="maskSensitive" label="敏感字段脱敏" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Card>
          ) : null}

          {wizardStep === 2 ? (
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <ValidationReportPanel
                report={saveValidationReport}
                sections={["params"]}
                title="参数示例还有待处理问题"
              />
              <ValidationReportPanel issues={inputValidationIssues} title="请求参数还有待处理问题" />
              <ValidationReportPanel issues={outputValidationIssues} title="返回参数还有待处理问题" />
              <ParamWorkbenchGrid>
                <WorkbenchCard
                  title={
                    <Space size={8} wrap>
                      <Typography.Text strong>步骤 3：填参数示例</Typography.Text>
                      <Tag color="blue">请求参数 {requestParamTotal}</Tag>
                    </Space>
                  }
                  size="small"
                >
                  <StepHint
                    showIcon
                    type="info"
                    message="Body JSON 是唯一结构来源"
                  />
                  <StatStrip>
                    <StatTile $accent="linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 100%)">
                      <Typography.Text type="secondary">请求参数总数</Typography.Text>
                      <Typography.Title level={5} style={{ margin: 0 }}>{requestParamTotal}</Typography.Title>
                    </StatTile>
                    <StatTile $accent="linear-gradient(180deg, #F2FBF7 0%, #FFFFFF 100%)">
                      <Typography.Text type="secondary">Body 字段数</Typography.Text>
                      <Typography.Title level={5} style={{ margin: 0 }}>{inputConfig.body.length}</Typography.Title>
                    </StatTile>
                    <StatTile $accent="linear-gradient(180deg, #FFF8F1 0%, #FFFFFF 100%)">
                      <Typography.Text type="secondary">返回字段数</Typography.Text>
                      <Typography.Title level={5} style={{ margin: 0 }}>{outputConfig.length}</Typography.Title>
                    </StatTile>
                  </StatStrip>
                  <Tabs
                    activeKey={inputTab}
                    onChange={(key) => setInputTab(key as InputTabKey)}
                    items={(Object.keys(tabLabels) as InputTabKey[]).map((tab) => ({
                      key: tab,
                      label: `${tabLabels[tab]} (${inputConfig[tab].length})`,
                      children: (
                        <div>
                          {tab === "body" ? (
                            <>
                              <Form.Item name="bodyTemplateJson" label="Body JSON 模板">
                                <Input.TextArea rows={6} placeholder="支持 JSON 解析为 Body 参数" />
                              </Form.Item>
                              <Alert
                                showIcon
                                type="info"
                                style={{ marginBottom: 12 }}
                                message="结构调整请修改 Body JSON 后重新解析"
                              />
                              <Space style={{ marginBottom: 12 }}>
                                <Button type="primary" onClick={parseBodyTemplate}>解析并重建结构</Button>
                                <Typography.Text type="secondary">当前 Body 参数数：{inputConfig.body.length}</Typography.Text>
                              </Space>
                            </>
                          ) : (
                            <Button style={{ marginBottom: 12 }} onClick={() => addInputRow(tab)}>
                              新增{tabLabels[tab]}参数
                            </Button>
                          )}

                          <Table size="small" rowKey="id" pagination={false} columns={inputColumns(tab)} dataSource={inputConfig[tab]} />
                        </div>
                      )
                    }))}
                  />
                </WorkbenchCard>

                <WorkbenchCard
                  title={
                    <Space size={8} wrap>
                      <Typography.Text strong>返回参数示例</Typography.Text>
                      <Tag color="cyan">根字段 {outputConfig.length}</Tag>
                    </Space>
                  }
                  size="small"
                  extra={
                    <Space size={8}>
                      <Segmented
                        value={outputEditorMode}
                        onChange={(value) => setOutputEditorMode(value as "TABLE" | "JSON")}
                        options={[
                          { label: "结构编辑", value: "TABLE" },
                          { label: "JSON预览", value: "JSON" }
                        ]}
                      />
                      <Button onClick={addOutputRow}>新增出参</Button>
                    </Space>
                  }
                >
                  <Alert
                    showIcon
                    type={outputPathAdvancedMode ? "warning" : "info"}
                    message={outputPathAdvancedMode ? "高级模式：可手动改路径" : "默认模式：路径自动生成"}
                  />
                  <Space style={{ marginTop: 8 }} wrap>
                    <Switch checked={outputPathAdvancedMode} onChange={setOutputPathAdvancedMode} />
                    <Typography.Text type="secondary">高级路径编辑</Typography.Text>
                  </Space>
                  <Input.TextArea
                    rows={5}
                    value={outputSampleJson}
                    onChange={(event) => setOutputSampleJson(event.target.value)}
                    placeholder="粘贴返回 JSON 示例"
                  />
                  <Space style={{ marginTop: 8, marginBottom: 12 }}>
                    <Button onClick={parseOutputSample}>解析返回 JSON</Button>
                    <Typography.Text type="secondary">路径建议数：{pathAssistOptions.length}</Typography.Text>
                  </Space>

                  {outputEditorMode === "TABLE" ? (
                    renderOutputEditorTable(outputEditorRows)
                  ) : (
                    <OutputJsonPreview>{JSON.stringify(outputConfig, null, 2)}</OutputJsonPreview>
                  )}
                </WorkbenchCard>
              </ParamWorkbenchGrid>
            </Space>
          ) : null}

          {wizardStep === 3 ? (
            <Card title="步骤 4：在线测试" size="small">
              <Space>
                <Button type="primary" onClick={openDebugDraft}>
                  使用当前草稿在线测试
                </Button>
                {editing ? (
                  <Button onClick={() => openDebug(editing)}>
                    使用已保存版本测试
                  </Button>
                ) : null}
              </Space>
            </Card>
          ) : null}

          {wizardStep === 4 ? (
            <Card title="步骤 5：保存前确认" size="small">
              <DescriptionsSummary form={form} outputCount={outputConfig.length} report={saveValidationReport} />
            </Card>
          ) : null}
        </Form>
      </Drawer>

      <Modal
        title={debugTarget ? `API在线测试：${debugTarget.name}` : "API在线测试"}
        open={debugOpen}
        width={980}
        onCancel={() => setDebugOpen(false)}
        onOk={runDebug}
        okText="执行测试"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Card size="small" title="测试环境">
            <Space>
              <Segmented
                value={debugEnv}
                onChange={(value) => setDebugEnv(value as DebugEnv)}
                options={[
                  { label: "测试环境", value: "TEST" },
                  { label: "生产环境", value: "PROD" }
                ]}
              />
              <Typography.Text type="secondary">
                请求路径：
                {debugTarget ? (debugEnv === "TEST" ? debugTarget.testPath : debugTarget.prodPath) : "-"}
              </Typography.Text>
            </Space>
          </Card>
          <Card size="small" title="请求入参(JSON)">
            <Input.TextArea rows={8} value={debugPayload} onChange={(event) => setDebugPayload(event.target.value)} />
          </Card>
          {debugResult ? (
            <Row gutter={12}>
              <Col span={12}>
                <Card size="small" title="请求预览">
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    耗时：{debugResult.latencyMs} ms
                  </Typography.Paragraph>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify({ path: debugResult.requestPath, body: debugResult.requestBody }, null, 2)}
                  </pre>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="响应预览">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(debugResult.responseBody, null, 2)}</pre>
                </Card>
              </Col>
            </Row>
          ) : (
            <Typography.Text type="secondary">点击“执行测试”后会展示请求和响应结果。</Typography.Text>
          )}
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

function DescriptionsSummary({ form, outputCount, report }: { form: any; outputCount: number; report: any }) {
  const values = form.getFieldsValue() as Partial<ApiRegisterForm>;
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <ValidationReportPanel report={report} title="保存前检查结果" />
      <Alert
        showIcon
        type="info"
        message="确认后保存"
      />
      <Space wrap>
        <Tag color="blue">{values.name || "未命名接口"}</Tag>
        <Tag>{values.method || "POST"}</Tag>
        <Tag>{getOrgLabel(values.ownerOrgId)}</Tag>
        <Tag color="purple">出参字段 {outputCount}</Tag>
      </Space>
      <Typography.Text type="secondary">测试路径：{values.testPath || "-"}</Typography.Text>
      <Typography.Text type="secondary">生产路径：{values.prodPath || "-"}</Typography.Text>
    </Space>
  );
}

