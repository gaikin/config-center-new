import { Card, Col, Progress, Row, Segmented, Space, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../../services/configCenterService";
import type { ExecutionLogItem, FailureReasonMetric, TriggerLogItem } from "../../types";

export function AuditMetricsPage() {
  const [loading, setLoading] = useState(true);
  const [triggerRows, setTriggerRows] = useState<TriggerLogItem[]>([]);
  const [executionRows, setExecutionRows] = useState<ExecutionLogItem[]>([]);
  const [failureMetrics, setFailureMetrics] = useState<FailureReasonMetric[]>([]);
  const [triggerFilter, setTriggerFilter] = useState<"ALL" | TriggerLogItem["triggerResult"]>("ALL");
  const [executionFilter, setExecutionFilter] = useState<"ALL" | ExecutionLogItem["result"]>("ALL");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const [triggers, executions, metrics] = await Promise.all([
          configCenterService.listTriggerLogs(),
          configCenterService.listExecutionLogs(),
          configCenterService.listFailureReasonMetrics()
        ]);
        if (!active) {
          return;
        }
        setTriggerRows(triggers);
        setExecutionRows(executions);
        setFailureMetrics(metrics);
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

  const triggerFiltered = useMemo(() => {
    if (triggerFilter === "ALL") {
      return triggerRows;
    }
    return triggerRows.filter((item) => item.triggerResult === triggerFilter);
  }, [triggerFilter, triggerRows]);

  const executionFiltered = useMemo(() => {
    if (executionFilter === "ALL") {
      return executionRows;
    }
    return executionRows.filter((item) => item.result === executionFilter);
  }, [executionFilter, executionRows]);

  const triggerHitRate = useMemo(() => {
    if (triggerRows.length === 0) {
      return 0;
    }
    const hits = triggerRows.filter((item) => item.triggerResult === "HIT").length;
    return Number(((hits / triggerRows.length) * 100).toFixed(1));
  }, [triggerRows]);

  const executionSuccessRate = useMemo(() => {
    if (executionRows.length === 0) {
      return 0;
    }
    const successCount = executionRows.filter((item) => item.result !== "FAILED").length;
    return Number(((successCount / executionRows.length) * 100).toFixed(1));
  }, [executionRows]);

  const topFailureReason = failureMetrics[0]?.reason ?? "暂无失败";

  return (
    <div>
      <Typography.Title level={4}>审计与指标中心</Typography.Title>
      <Typography.Paragraph type="secondary">
        统一查看触发日志、执行日志与失败原因分布，支持治理复盘与问题定位。
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Typography.Text type="secondary">触发日志总数</Typography.Text>
            <Typography.Title level={3} style={{ marginTop: 8, marginBottom: 0 }}>
              {triggerRows.length}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Typography.Text type="secondary">规则命中率</Typography.Text>
            <Typography.Title level={3} style={{ marginTop: 8, marginBottom: 0 }}>
              {triggerHitRate}%
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Typography.Text type="secondary">执行成功率</Typography.Text>
            <Typography.Title level={3} style={{ marginTop: 8, marginBottom: 0 }}>
              {executionSuccessRate}%
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Typography.Text type="secondary">Top 失败原因</Typography.Text>
            <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 0 }}>
              {topFailureReason}
            </Typography.Title>
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="失败原因分布" loading={loading}>
            {failureMetrics.length === 0 ? (
              <Typography.Text type="secondary">暂无失败记录。</Typography.Text>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }}>
                {failureMetrics.map((metric) => (
                  <div key={metric.reason}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Typography.Text>{metric.reason}</Typography.Text>
                      <Typography.Text type="secondary">
                        {metric.count} 次 / {metric.ratio}%
                      </Typography.Text>
                    </div>
                    <Progress percent={metric.ratio} showInfo={false} />
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title="规则触发日志"
            extra={
              <Segmented
                value={triggerFilter}
                onChange={(value) => setTriggerFilter(value as "ALL" | TriggerLogItem["triggerResult"])}
                options={["ALL", "HIT", "MISS", "FAILED"]}
              />
            }
          >
            <Table<TriggerLogItem>
              rowKey="id"
              loading={loading}
              dataSource={triggerFiltered}
              pagination={{ pageSize: 5 }}
              columns={[
                { title: "规则", dataIndex: "ruleName", width: 180 },
                { title: "页面资源", dataIndex: "pageResourceName", width: 160 },
                {
                  title: "结果",
                  width: 100,
                  render: (_, row) => (
                    <Tag color={row.triggerResult === "HIT" ? "green" : row.triggerResult === "MISS" ? "blue" : "red"}>
                      {row.triggerResult}
                    </Tag>
                  )
                },
                { title: "原因", dataIndex: "reason" },
                { title: "操作人", dataIndex: "operator", width: 100 },
                { title: "时间", dataIndex: "createdAt", width: 180 }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="作业执行日志"
        style={{ marginTop: 16 }}
        extra={
          <Segmented
            value={executionFilter}
            onChange={(value) => setExecutionFilter(value as "ALL" | ExecutionLogItem["result"])}
            options={["ALL", "SUCCESS", "PARTIAL_SUCCESS", "FAILED"]}
          />
        }
      >
        <Table<ExecutionLogItem>
          rowKey="id"
          loading={loading}
          dataSource={executionFiltered}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            { title: "作业场景", dataIndex: "sceneName", width: 220 },
            { title: "触发来源", dataIndex: "triggerSource", width: 150 },
            {
              title: "结果",
              width: 130,
              render: (_, row) => {
                const color = row.result === "SUCCESS" ? "green" : row.result === "PARTIAL_SUCCESS" ? "orange" : "red";
                return <Tag color={color}>{row.result}</Tag>;
              }
            },
            { title: "耗时(ms)", dataIndex: "latencyMs", width: 120 },
            { title: "说明", dataIndex: "reason" },
            { title: "时间", dataIndex: "createdAt", width: 180 }
          ]}
        />
      </Card>
    </div>
  );
}

