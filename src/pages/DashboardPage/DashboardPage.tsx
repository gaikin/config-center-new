import { ArrowRightOutlined } from "@ant-design/icons";
import { Button, Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pendingTypeLabelMap } from "../../enumLabels";
import { configCenterService } from "../../services/configCenterService";
import type { DashboardOverview, ExecutionLogItem, GovernancePendingItem, GovernancePendingSummary, TriggerLogItem } from "../../types";

type DropReminder = {
  key: string;
  pageName: string;
  scope: string;
  dropRatio: number;
  detail: string;
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [pendingSummary, setPendingSummary] = useState<GovernancePendingSummary | null>(null);
  const [pendingItems, setPendingItems] = useState<GovernancePendingItem[]>([]);
  const [triggerLogs, setTriggerLogs] = useState<TriggerLogItem[]>([]);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogItem[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const [overviewData, pendingSummaryData, pendingRows, triggerRows, executionRows] = await Promise.all([
          configCenterService.getDashboardOverview(),
          configCenterService.getPendingSummary(),
          configCenterService.listPendingItems(),
          configCenterService.listTriggerLogs(),
          configCenterService.listExecutionLogs()
        ]);
        if (!active) {
          return;
        }
        setOverview(overviewData);
        setPendingSummary(pendingSummaryData);
        setPendingItems(pendingRows.slice(0, 6));
        setTriggerLogs(triggerRows);
        setExecutionLogs(executionRows);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const dropReminders = useMemo<DropReminder[]>(() => {
    const grouped = new Map<string, { total: number; failOrMiss: number }>();
    for (const row of triggerLogs) {
      const key = row.pageResourceName;
      const prev = grouped.get(key) ?? { total: 0, failOrMiss: 0 };
      prev.total += 1;
      if (row.triggerResult !== "HIT") {
        prev.failOrMiss += 1;
      }
      grouped.set(key, prev);
    }
    return Array.from(grouped.entries())
      .map(([pageName, metric], index) => {
        const ratio = metric.total === 0 ? 0 : Number(((metric.failOrMiss / metric.total) * 100).toFixed(1));
        return {
          key: `${pageName}-${index}`,
          pageName,
          scope: index % 2 === 0 ? "branch-east" : "branch-south",
          dropRatio: ratio,
          detail: ratio >= 50 ? "触发命中下降明显，建议复核规则和发布变更。" : "波动可控，持续观察。"
        };
      })
      .filter((item) => item.dropRatio >= 30)
      .slice(0, 4);
  }, [triggerLogs]);

  const triggerCount = triggerLogs.length;
  const executionCount = executionLogs.length;
  const recentEdits = useMemo(
    () =>
      [...pendingItems]
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 5)
        .map((item, index) => ({
          key: `${item.id}-${index}`,
          name: item.resourceName,
          type: item.resourceType,
          updatedAt: item.updatedAt
        })),
    [pendingItems]
  );

  return (
    <div>
      <Typography.Title level={4}>我的工作台</Typography.Title>
      <Typography.Paragraph type="secondary">
        今天先看待处理和下降提醒，再从常用入口进入页面管理、智能提示、API注册和发布与灰度。
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="待发布事项" value={pendingSummary?.draftCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="待确认事项" value={pendingSummary?.riskConfirmPendingCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="待补充配置" value={pendingSummary?.validationFailedCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="下降提醒" value={dropReminders.length} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={12}>
          <Card title="我的待处理" loading={loading}>
            <Space wrap>
              <Tag color="blue">待发布 {pendingSummary?.draftCount ?? 0}</Tag>
              <Tag color="orange">待确认 {pendingSummary?.riskConfirmPendingCount ?? 0}</Tag>
              <Tag color="volcano">待补充配置 {pendingSummary?.validationFailedCount ?? 0}</Tag>
            </Space>
            <List
              style={{ marginTop: 12 }}
              size="small"
              dataSource={pendingItems}
              locale={{ emptyText: "暂无待处理事项" }}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Tag>{pendingTypeLabelMap[item.pendingType]}</Tag>
                    <Typography.Text>{item.resourceName}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="运行提醒（触发下降）" loading={loading}>
            <List
              size="small"
              dataSource={dropReminders}
              locale={{ emptyText: "暂无明显下降提醒" }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>{item.pageName}</Typography.Text>
                    <Typography.Text type="secondary">
                      {item.scope} · 下降 {item.dropRatio}%
                    </Typography.Text>
                    <Typography.Text type="secondary">{item.detail}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="我最近改过" loading={loading} style={{ marginTop: 12 }}>
        <List
          size="small"
          dataSource={recentEdits}
          locale={{ emptyText: "暂无最近修改记录" }}
          renderItem={(item) => (
            <List.Item>
              <Space>
                <Tag color="geekblue">{item.type}</Tag>
                <Typography.Text>{item.name}</Typography.Text>
                <Typography.Text type="secondary">{item.updatedAt}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={12}>
          <Card title="常用入口">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/prompts?action=create")}>新建提示规则</Button>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/prompts")}>复制已有规则</Button>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/interfaces")}>注册 API</Button>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/publish")}>查看发布结果</Button>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/page-management")}>进入页面管理</Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="业务看板" loading={loading}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Statistic title="已启用页面数" value={overview?.pageResourceCount ?? 0} />
              </Col>
              <Col span={12}>
                <Statistic title="提示触发量" value={triggerCount} />
              </Col>
              <Col span={12}>
                <Statistic title="作业执行量" value={executionCount} />
              </Col>
              <Col span={12}>
                <Statistic title="下降提醒数" value={dropReminders.length} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
