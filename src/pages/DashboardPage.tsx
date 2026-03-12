import { Card, Col, List, Row, Statistic, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import type { DashboardOverview } from "../types";

const phaseItems = [
  { key: "phase-0", name: "Phase 0", detail: "基线冻结与对象模型确认" },
  { key: "phase-1", name: "Phase 1", detail: "公共支撑层（页面资源、API注册、预处理器、权限）" },
  { key: "phase-2", name: "Phase 2", detail: "智能提示主链路（规则、展示、关闭策略）" },
  { key: "phase-3", name: "Phase 3", detail: "智能作业主链路（场景、编排、执行）" },
  { key: "phase-4", name: "Phase 4", detail: "治理、审计、指标收口" },
  { key: "phase-5", name: "Phase 5", detail: "试点灰度与扩面准备" }
];

const workPackages = [
  "WP-A 公共支撑层",
  "WP-B 智能提示",
  "WP-C 智能作业",
  "WP-D 生命周期治理",
  "WP-E 审计指标",
  "WP-F 试点上线"
];

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const data = await configCenterService.getDashboardOverview();
        if (active) {
          setOverview(data);
        }
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

  return (
    <div>
      <Typography.Title level={4}>配置中心总览</Typography.Title>
      <Typography.Paragraph type="secondary">
        当前工作台按 plan 基线展示实施进度，采用“总纲驱动 + 子文档承接细节”的推进方式。
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="页面资源数" value={overview?.pageResourceCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="生效提示规则数" value={overview?.activeRuleCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="生效作业场景数" value={overview?.activeSceneCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="生效API注册数" value={overview?.activeInterfaceCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="角色总数" value={overview?.roleCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="待处理事项" value={overview?.pendingCount ?? 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="核心指标" loading={loading}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Statistic title="作业成功率" value={overview?.metrics.executionSuccessRate ?? 0} suffix="%" />
              </Col>
              <Col span={12}>
                <Statistic title="平均节省时长" value={overview?.metrics.avgSavedSeconds ?? 0} suffix="秒" />
              </Col>
              <Col span={12}>
                <Statistic title="已失效对象" value={overview?.metrics.expiredResourceCount ?? 0} />
              </Col>
              <Col span={12}>
                <Statistic title="即将到期" value={overview?.metrics.expiringSoonResourceCount ?? 0} />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="阶段计划（Phase）">
            <List
              size="small"
              dataSource={phaseItems}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  <Typography.Text type="secondary">：{item.detail}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="当前基线">
            <List
              size="small"
              dataSource={[
                "总纲：prd-analysis.md；细节：sentinel-prd.md 与 job-prd.md。",
                "发布前强校验作为主防线，运行时仅保留最小技术防护。",
                "智能提示与智能作业分开建模、分开版本化、分开治理。",
                "提示入口统一为确认按钮，复杂场景由悬浮入口承接。",
                "平台只承诺基础校验，真实联调在外部环境完成。"
              ]}
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
            <div style={{ marginTop: 10 }}>
              {workPackages.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
              <Tag color="blue">Mock Data</Tag>
              <Tag color="green">Admin Web P0</Tag>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
