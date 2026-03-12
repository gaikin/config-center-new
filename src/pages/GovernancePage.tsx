import { Alert, Button, Card, Col, Modal, Row, Segmented, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import type {
  GovernanceAuditLog,
  GovernancePendingItem,
  GovernancePendingSummary,
  ValidationReport
} from "../types";

type PendingFilter = "ALL" | GovernancePendingItem["pendingType"];

const pendingColor: Record<GovernancePendingItem["pendingType"], string> = {
  DRAFT: "default",
  EXPIRING_SOON: "orange",
  VALIDATION_FAILED: "red",
  CONFLICT: "volcano",
  RISK_CONFIRM: "gold"
};

const pendingLabel: Record<GovernancePendingItem["pendingType"], string> = {
  DRAFT: "待发布",
  EXPIRING_SOON: "即将到期",
  VALIDATION_FAILED: "校验失败",
  CONFLICT: "冲突",
  RISK_CONFIRM: "待风险确认"
};

const actionColor: Record<GovernanceAuditLog["action"], string> = {
  PUBLISH: "green",
  DISABLE: "orange",
  ROLLBACK: "volcano",
  RISK_CONFIRM: "gold",
  ROLE_UPDATE: "blue",
  DEFER: "cyan",
  VALIDATE: "purple",
  RESOLVE: "geekblue"
};

export function GovernancePage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GovernancePendingSummary | null>(null);
  const [pendingItems, setPendingItems] = useState<GovernancePendingItem[]>([]);
  const [logs, setLogs] = useState<GovernanceAuditLog[]>([]);
  const [filter, setFilter] = useState<PendingFilter>("ALL");
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
      const [summaryData, pendingData, logData] = await Promise.all([
        configCenterService.getPendingSummary(),
        configCenterService.listPendingItems(),
        configCenterService.listAuditLogs()
      ]);
      setSummary(summaryData);
      setPendingItems(pendingData);
      setLogs(logData);
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

  async function validate(item: GovernancePendingItem) {
    setValidatingId(item.id);
    try {
      const report = await configCenterService.validatePendingItem(item.id);
      setValidationModal({ open: true, item, report });
      msgApi.info(report.pass ? "校验通过，可发布" : "校验存在阻断项");
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
      const text = error instanceof Error ? error.message : "发布失败";
      msgApi.error(text);
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

  async function rollback(log: GovernanceAuditLog) {
    if (!log.resourceId) {
      msgApi.warning("缺少资源 ID，无法回滚");
      return;
    }
    await configCenterService.rollbackResource(log.resourceType, log.resourceId);
    msgApi.success(`已发起回滚：${log.resourceName}`);
    await loadData();
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>治理工作台</Typography.Title>
      <Typography.Paragraph type="secondary">
        默认聚焦待处理事项：待发布、即将到期、校验失败、冲突和待风险确认。支持发布前强校验、延期、处理闭环与回滚。
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable onClick={() => setFilter("DRAFT")}>
            <Statistic title="待发布" value={summary?.draftCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable onClick={() => setFilter("EXPIRING_SOON")}>
            <Statistic title="即将到期" value={summary?.expiringSoonCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable onClick={() => setFilter("VALIDATION_FAILED")}>
            <Statistic title="校验失败" value={summary?.validationFailedCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable onClick={() => setFilter("CONFLICT")}>
            <Statistic title="冲突项" value={summary?.conflictCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable onClick={() => setFilter("RISK_CONFIRM")}>
            <Statistic title="待风险确认" value={summary?.riskConfirmPendingCount ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card
        title="待处理列表"
        style={{ marginTop: 16 }}
        extra={
          <Segmented
            options={[
              { label: "全部", value: "ALL" },
              { label: "待发布", value: "DRAFT" },
              { label: "即将到期", value: "EXPIRING_SOON" },
              { label: "校验失败", value: "VALIDATION_FAILED" },
              { label: "冲突", value: "CONFLICT" },
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
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "对象类型", dataIndex: "resourceType", width: 130 },
            { title: "对象名称", dataIndex: "resourceName" },
            { title: "组织范围", dataIndex: "ownerOrgId", width: 140 },
            {
              title: "待处理类型",
              width: 140,
              render: (_, row) => <Tag color={pendingColor[row.pendingType]}>{pendingLabel[row.pendingType]}</Tag>
            },
            { title: "状态", dataIndex: "status", width: 100 },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 320,
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

      <Card title="最近治理日志" style={{ marginTop: 16 }}>
        <Table<GovernanceAuditLog>
          rowKey="id"
          loading={loading}
          dataSource={logs}
          pagination={{ pageSize: 6 }}
          columns={[
            {
              title: "动作",
              width: 140,
              render: (_, row) => <Tag color={actionColor[row.action]}>{row.action}</Tag>
            },
            { title: "对象类型", dataIndex: "resourceType", width: 120 },
            { title: "对象名称", dataIndex: "resourceName" },
            { title: "操作人", dataIndex: "operator", width: 120 },
            { title: "时间", dataIndex: "createdAt", width: 180 },
            {
              title: "操作",
              width: 120,
              render: (_, row) =>
                row.action === "PUBLISH" && row.resourceId ? (
                  <Button size="small" onClick={() => void rollback(row)}>
                    回滚
                  </Button>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                )
            }
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
                { title: "校验项", dataIndex: "label", width: 160 },
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
    </div>
  );
}
