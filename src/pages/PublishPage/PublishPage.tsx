import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { OrgText, PersonText } from "../../components/DirectoryFields";
import { auditActionLabelMap, pendingTypeLabelMap, resourceTypeLabelMap } from "../../enumLabels";
import { getOrgLabel } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import { mockUserPersonaMetaMap, useMockSession } from "../../session/mockSession";
import type {
  MenuSdkPolicy,
  PageMenu,
  PageRegion,
  PlatformRuntimeConfig,
  PublishAuditLog,
  PublishPendingItem,
  PublishValidationReport,
  ValidationReport
} from "../../types";

type PendingFilter = "ALL" | PublishPendingItem["pendingType"];
type PublishTab = "CONFIG_RELEASE" | "MENU_CAPABILITY";

const pendingColor: Record<PublishPendingItem["pendingType"], string> = {
  DRAFT: "default",
  EXPIRING_SOON: "orange",
  VALIDATION_FAILED: "red",
  CONFLICT: "volcano",
  RISK_CONFIRM: "gold"
};

const publishResourceTypes: PublishPendingItem["resourceType"][] = ["INTERFACE", "LIST_DATA", "RULE", "JOB_SCENE"];
const subtlePositiveTagStyle = { borderColor: "#D0D5DD", background: "#F9FAFB", color: "#344054" } as const;

function splitIpDraft(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,，;\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function PublishPage() {
  const { persona, meta, hasResource } = useMockSession();
  const [loading, setLoading] = useState(true);
  const [pendingItems, setPendingItems] = useState<PublishPendingItem[]>([]);
  const [logs, setLogs] = useState<PublishAuditLog[]>([]);
  const [policies, setPolicies] = useState<MenuSdkPolicy[]>([]);
  const [regions, setRegions] = useState<PageRegion[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformRuntimeConfig | null>(null);
  const [filter, setFilter] = useState<PendingFilter>("ALL");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseStep, setReleaseStep] = useState(0);
  const [selectedPendingIds, setSelectedPendingIds] = useState<number[]>([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [trialIpDraft, setTrialIpDraft] = useState("");
  const [effectiveType, setEffectiveType] = useState<"IMMEDIATE" | "SCHEDULED">("IMMEDIATE");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [publishingBatch, setPublishingBatch] = useState(false);
  const [publishingId, setPublishingId] = useState<number>();
  const [reportingId, setReportingId] = useState<number>();
  const [batchPublishResult, setBatchPublishResult] = useState<{
    open: boolean;
    published: string[];
    blocked: Array<{ name: string; reason: string; impactSummary?: string; riskItems: string[] }>;
    skippedRiskPending: string[];
  }>({ open: false, published: [], blocked: [], skippedRiskPending: [] });
  const [validationModal, setValidationModal] = useState<{
    open: boolean;
    item: PublishPendingItem | null;
    report: PublishValidationReport | null;
  }>({ open: false, item: null, report: null });
  const [msgApi, holder] = message.useMessage();
  const personaMeta = mockUserPersonaMetaMap[persona];
  const canPublishConfig = hasResource("/action/common/base/publish");
  const canDeferPending = hasResource("/action/common/base/publish");
  const canConfirmRisk = hasResource("/action/common/base/publish");
  const canManageMenuCapability =
    hasResource("/action/page-management/capability/manage") && meta.roleType === "PERMISSION_ADMIN";
  const activeTab: PublishTab = canManageMenuCapability && !canPublishConfig ? "MENU_CAPABILITY" : "CONFIG_RELEASE";
  const roleTone = canManageMenuCapability ? "purple" : canPublishConfig ? "blue" : "green";

  async function loadData() {
    setLoading(true);
    try {
      const [pendingData, logData, policyData, regionData, menuData, runtimeConfig] = await Promise.all([
        configCenterService.listPendingItems(),
        configCenterService.listAuditLogs(),
        configCenterService.listMenuSdkPolicies(),
        configCenterService.listPageRegions(),
        configCenterService.listPageMenus(),
        configCenterService.getPlatformRuntimeConfig()
      ]);
      setPendingItems(pendingData);
      setLogs(logData);
      setPolicies(policyData);
      setRegions(regionData);
      setMenus(menuData);
      setPlatformConfig(runtimeConfig);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const publishPendingItems = useMemo(
    () => pendingItems.filter((item) => publishResourceTypes.includes(item.resourceType)),
    [pendingItems]
  );

  const filteredPendingItems = useMemo(() => {
    if (filter === "ALL") {
      return publishPendingItems;
    }
    return publishPendingItems.filter((item) => item.pendingType === filter);
  }, [filter, publishPendingItems]);

  const menuCapabilityPendingItems = useMemo(
    () => pendingItems.filter((item) => item.resourceType === "MENU_SDK_POLICY" || item.resourceType === "PAGE_ACTIVATION_POLICY"),
    [pendingItems]
  );

  const otherRelatedItems = useMemo(
    () =>
      pendingItems.filter(
        (item) =>
          !publishResourceTypes.includes(item.resourceType) &&
          item.resourceType !== "MENU_SDK_POLICY" &&
          item.resourceType !== "PAGE_ACTIVATION_POLICY"
      ),
    [pendingItems]
  );

  const regionMap = useMemo(() => Object.fromEntries(regions.map((item) => [item.id, item.regionName])), [regions]);
  const menuMap = useMemo(() => Object.fromEntries(menus.map((item) => [item.id, item])), [menus]);
  const pilotPolicies = policies.filter((item) => item.promptGrayOrgIds.length > 0 || item.jobGrayOrgIds.length > 0);
  const publishLogs = logs.filter((item) => item.action === "PUBLISH" && publishResourceTypes.includes(item.resourceType as PublishPendingItem["resourceType"]));
  const menuCapabilityLogs = logs.filter((item) => item.resourceType === "MENU_SDK_POLICY" || item.resourceType === "PAGE_ACTIVATION_POLICY");
  const draftPendingItems = publishPendingItems.filter((item) => item.pendingType === "DRAFT");
  const orgOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of publishPendingItems) {
      if (item.ownerOrgId) {
        set.add(item.ownerOrgId);
      }
    }
    return Array.from(set);
  }, [publishPendingItems]);
  const selectedPublishItems = useMemo(
    () => draftPendingItems.filter((item) => selectedPendingIds.includes(item.id)),
    [draftPendingItems, selectedPendingIds]
  );
  const selectedTrialIps = useMemo(() => splitIpDraft(trialIpDraft), [trialIpDraft]);
  const promptGrayMenus = useMemo(() => policies.filter((item) => item.promptGrayEnabled).length, [policies]);
  const jobGrayMenus = useMemo(() => policies.filter((item) => item.jobGrayEnabled).length, [policies]);

  function openReleaseFlow() {
    setSelectedPendingIds(draftPendingItems.map((item) => item.id));
    setSelectedOrgIds([]);
    setTrialIpDraft("");
    setEffectiveType("IMMEDIATE");
    setEffectiveAt("2026-03-15 20:00");
    setReleaseStep(0);
    setReleaseOpen(true);
  }

  function validateReleaseStep(step: number) {
    if (step === 0 && selectedPendingIds.length === 0) {
      msgApi.warning("请至少选择一个待发布对象");
      return false;
    }
    if (step === 2 && effectiveType === "SCHEDULED" && !effectiveAt.trim()) {
      msgApi.warning("请选择定时生效时间");
      return false;
    }
    return true;
  }

  function handleReleaseNext() {
    if (!validateReleaseStep(releaseStep)) {
      return;
    }
    if (releaseStep < 3) {
      setReleaseStep((prev) => Math.min(prev + 1, 3));
      return;
    }
    void publishBatch();
  }

  async function publishBatch() {
    setPublishingBatch(true);
    try {
      const published: string[] = [];
      const blocked: Array<{ name: string; reason: string; impactSummary?: string; riskItems: string[] }> = [];
      for (const item of selectedPublishItems) {
        const result = await configCenterService.publishPendingItem(item.id);
        if (result.success) {
          published.push(item.resourceName);
        } else {
          blocked.push({
            name: item.resourceName,
            reason:
              result.report.items
                .filter((reportItem) => !reportItem.passed)
                .map((reportItem) => reportItem.label)
                .join("；") || "存在阻断项",
            impactSummary: result.report.impactSummary,
            riskItems: result.report.riskItems ?? []
          });
        }
      }
      setBatchPublishResult({
        open: true,
        published,
        blocked,
        skippedRiskPending: publishPendingItems.filter((item) => item.pendingType === "RISK_CONFIRM").map((item) => item.resourceName)
      });
      msgApi.success("配置发布已执行，已生成结果汇总");
      setReleaseOpen(false);
      await loadData();
    } finally {
      setPublishingBatch(false);
    }
  }

  async function openValidationReport(item: PublishPendingItem) {
    setReportingId(item.id);
    try {
      const report = await configCenterService.getPendingValidationReport(item.id);
      setValidationModal({ open: true, item, report });
    } finally {
      setReportingId(undefined);
    }
  }

  async function publish(item: PublishPendingItem) {
    setPublishingId(item.id);
    try {
      const result = await configCenterService.publishPendingItem(item.id);
      if (!result.success) {
        setValidationModal({ open: true, item, report: result.report });
        msgApi.error("发布前检查未通过，请先处理阻断项");
        await loadData();
        return;
      }
      msgApi.success(`已发布：${item.resourceName}`);
      await loadData();
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "发布失败");
      await loadData();
    } finally {
      setPublishingId(undefined);
    }
  }

  async function defer(item: PublishPendingItem) {
    await configCenterService.deferPendingItem(item.id);
    msgApi.success(`已延期处理：${item.resourceName}`);
    await loadData();
  }

  async function confirmRisk(item: PublishPendingItem) {
    if (item.resourceType !== "JOB_SCENE") {
      return;
    }
    await configCenterService.confirmJobSceneRisk(item.resourceId);
    msgApi.success(`已完成风险确认：${item.resourceName}`);
    await loadData();
  }

  async function resolve(item: PublishPendingItem) {
    await configCenterService.resolvePendingItem(item.id);
    msgApi.success(`已标记处理完成：${item.resourceName}`);
    await loadData();
  }

  function requestAdminSupport(item: PublishPendingItem) {
    msgApi.success(`已通知配置人员处理：${item.resourceName}（原型提示）`);
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>发布与灰度</Typography.Title>

      <Card style={{ marginBottom: 12 }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            <Typography.Text type="secondary">模拟登录身份</Typography.Text>
            <Tag color={roleTone}>{personaMeta.label}</Tag>
            <Typography.Text type="secondary">
              当前模块：{activeTab === "CONFIG_RELEASE" ? "配置发布" : "菜单能力"}
            </Typography.Text>
          </Space>
          {activeTab === "CONFIG_RELEASE" ? (
            canPublishConfig ? (
              <Alert
                showIcon
                type="info"
                message="当前是配置人员发布视角"
              />
            ) : (
              <Alert
                showIcon
                type="info"
                message="当前是只读发布视角"
              />
            )
          ) : canManageMenuCapability ? (
            <Alert
              showIcon
              type="info"
              message="当前是菜单能力管理视角"
            />
          ) : (
            <Alert
              showIcon
              type="info"
              message="当前是只读菜单能力视角"
            />
          )}
        </Space>
      </Card>

      {activeTab === "CONFIG_RELEASE" ? (
        <>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="待发布对象" value={draftPendingItems.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="检查未通过" value={publishPendingItems.filter((item) => item.pendingType === "VALIDATION_FAILED").length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="待风险确认" value={publishPendingItems.filter((item) => item.pendingType === "RISK_CONFIRM").length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="发布记录" value={publishLogs.length} />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ marginTop: 12 }}
        title="配置发布主流程"
        extra={
          canPublishConfig ? (
            <Button type="primary" onClick={openReleaseFlow}>
              发起配置发布
            </Button>
          ) : null
        }
      >
        <Steps
          items={[
            { title: "汇总待发布对象" },
            { title: "选择机构 / IP 试点" },
            { title: "选择生效时间" },
            { title: "确认影响并发布" }
          ]}
        />
      </Card>

      <Card
        title="待发布对象"
        style={{ marginTop: 12 }}
        extra={
          <Segmented
            options={[
              { label: "全部", value: "ALL" },
              { label: "待发布", value: "DRAFT" },
              { label: "检查未通过", value: "VALIDATION_FAILED" },
              { label: "待风险确认", value: "RISK_CONFIRM" }
            ]}
            value={filter}
            onChange={(value) => setFilter(value as PendingFilter)}
          />
        }
      >
        <Table<PublishPendingItem>
          rowKey="id"
          loading={loading}
          dataSource={filteredPendingItems}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            { title: "变更对象", dataIndex: "resourceName" },
            {
              title: "对象类型",
              dataIndex: "resourceType",
              width: 130,
              render: (value: PublishPendingItem["resourceType"]) => resourceTypeLabelMap[value]
            },
            { title: "机构范围", dataIndex: "ownerOrgId", width: 140, render: (value: string) => <OrgText value={value} /> },
            {
              title: "当前状态",
              width: 120,
              render: (_, row) => <Tag color={pendingColor[row.pendingType]}>{pendingTypeLabelMap[row.pendingType]}</Tag>
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: canPublishConfig ? 330 : 220,
              render: (_, row) => (
                <Space wrap>
                  {canPublishConfig ? (
                    <Button size="small" type="primary" loading={publishingId === row.id} onClick={() => void publish(row)}>
                      发布
                    </Button>
                  ) : (
                    <Button size="small" onClick={() => requestAdminSupport(row)}>
                      通知配置人员处理
                    </Button>
                  )}
                  <Button size="small" loading={reportingId === row.id} onClick={() => void openValidationReport(row)}>
                    查看检查结果
                  </Button>
                  {row.pendingType === "EXPIRING_SOON" && canDeferPending ? (
                    <Button size="small" onClick={() => void defer(row)}>
                      延期
                    </Button>
                  ) : null}
                  {row.pendingType === "RISK_CONFIRM" && row.resourceType === "JOB_SCENE" && canConfirmRisk ? (
                    <Button size="small" onClick={() => void confirmRisk(row)}>
                      风险确认
                    </Button>
                  ) : null}
                  {canPublishConfig ? (
                    <Button size="small" onClick={() => void resolve(row)}>
                      标记完成
                    </Button>
                  ) : null}
                </Space>
              )
            }
          ]}
        />
      </Card>

      {canPublishConfig && otherRelatedItems.length > 0 ? (
        <Card title="关联配置项" style={{ marginTop: 12 }}>
          <Typography.Paragraph type="secondary">
            这里只展示仍需发布配置人员感知的关联配置项，如数据转换规则。菜单能力与页面开通走单独处理路径，不在本页展示。
          </Typography.Paragraph>
          <Table<PublishPendingItem>
            rowKey="id"
            loading={loading}
            dataSource={otherRelatedItems}
            pagination={false}
            columns={[
              { title: "配置项", dataIndex: "resourceName" },
              {
                title: "类型",
                dataIndex: "resourceType",
                width: 150,
                render: (value: PublishPendingItem["resourceType"]) => resourceTypeLabelMap[value]
              },
              { title: "归属机构", dataIndex: "ownerOrgId", width: 140, render: (value: string) => <OrgText value={value} /> },
              {
                title: "当前状态",
                width: 120,
                render: (_, row) => <Tag color={pendingColor[row.pendingType]}>{pendingTypeLabelMap[row.pendingType]}</Tag>
              }
            ]}
          />
        </Card>
      ) : null}

      <Card title="配置发布记录" style={{ marginTop: 12 }}>
        <Table<PublishAuditLog>
          rowKey="id"
          loading={loading}
          dataSource={publishLogs}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            {
              title: "动作",
              width: 120,
              render: (_, row) => <Tag color={row.action === "PUBLISH" ? "green" : "blue"}>{auditActionLabelMap[row.action]}</Tag>
            },
            {
              title: "对象类型",
              dataIndex: "resourceType",
              width: 140,
              render: (value: string) => resourceTypeLabelMap[(value as keyof typeof resourceTypeLabelMap) ?? "PAGE_RESOURCE"] ?? value
            },
            { title: "对象名称", dataIndex: "resourceName" },
            { title: "操作人", dataIndex: "operator", width: 140, render: (value: string) => <PersonText value={value} /> },
            { title: "时间", dataIndex: "createdAt", width: 180 }
          ]}
        />
      </Card>
        </>
      ) : (
        <>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="提示灰度策略" value={promptGrayMenus} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="作业灰度策略" value={jobGrayMenus} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="机构灰度策略" value={pilotPolicies.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Typography.Text type="secondary">平台正式版本</Typography.Text>
            <div>
              <Typography.Text>提示: {platformConfig?.promptStableVersion ?? "-"}</Typography.Text>
            </div>
            <div>
              <Typography.Text>作业: {platformConfig?.jobStableVersion ?? "-"}</Typography.Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="菜单能力与试点范围" style={{ marginTop: 12 }}>
        <Table<MenuSdkPolicy>
          rowKey="id"
          loading={loading}
          dataSource={policies}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            {
              title: "专区 / 菜单",
              width: 240,
              render: (_, row) => {
                const menu = menuMap[row.menuId];
                return `${regionMap[row.regionId] ?? "-"} / ${menu?.menuName ?? "未识别菜单"}`;
              }
            },
            {
              title: "智能提示",
              width: 100,
              render: (_, row) => (row.promptGrayEnabled ? <Tag color="orange">灰度中</Tag> : <Tag>走正式</Tag>)
            },
            {
              title: "智能作业",
              width: 100,
              render: (_, row) => (row.jobGrayEnabled ? <Tag color="purple">灰度中</Tag> : <Tag>走正式</Tag>)
            },
            {
              title: "提示灰度版本",
              width: 120,
              render: (_, row) =>
                row.promptGrayEnabled ? row.promptGrayVersion ?? <Typography.Text type="secondary">未配置</Typography.Text> : "未启用"
            },
            {
              title: "作业灰度版本",
              width: 120,
              render: (_, row) =>
                row.jobGrayEnabled ? row.jobGrayVersion ?? <Typography.Text type="secondary">未配置</Typography.Text> : "未启用"
            },
            {
              title: "机构范围",
              width: 200,
              render: (_, row) => {
                const promptOrgTags = row.promptGrayOrgIds.map((orgId) => ({ key: `prompt-${orgId}`, label: `提示:${getOrgLabel(orgId)}` }));
                const jobOrgTags = row.jobGrayOrgIds.map((orgId) => ({ key: `job-${orgId}`, label: `作业:${getOrgLabel(orgId)}` }));
                const orgTags = [...promptOrgTags, ...jobOrgTags];
                if (orgTags.length === 0) {
                  return <Tag>全部机构</Tag>;
                }
                return (
                  <Space wrap>
                    {orgTags.map((tag) => (
                      <Tag key={tag.key}>{tag.label}</Tag>
                    ))}
                  </Space>
                );
              }
            },
            {
              title: "IP 试点",
              width: 180,
              render: () => <Typography.Text type="secondary">未配置</Typography.Text>
            },
            {
              title: "能力说明",
              width: 220,
              render: (_, row) => (
                <Typography.Text type="secondary">
                  {row.promptGrayEnabled || row.jobGrayEnabled ? "存在菜单能力灰度覆盖" : "按平台正式版本生效"}
                </Typography.Text>
              )
            }
          ]}
        />
      </Card>

      <Card title="菜单能力待办" style={{ marginTop: 12 }}>
        <Table<PublishPendingItem>
          rowKey="id"
          loading={loading}
          dataSource={menuCapabilityPendingItems}
          pagination={false}
          columns={[
            { title: "待办项", dataIndex: "resourceName" },
            {
              title: "类型",
              dataIndex: "resourceType",
              width: 150,
              render: (value: PublishPendingItem["resourceType"]) => resourceTypeLabelMap[value]
            },
            { title: "归属机构", dataIndex: "ownerOrgId", width: 140, render: (value: string) => <OrgText value={value} /> },
            {
              title: "当前状态",
              width: 120,
              render: (_, row) => <Tag color={pendingColor[row.pendingType]}>{pendingTypeLabelMap[row.pendingType]}</Tag>
            },
            {
              title: "处理方式",
              width: 220,
              render: () =>
                canManageMenuCapability ? (
              <Typography.Text>由菜单能力管理员进入特殊权限流程处理</Typography.Text>
                ) : (
                  <Typography.Text type="secondary">当前视角只读查看</Typography.Text>
                )
            }
          ]}
        />
      </Card>

      <Card title="菜单能力记录" style={{ marginTop: 12 }}>
        <Table<PublishAuditLog>
          rowKey="id"
          loading={loading}
          dataSource={menuCapabilityLogs}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            {
              title: "动作",
              width: 120,
              render: (_, row) => <Tag color={row.action === "PUBLISH" ? "green" : "blue"}>{auditActionLabelMap[row.action]}</Tag>
            },
            {
              title: "对象类型",
              dataIndex: "resourceType",
              width: 150,
              render: (value: string) => resourceTypeLabelMap[(value as keyof typeof resourceTypeLabelMap) ?? "PAGE_RESOURCE"] ?? value
            },
            { title: "对象名称", dataIndex: "resourceName" },
            { title: "操作人", dataIndex: "operator", width: 140, render: (value: string) => <PersonText value={value} /> },
            { title: "时间", dataIndex: "createdAt", width: 180 }
          ]}
        />
      </Card>
        </>
      )}

      <Modal
        title="发布检查结果"
        open={validationModal.open}
        onCancel={() => setValidationModal({ open: false, item: null, report: null })}
        footer={
          validationModal.report?.pass && validationModal.item && canPublishConfig ? (
            <Button
              type="primary"
              onClick={() => {
                void publish(validationModal.item as PublishPendingItem);
                setValidationModal({ open: false, item: null, report: null });
              }}
            >
              继续发布
            </Button>
          ) : undefined
        }
      >
        {validationModal.report ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Alert
              type={validationModal.report.pass ? "info" : "error"}
              showIcon
              message={validationModal.report.pass ? "检查已完成，可继续正式发布" : "存在阻断项，请先修复"}
              description={validationModal.report.impactSummary}
            />
            {validationModal.report.riskItems && validationModal.report.riskItems.length > 0 ? (
              <Card size="small" title="风险确认项">
                <Space direction="vertical" style={{ width: "100%" }} size={4}>
                  {validationModal.report.riskItems.map((item) => (
                    <Typography.Text key={item} type="secondary">
                      {item}
                    </Typography.Text>
                  ))}
                </Space>
              </Card>
            ) : null}
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={validationModal.report.items}
              columns={[
                { title: "检查项", dataIndex: "label", width: 170 },
                {
                  title: "结果",
                  width: 90,
                  render: (_, row: ValidationReport["items"][number]) =>
                    row.passed ? <Tag style={subtlePositiveTagStyle}>通过</Tag> : <Tag color="red">阻断</Tag>
                },
                { title: "说明", dataIndex: "detail" }
              ]}
            />
          </Space>
        ) : null}
      </Modal>

      <Modal
        title="配置发布结果"
        open={batchPublishResult.open}
        onCancel={() => setBatchPublishResult({ open: false, published: [], blocked: [], skippedRiskPending: [] })}
        footer={null}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert
            showIcon
            type={batchPublishResult.blocked.length > 0 ? "warning" : "info"}
            message={
              batchPublishResult.blocked.length > 0
                ? `已发布 ${batchPublishResult.published.length} 个对象，另有 ${batchPublishResult.blocked.length} 个对象被阻断`
                : `已发布 ${batchPublishResult.published.length} 个对象`
            }
            description={
              batchPublishResult.skippedRiskPending.length > 0
                ? `另有 ${batchPublishResult.skippedRiskPending.length} 个对象因待风险确认未参与本次发布。`
                : "本次没有待风险确认的跳过对象。"
            }
          />
          <Card size="small" title="已发布">
            {batchPublishResult.published.length > 0 ? (
              <Space size={[8, 8]} wrap>
                {batchPublishResult.published.map((name) => (
                  <Tag style={subtlePositiveTagStyle} key={name}>
                    {name}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">本次没有对象成功发布。</Typography.Text>
            )}
          </Card>
          <Card size="small" title="被阻断">
            {batchPublishResult.blocked.length > 0 ? (
              <Table
                rowKey="name"
                size="small"
                pagination={false}
                dataSource={batchPublishResult.blocked}
                columns={[
                  { title: "对象", dataIndex: "name", width: 220 },
                  { title: "阻断原因", dataIndex: "reason" },
                  { title: "影响范围", dataIndex: "impactSummary" }
                ]}
              />
            ) : (
              <Typography.Text type="secondary">本次没有阻断对象。</Typography.Text>
            )}
          </Card>
          <Card size="small" title="待风险确认（未参与本次发布）">
            {batchPublishResult.skippedRiskPending.length > 0 ? (
              <Space size={[8, 8]} wrap>
                {batchPublishResult.skippedRiskPending.map((name) => (
                  <Tag color="gold" key={name}>
                    {name}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">本次没有因风险确认被跳过的对象。</Typography.Text>
            )}
          </Card>
        </Space>
      </Modal>

      <Modal
        title="配置发布向导"
        open={releaseOpen}
        width={820}
        onCancel={() => setReleaseOpen(false)}
        footer={[
          <Button
            key="prev"
            onClick={() => {
              if (releaseStep === 0) {
                setReleaseOpen(false);
                return;
              }
              setReleaseStep((prev) => Math.max(prev - 1, 0));
            }}
          >
            {releaseStep === 0 ? "取消" : "上一步"}
          </Button>,
          <Button key="next" type="primary" loading={publishingBatch} onClick={handleReleaseNext}>
            {releaseStep === 3 ? "确认发布" : "下一步"}
          </Button>
        ]}
      >
        <Steps
          current={releaseStep}
          size="small"
          style={{ marginBottom: 12 }}
          items={[
            { title: "选择待发布对象" },
            { title: "选择机构 / IP 试点" },
            { title: "选择生效时间" },
            { title: "确认影响范围" }
          ]}
        />

        {releaseStep === 0 ? (
          <Card size="small" title="选择待发布对象">
            <Select
              mode="multiple"
              style={{ width: "100%" }}
              value={selectedPendingIds}
              onChange={(value) => setSelectedPendingIds(value)}
              options={draftPendingItems.map((item) => ({
                label: `${resourceTypeLabelMap[item.resourceType]} / ${item.resourceName}`,
                value: item.id
              }))}
            />
          </Card>
        ) : null}

        {releaseStep === 1 ? (
          <Card size="small" title="机构与 IP 试点">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Typography.Text>机构范围</Typography.Text>
                <Select
                  mode="multiple"
                  style={{ width: "100%", marginTop: 8 }}
                  value={selectedOrgIds}
                  onChange={(value) => setSelectedOrgIds(value)}
                  options={orgOptions.map((item) => ({ label: getOrgLabel(item), value: item }))}
                  placeholder="未选择时默认按对象归属机构发布"
                />
              </div>
              <div>
                <Typography.Text>IP 试点（可选）</Typography.Text>
                <Input.TextArea
                  rows={3}
                  style={{ marginTop: 8 }}
                  value={trialIpDraft}
                  onChange={(event) => setTrialIpDraft(event.target.value)}
                  placeholder="多个 IP 使用换行、逗号或空格分隔；主要用于小范围试点验证"
                />
              </div>
              <Typography.Text type="secondary">
                当前已录入 IP：{selectedTrialIps.length > 0 ? selectedTrialIps.join("、") : "未配置"}
              </Typography.Text>
            </Space>
          </Card>
        ) : null}

        {releaseStep === 2 ? (
          <Card size="small" title="生效时间">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Segmented
                value={effectiveType}
                onChange={(value) => setEffectiveType(value as "IMMEDIATE" | "SCHEDULED")}
                options={[
                  { label: "立即生效", value: "IMMEDIATE" },
                  { label: "定时生效", value: "SCHEDULED" }
                ]}
              />
              {effectiveType === "SCHEDULED" ? (
                <Input value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} placeholder="YYYY-MM-DD HH:mm" />
              ) : (
                <Typography.Text type="secondary">将于当前提交后立即生效。</Typography.Text>
              )}
            </Space>
          </Card>
        ) : null}

        {releaseStep === 3 ? (
          <Card size="small" title="影响确认">
            <Space direction="vertical">
              <Alert
                showIcon
                type="warning"
                message="请确认本次配置发布影响范围"
                description="确认后将对选中对象逐项执行最终检查并发布；存在阻断项的对象会留在待发布列表。"
              />
              <Space wrap>
                <Tag color="blue">选中对象 {selectedPublishItems.length}</Tag>
                <Tag color="purple">影响机构 {selectedOrgIds.length > 0 ? selectedOrgIds.length : orgOptions.length}</Tag>
                <Tag color="gold">IP 试点 {selectedTrialIps.length}</Tag>
                <Tag>{effectiveType === "IMMEDIATE" ? "立即生效" : `定时生效：${effectiveAt || "未填写"}`}</Tag>
              </Space>
              <Table<PublishPendingItem>
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={selectedPublishItems}
                columns={[
                  { title: "对象", dataIndex: "resourceName" },
                  {
                    title: "类型",
                    dataIndex: "resourceType",
                    width: 140,
                    render: (value: PublishPendingItem["resourceType"]) => resourceTypeLabelMap[value]
                  },
                  { title: "归属机构", dataIndex: "ownerOrgId", width: 140, render: (value: string) => <OrgText value={value} /> }
                ]}
              />
            </Space>
          </Card>
        ) : null}
      </Modal>
    </div>
  );
}
