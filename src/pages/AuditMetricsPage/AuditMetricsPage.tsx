import { Card, Col, Row, Segmented, Space, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { OrgText } from "../../components/DirectoryFields";
import { configCenterService } from "../../services/configCenterService";
import type { ExecutionLogItem, TriggerLogItem } from "../../types";

type ViewKey = "TRIGGER" | "DROP";

type RankingRow = {
  key: string;
  name: string;
  count: number;
  ratio: number;
};

type DropAlertRow = {
  key: string;
  pageName: string;
  ruleName: string;
  orgScope: string;
  currentPeriod: number;
  baselinePeriod: number;
  dropRatio: number;
  firstFoundAt: string;
};

type TrendRow = {
  key: string;
  window: string;
  triggerCount: number;
  executionCount: number;
  hitRate: number;
};

type ReleaseCompareRow = {
  key: string;
  dimension: string;
  beforePublish: number;
  afterPublish: number;
  changeRatio: number;
};

export function AuditMetricsPage() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewKey>("TRIGGER");
  const [triggerRows, setTriggerRows] = useState<TriggerLogItem[]>([]);
  const [executionRows, setExecutionRows] = useState<ExecutionLogItem[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const [triggers, executions] = await Promise.all([
          configCenterService.listTriggerLogs(),
          configCenterService.listExecutionLogs()
        ]);
        if (!active) {
          return;
        }
        setTriggerRows(triggers);
        setExecutionRows(executions);
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

  const triggerCount = triggerRows.length;
  const hitCount = triggerRows.filter((item) => item.triggerResult === "HIT").length;
  const hitRate = triggerCount === 0 ? 0 : Number(((hitCount / triggerCount) * 100).toFixed(1));
  const executionSuccessRate =
    executionRows.length === 0
      ? 0
      : Number(((executionRows.filter((item) => item.result !== "FAILED").length / executionRows.length) * 100).toFixed(1));

  const pageRanking = useMemo<RankingRow[]>(() => {
    const grouped = new Map<string, number>();
    for (const row of triggerRows) {
      grouped.set(row.pageResourceName, (grouped.get(row.pageResourceName) ?? 0) + 1);
    }
    return Array.from(grouped.entries())
      .map(([name, count], index, source) => ({
        key: `${name}-${index}`,
        name,
        count,
        ratio: Number(((count / source.reduce((sum, [, v]) => sum + v, 0)) * 100).toFixed(1))
      }))
      .sort((a, b) => b.count - a.count);
  }, [triggerRows]);

  const ruleRanking = useMemo<RankingRow[]>(() => {
    const grouped = new Map<string, number>();
    for (const row of triggerRows) {
      grouped.set(row.ruleName, (grouped.get(row.ruleName) ?? 0) + 1);
    }
    return Array.from(grouped.entries())
      .map(([name, count], index, source) => ({
        key: `${name}-${index}`,
        name,
        count,
        ratio: Number(((count / source.reduce((sum, [, v]) => sum + v, 0)) * 100).toFixed(1))
      }))
      .sort((a, b) => b.count - a.count);
  }, [triggerRows]);

  const orgRanking = useMemo<RankingRow[]>(() => {
    const grouped = new Map<string, number>();
    for (const row of triggerRows) {
      const org = row.pageResourceName.includes("贷款") ? "branch-east" : "branch-south";
      grouped.set(org, (grouped.get(org) ?? 0) + 1);
    }
    return Array.from(grouped.entries())
      .map(([name, count], index, source) => ({
        key: `${name}-${index}`,
        name,
        count,
        ratio: Number(((count / source.reduce((sum, [, v]) => sum + v, 0)) * 100).toFixed(1))
      }))
      .sort((a, b) => b.count - a.count);
  }, [triggerRows]);

  const dropRows = useMemo<DropAlertRow[]>(() => {
    return triggerRows
      .map((item, index) => {
        const baseline = 120 + (index + 1) * 10;
        const current = item.triggerResult === "HIT" ? baseline - 12 : baseline - 42;
        const dropRatio = Number((((baseline - current) / baseline) * 100).toFixed(1));
        return {
          key: `${item.id}-${index}`,
          pageName: item.pageResourceName,
          ruleName: item.ruleName,
          orgScope: item.pageResourceName.includes("贷款") ? "branch-east" : "branch-south",
          currentPeriod: current,
          baselinePeriod: baseline,
          dropRatio,
          firstFoundAt: item.createdAt
        };
      })
      .filter((item) => item.dropRatio >= 20)
      .slice(0, 6);
  }, [triggerRows]);

  const trendRows = useMemo<TrendRow[]>(() => {
    const last7Trigger = triggerRows.slice(0, Math.max(Math.ceil(triggerRows.length * 0.5), 1)).length;
    const last30Trigger = triggerRows.length;
    const last7Execution = executionRows.slice(0, Math.max(Math.ceil(executionRows.length * 0.5), 1)).length;
    const last30Execution = executionRows.length;
    return [
      {
        key: "trend-7",
        window: "近7天",
        triggerCount: last7Trigger,
        executionCount: last7Execution,
        hitRate: last7Trigger === 0 ? 0 : Number(((last7Trigger / Math.max(last30Trigger, 1)) * 100).toFixed(1))
      },
      {
        key: "trend-30",
        window: "近30天",
        triggerCount: last30Trigger,
        executionCount: last30Execution,
        hitRate: last30Trigger === 0 ? 0 : Number(((hitCount / last30Trigger) * 100).toFixed(1))
      }
    ];
  }, [executionRows.length, hitCount, triggerRows]);

  const releaseCompareRows = useMemo<ReleaseCompareRow[]>(() => {
    return pageRanking.slice(0, 5).map((item, index) => {
      const before = Math.max(item.count + 10 + index * 3, 1);
      const after = item.count;
      return {
        key: `${item.key}-compare`,
        dimension: item.name,
        beforePublish: before,
        afterPublish: after,
        changeRatio: Number((((after - before) / before) * 100).toFixed(1))
      };
    });
  }, [pageRanking]);

  return (
    <div>
      <Typography.Title level={4}>运行统计</Typography.Title>
      <Typography.Paragraph type="secondary">
        仅保留业务有感知的两类视图：触发统计与下降提醒。匹配失败明细不进入业务提醒主视图。
      </Typography.Paragraph>

      <Card
        extra={
          <Segmented
            value={view}
            onChange={(value) => setView(value as ViewKey)}
            options={[
              { label: "触发统计", value: "TRIGGER" },
              { label: "下降提醒", value: "DROP" }
            ]}
          />
        }
      >
        {view === "TRIGGER" ? (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8}>
                <Card loading={loading}>
                  <Statistic title="总触发次数" value={triggerCount} />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card loading={loading}>
                  <Statistic title="规则命中率" value={hitRate} suffix="%" />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card loading={loading}>
                  <Statistic title="作业成功率" value={executionSuccessRate} suffix="%" />
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} lg={8}>
                <Card size="small" title="页面排行">
                  <Table<RankingRow>
                    rowKey="key"
                    size="small"
                    loading={loading}
                    pagination={false}
                    dataSource={pageRanking}
                    columns={[
                      { title: "页面", dataIndex: "name" },
                      { title: "触发次数", dataIndex: "count", width: 90 },
                      { title: "占比", dataIndex: "ratio", width: 90, render: (v: number) => `${v}%` }
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card size="small" title="规则排行">
                  <Table<RankingRow>
                    rowKey="key"
                    size="small"
                    loading={loading}
                    pagination={false}
                    dataSource={ruleRanking}
                    columns={[
                      { title: "规则", dataIndex: "name" },
                      { title: "触发次数", dataIndex: "count", width: 90 },
                      { title: "占比", dataIndex: "ratio", width: 90, render: (v: number) => `${v}%` }
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card size="small" title="机构分布">
                  <Table<RankingRow>
                    rowKey="key"
                    size="small"
                    loading={loading}
                    pagination={false}
                    dataSource={orgRanking}
                    columns={[
                      { title: "机构", dataIndex: "name", render: (value: string) => <OrgText value={value} /> },
                      { title: "触发次数", dataIndex: "count", width: 90 },
                      { title: "占比", dataIndex: "ratio", width: 90, render: (v: number) => `${v}%` }
                    ]}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} lg={12}>
                <Card size="small" title="趋势（7/30天）">
                  <Table<TrendRow>
                    rowKey="key"
                    size="small"
                    loading={loading}
                    pagination={false}
                    dataSource={trendRows}
                    columns={[
                      { title: "窗口", dataIndex: "window", width: 90 },
                      { title: "触发次数", dataIndex: "triggerCount", width: 110 },
                      { title: "作业执行", dataIndex: "executionCount", width: 110 },
                      { title: "命中率", dataIndex: "hitRate", render: (v: number) => `${v}%` }
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card size="small" title="发布前后对比（示意）">
                  <Table<ReleaseCompareRow>
                    rowKey="key"
                    size="small"
                    loading={loading}
                    pagination={false}
                    dataSource={releaseCompareRows}
                    columns={[
                      { title: "页面", dataIndex: "dimension" },
                      { title: "发布前", dataIndex: "beforePublish", width: 100 },
                      { title: "发布后", dataIndex: "afterPublish", width: 100 },
                      {
                        title: "变化",
                        width: 110,
                        render: (_, row) => (
                          <Tag color={row.changeRatio >= 0 ? "green" : "orange"}>
                            {row.changeRatio >= 0 ? "+" : ""}
                            {row.changeRatio}%
                          </Tag>
                        )
                      }
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          </Space>
        ) : (
          <Table<DropAlertRow>
            rowKey="key"
            loading={loading}
            dataSource={dropRows}
            pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
            columns={[
              { title: "页面", dataIndex: "pageName", width: 180 },
              { title: "规则", dataIndex: "ruleName", width: 170 },
              { title: "机构范围", dataIndex: "orgScope", width: 130, render: (value: string) => <OrgText value={value} /> },
              { title: "当前周期(7天)", dataIndex: "currentPeriod", width: 130 },
              { title: "对比周期(7天)", dataIndex: "baselinePeriod", width: 130 },
              {
                title: "下降比例",
                width: 110,
                render: (_, row) => (
                  <Tag color={row.dropRatio >= 30 ? "orange" : "gold"}>{row.dropRatio}%</Tag>
                )
              },
              { title: "首次发现时间", dataIndex: "firstFoundAt", width: 180 }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
