import { ArrowRightOutlined } from "@ant-design/icons";
import { Button, Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { pendingTypeLabelMap, resourceTypeLabelMap } from "../../enumLabels";
import { getOrgLabel } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import type { DashboardOverview, ExecutionLogItem, PublishPendingItem, PublishPendingSummary, TriggerLogItem } from "../../types";

type DropReminder = {
  key: string;
  pageName: string;
  scope: string;
  dropRatio: number;
  detail: string;
};

const PageHeader = styled.div`
  margin-bottom: var(--space-24);
`;

const PageTitle = styled(Typography.Title)`
  && {
    margin: 0;
  }
`;

const PageIntro = styled(Typography.Paragraph)`
  && {
    margin: var(--space-8) 0 0;
    color: var(--color-text-secondary);
  }
`;

const MetricCard = styled(Card)`
  height: 100%;
`;

const SectionRow = styled(Row)`
  margin-top: var(--space-16);
`;

const RecentCard = styled(Card)`
  margin-top: var(--space-16);
`;

const DashboardSpace = styled(Space)`
  width: 100%;
`;

const ListSection = styled.div`
  margin-top: var(--space-12);
`;

export function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [pendingSummary, setPendingSummary] = useState<PublishPendingSummary | null>(null);
  const [pendingItems, setPendingItems] = useState<PublishPendingItem[]>([]);
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
          detail: ratio >= 50 ? "触发命中下降明显，请复核规则和发布变更。" : "波动可控，持续观察。"
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
      <PageHeader>
        <PageTitle className="type-24">我的工作台</PageTitle>
        <PageIntro className="type-14">
          今天先看待处理和下降提醒，再从“菜单管理”进入主路径，继续完成配置、发布和结果查看。
        </PageIntro>
      </PageHeader>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard loading={loading}>
            <Statistic title="待发布事项" value={pendingSummary?.draftCount ?? 0} />
          </MetricCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard loading={loading}>
            <Statistic title="待确认事项" value={pendingSummary?.riskConfirmPendingCount ?? 0} />
          </MetricCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard loading={loading}>
            <Statistic title="待补充配置" value={pendingSummary?.validationFailedCount ?? 0} />
          </MetricCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard loading={loading}>
            <Statistic title="下降提醒" value={dropReminders.length} />
          </MetricCard>
        </Col>
      </Row>

      <SectionRow gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="我的待处理" loading={loading}>
            <Space wrap size={8}>
              <Tag>待发布 {pendingSummary?.draftCount ?? 0}</Tag>
              <Tag>待确认 {pendingSummary?.riskConfirmPendingCount ?? 0}</Tag>
              <Tag>待补充配置 {pendingSummary?.validationFailedCount ?? 0}</Tag>
            </Space>
            <ListSection>
              <List
                size="small"
                dataSource={pendingItems}
                locale={{ emptyText: "暂无待处理事项" }}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Tag>{pendingTypeLabelMap[item.pendingType]}</Tag>
                      <Typography.Text className="card-info">{item.resourceName}</Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </ListSection>
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
                  <Space direction="vertical" size={4}>
                    <Typography.Text strong>{item.pageName}</Typography.Text>
                    <Typography.Text type="secondary" className="card-info">
                      {getOrgLabel(item.scope)} · 下降 {item.dropRatio}%
                    </Typography.Text>
                    <Typography.Text type="secondary" className="card-info">{item.detail}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </SectionRow>

      <RecentCard title="我最近改过" loading={loading}>
        <List
          size="small"
          dataSource={recentEdits}
          locale={{ emptyText: "暂无最近修改记录" }}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Tag>{resourceTypeLabelMap[item.type]}</Tag>
                <Typography.Text className="card-info">{item.name}</Typography.Text>
                <Typography.Text type="secondary" className="type-12">
                  {item.updatedAt}
                </Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </RecentCard>

      <SectionRow gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="常用入口">
            <DashboardSpace direction="vertical" size={12}>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/page-management")}>进入菜单管理</Button>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/prompts?action=create")}>新建提示规则</Button>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/prompts")}>复制已有规则</Button>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/interfaces")}>注册 API</Button>
              <Button block icon={<ArrowRightOutlined />} onClick={() => navigate("/stats")}>查看运行统计</Button>
            </DashboardSpace>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="业务看板" loading={loading}>
            <Row gutter={[16, 16]}>
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
      </SectionRow>
    </div>
  );
}
