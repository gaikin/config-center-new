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
import { auditActionLabelMap, pendingTypeLabelMap } from "../../enumLabels";
import { configCenterService } from "../../services/configCenterService";
import type {
  GovernanceAuditLog,
  GovernancePendingItem,
  GovernancePendingSummary,
  MenuSdkPolicy,
  PageMenu,
  PageRegion,
  SdkReleaseLane,
  ValidationReport
} from "../../types";

type PendingFilter = "ALL" | GovernancePendingItem["pendingType"];

const pendingColor: Record<GovernancePendingItem["pendingType"], string> = {
  DRAFT: "default",
  EXPIRING_SOON: "orange",
  VALIDATION_FAILED: "red",
  CONFLICT: "volcano",
  RISK_CONFIRM: "gold"
};

export function GovernancePage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GovernancePendingSummary | null>(null);
  const [pendingItems, setPendingItems] = useState<GovernancePendingItem[]>([]);
  const [logs, setLogs] = useState<GovernanceAuditLog[]>([]);
  const [policies, setPolicies] = useState<MenuSdkPolicy[]>([]);
  const [regions, setRegions] = useState<PageRegion[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [lanes, setLanes] = useState<SdkReleaseLane[]>([]);
  const [filter, setFilter] = useState<PendingFilter>("ALL");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseStep, setReleaseStep] = useState(0);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<number[]>([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [effectiveType, setEffectiveType] = useState<"IMMEDIATE" | "SCHEDULED">("IMMEDIATE");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [publishingBatch, setPublishingBatch] = useState(false);
  const [validatingId, setValidatingId] = useState<number>();
  const [validationModal, setValidationModal] = useState<{
    open: boolean;
    item: GovernancePendingItem | null;
    report: ValidationReport | null;
  }>({ open: false, item: null, report: null });
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const [summaryData, pendingData, logData, policyData, regionData, menuData, laneData] = await Promise.all([
        configCenterService.getPendingSummary(),
        configCenterService.listPendingItems(),
        configCenterService.listAuditLogs(),
        configCenterService.listMenuSdkPolicies(),
        configCenterService.listPageRegions(),
        configCenterService.listPageMenus(),
        configCenterService.listSdkReleaseLanes()
      ]);
      setSummary(summaryData);
      setPendingItems(pendingData);
      setLogs(logData);
      setPolicies(policyData);
      setRegions(regionData);
      setMenus(menuData);
      setLanes(laneData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredPendingItems = useMemo(() => {
    if (filter === "ALL") {
      return pendingItems;
    }
    return pendingItems.filter((item) => item.pendingType === filter);
  }, [filter, pendingItems]);

  const regionMap = useMemo(() => Object.fromEntries(regions.map((item) => [item.id, item.regionName])), [regions]);
  const menuMap = useMemo(() => Object.fromEntries(menus.map((item) => [item.id, item])), [menus]);
  const laneMap = useMemo(() => Object.fromEntries(lanes.map((item) => [item.id, `${item.laneName} (${item.sdkVersion})`])), [lanes]);

  const affectedOrgsCount = useMemo(() => {
    const all = new Set<string>();
    for (const policy of policies) {
      if (policy.grayOrgIds.length === 0) {
        all.add("全部机构");
      }
      policy.grayOrgIds.forEach((item) => all.add(item));
    }
    return all.size;
  }, [policies]);

  const pilotPolicies = policies.filter((item) => item.grayOrgIds.length > 0);
  const publishLogs = logs.filter((item) => item.action === "PUBLISH");
  const draftPendingItems = pendingItems.filter((item) => item.pendingType === "DRAFT");
  const orgOptions = useMemo(() => {
    const set = new Set<string>();
    for (const policy of policies) {
      policy.grayOrgIds.forEach((item) => set.add(item));
    }
    return Array.from(set);
  }, [policies]);

  function openReleaseFlow() {
    setSelectedPolicyIds(policies.map((item) => item.id));
    setSelectedOrgIds(orgOptions);
    setEffectiveType("IMMEDIATE");
    setEffectiveAt("2026-03-14 20:00");
    setReleaseStep(0);
    setReleaseOpen(true);
  }

  function validateReleaseStep(step: number) {
    if (step === 0 && selectedPolicyIds.length === 0) {
      msgApi.warning("请至少选择一个发布菜单");
      return false;
    }
    if (step === 1 && draftPendingItems.length === 0) {
      msgApi.warning("当前没有可发布对象");
      return false;
    }
    if (step === 2 && selectedOrgIds.length === 0) {
      msgApi.warning("未选择机构时将默认全部机构，请确认是否继续");
      return true;
    }
    if (step === 3 && effectiveType === "SCHEDULED" && !effectiveAt.trim()) {
      msgApi.warning("请选择定时生效时间");
      return false;
    }
    return true;
  }

  function handleReleaseNext() {
    if (!validateReleaseStep(releaseStep)) {
      return;
    }
    if (releaseStep < 4) {
      setReleaseStep((prev) => Math.min(prev + 1, 4));
      return;
    }
    void publishBatch();
  }

  async function publishBatch() {
    setPublishingBatch(true);
    try {
      for (const item of draftPendingItems) {
        try {
          await configCenterService.publishPendingItem(item.id, "Business Manager");
        } catch {
          // 忽略单条失败，继续发布其余可发布项
        }
      }
      msgApi.success("批量发布已执行，请在发布记录中确认结果");
      setReleaseOpen(false);
      await loadData();
    } finally {
      setPublishingBatch(false);
    }
  }

  async function validate(item: GovernancePendingItem) {
    setValidatingId(item.id);
    try {
      const report = await configCenterService.validatePendingItem(item.id);
      setValidationModal({ open: true, item, report });
      msgApi.info(report.pass ? "校验通过，可进入发布" : "校验存在阻断项");
      await loadData();
    } finally {
      setValidatingId(undefined);
    }
  }

  async function publish(item: GovernancePendingItem) {
    try {
      await configCenterService.publishPendingItem(item.id);
      msgApi.success(`已发布：${item.resourceName}`);
      await loadData();
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "发布失败");
      await loadData();
    }
  }

  async function defer(item: GovernancePendingItem) {
    await configCenterService.deferPendingItem(item.id);
    msgApi.success(`已延期处理：${item.resourceName}`);
    await loadData();
  }

  async function confirmRisk(item: GovernancePendingItem) {
    if (item.resourceType !== "JOB_SCENE") {
      return;
    }
    await configCenterService.confirmJobSceneRisk(item.resourceId);
    msgApi.success(`已完成风险确认：${item.resourceName}`);
    await loadData();
  }

  async function resolve(item: GovernancePendingItem) {
    await configCenterService.resolvePendingItem(item.id);
    msgApi.success(`已标记处理完成：${item.resourceName}`);
    await loadData();
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>发布与灰度</Typography.Title>
      <Typography.Paragraph type="secondary">
        聚焦“改了什么、影响哪里、何时生效”。灰度范围保持机构级，不下钻到人员级。
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="待发布内容" value={summary?.draftCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="生效范围（机构）" value={affectedOrgsCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="试点发布策略" value={pilotPolicies.length} />
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
        title="发布步骤（业务视角）"
        extra={
          <Button type="primary" onClick={openReleaseFlow}>
            发起发布
          </Button>
        }
      >
        <Steps
          items={[
            { title: "选专区/菜单" },
            { title: "自动汇总待发布内容" },
            { title: "选择机构范围" },
            { title: "选择生效时间" },
            { title: "确认影响范围并发布" }
          ]}
        />
      </Card>

      <Card
        title="待发布内容"
        style={{ marginTop: 12 }}
        extra={
          <Segmented
            options={[
              { label: "全部", value: "ALL" },
              { label: "待发布", value: "DRAFT" },
              { label: "校验失败", value: "VALIDATION_FAILED" },
              { label: "待风险确认", value: "RISK_CONFIRM" }
            ]}
            value={filter}
            onChange={(value) => setFilter(value as PendingFilter)}
          />
        }
      >
        <Table<GovernancePendingItem>
          rowKey="id"
          loading={loading}
          dataSource={filteredPendingItems}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            { title: "变更对象", dataIndex: "resourceName" },
            { title: "对象类型", dataIndex: "resourceType", width: 130 },
            { title: "机构范围", dataIndex: "ownerOrgId", width: 140 },
            {
              title: "当前状态",
              width: 120,
              render: (_, row) => <Tag color={pendingColor[row.pendingType]}>{pendingTypeLabelMap[row.pendingType]}</Tag>
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 330,
              render: (_, row) => (
                <Space wrap>
                  <Button size="small" loading={validatingId === row.id} onClick={() => void validate(row)}>
                    校验
                  </Button>
                  <Button size="small" type="primary" onClick={() => void publish(row)}>
                    发布
                  </Button>
                  {row.pendingType === "EXPIRING_SOON" ? (
                    <Button size="small" onClick={() => void defer(row)}>
                      延期
                    </Button>
                  ) : null}
                  {row.pendingType === "RISK_CONFIRM" && row.resourceType === "JOB_SCENE" ? (
                    <Button size="small" onClick={() => void confirmRisk(row)}>
                      风险确认
                    </Button>
                  ) : null}
                  <Button size="small" onClick={() => void resolve(row)}>
                    标记完成
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Card title="生效范围与试点发布" style={{ marginTop: 12 }}>
        <Table<MenuSdkPolicy>
          rowKey="id"
          loading={loading}
          dataSource={policies}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            {
              title: "专区/菜单",
              width: 240,
              render: (_, row) => {
                const menu = menuMap[row.menuId];
                return `${regionMap[row.regionId] ?? "-"} / ${menu?.menuName ?? row.menuCode}`;
              }
            },
            {
              title: "线上版本",
              width: 180,
              render: (_, row) => laneMap[row.stableLaneId] ?? row.stableLaneId
            },
            {
              title: "试点版本",
              width: 180,
              render: (_, row) => (row.grayLaneId ? laneMap[row.grayLaneId] ?? row.grayLaneId : <Typography.Text type="secondary">未配置</Typography.Text>)
            },
            {
              title: "生效范围",
              width: 230,
              render: (_, row) =>
                row.grayOrgIds.length > 0 ? (
                  <Space wrap>
                    {row.grayOrgIds.map((org) => (
                      <Tag key={org}>{org}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Tag color="green">全部机构</Tag>
                )
            },
            {
              title: "生效时间",
              width: 230,
              render: (_, row) => `${row.effectiveStart} ~ ${row.effectiveEnd}`
            }
          ]}
        />
      </Card>

      <Card title="发布记录" style={{ marginTop: 12 }}>
        <Table<GovernanceAuditLog>
          rowKey="id"
          loading={loading}
          dataSource={logs}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            {
              title: "动作",
              width: 120,
              render: (_, row) => <Tag color={row.action === "PUBLISH" ? "green" : "blue"}>{auditActionLabelMap[row.action]}</Tag>
            },
            { title: "对象类型", dataIndex: "resourceType", width: 140 },
            { title: "对象名称", dataIndex: "resourceName" },
            { title: "操作人", dataIndex: "operator", width: 140 },
            { title: "时间", dataIndex: "createdAt", width: 180 }
          ]}
        />
      </Card>

      <Modal
        title="发布前校验结果"
        open={validationModal.open}
        onCancel={() => setValidationModal({ open: false, item: null, report: null })}
        footer={
          validationModal.report?.pass && validationModal.item ? (
            <Button
              type="primary"
              onClick={() => {
                void publish(validationModal.item as GovernancePendingItem);
                setValidationModal({ open: false, item: null, report: null });
              }}
            >
              校验通过并发布
            </Button>
          ) : undefined
        }
      >
        {validationModal.report ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Alert
              type={validationModal.report.pass ? "success" : "error"}
              showIcon
              message={validationModal.report.pass ? "所有校验已通过" : "存在阻断项，请先修复"}
            />
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={validationModal.report.items}
              columns={[
                { title: "校验项", dataIndex: "label", width: 170 },
                {
                  title: "结果",
                  width: 90,
                  render: (_, row: ValidationReport["items"][number]) =>
                    row.passed ? <Tag color="green">通过</Tag> : <Tag color="red">阻断</Tag>
                },
                { title: "说明", dataIndex: "detail" }
              ]}
            />
          </Space>
        ) : null}
      </Modal>

      <Modal
        title="发布向导"
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
            {releaseStep === 4 ? "确认发布" : "下一步"}
          </Button>
        ]}
      >
        <Steps
          current={releaseStep}
          size="small"
          style={{ marginBottom: 12 }}
          items={[
            { title: "选专区/菜单" },
            { title: "汇总待发布内容" },
            { title: "选机构范围" },
            { title: "选生效时间" },
            { title: "影响确认" }
          ]}
        />

        {releaseStep === 0 ? (
          <Card size="small" title="选择发布菜单">
            <Select
              mode="multiple"
              style={{ width: "100%" }}
              value={selectedPolicyIds}
              onChange={(value) => setSelectedPolicyIds(value)}
              options={policies.map((item) => {
                const menu = menuMap[item.menuId];
                return {
                  label: `${regionMap[item.regionId] ?? "-"} / ${menu?.menuName ?? item.menuCode}`,
                  value: item.id
                };
              })}
            />
          </Card>
        ) : null}

        {releaseStep === 1 ? (
          <Card size="small" title="待发布内容汇总">
            <Alert
              showIcon
              type={draftPendingItems.length > 0 ? "info" : "warning"}
              style={{ marginBottom: 12 }}
              message={draftPendingItems.length > 0 ? `共 ${draftPendingItems.length} 个对象待发布` : "当前无可发布对象"}
              description="校验失败或待风险确认对象不会被强制发布。"
            />
            <Table<GovernancePendingItem>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={draftPendingItems}
              columns={[
                { title: "对象", dataIndex: "resourceName" },
                { title: "类型", dataIndex: "resourceType", width: 160 },
                { title: "机构", dataIndex: "ownerOrgId", width: 140 }
              ]}
            />
          </Card>
        ) : null}

        {releaseStep === 2 ? (
          <Card size="small" title="生效机构范围">
            <Typography.Paragraph type="secondary">
              仅支持机构级范围。若不手动选择，默认按菜单策略中的机构范围生效。
            </Typography.Paragraph>
            <Select
              mode="multiple"
              style={{ width: "100%" }}
              value={selectedOrgIds}
              onChange={(value) => setSelectedOrgIds(value)}
              options={orgOptions.map((item) => ({ label: item, value: item }))}
              placeholder="未选择时默认全部机构"
            />
          </Card>
        ) : null}

        {releaseStep === 3 ? (
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

        {releaseStep === 4 ? (
          <Card size="small" title="影响确认">
            <Space direction="vertical">
              <Alert
                showIcon
                type="warning"
                message="请确认影响范围"
                description="确认后将按当前选择发起发布，未通过校验的对象会被自动跳过。"
              />
              <Space wrap>
                <Tag color="blue">影响菜单 {selectedPolicyIds.length}</Tag>
                <Tag color="purple">影响机构 {selectedOrgIds.length > 0 ? selectedOrgIds.length : affectedOrgsCount}</Tag>
                <Tag color="green">待发布对象 {draftPendingItems.length}</Tag>
                <Tag>{effectiveType === "IMMEDIATE" ? "立即生效" : `定时生效：${effectiveAt || "未填写"}`}</Tag>
              </Space>
              <Typography.Text type="secondary">
                发布后请前往“运行统计”查看发布前后对比与下降提醒。
              </Typography.Text>
            </Space>
          </Card>
        ) : null}
      </Modal>
    </div>
  );
}
