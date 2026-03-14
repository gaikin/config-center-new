import { Card, Col, List, Row, Statistic, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { configCenterService } from "../../services/configCenterService";
import type { DashboardOverview } from "../../types";

const phaseItems = [
  { key: "phase-0", name: "Phase 0", detail: "基线冻结与对象模型确认" },
  { key: "phase-1", name: "Phase 1", detail: "公共支撑层与页面资源建模" },
  { key: "phase-2", name: "Phase 2", detail: "SDK 发布控制与运行时分发" },
  { key: "phase-3", name: "Phase 3", detail: "页面启用控制与智能提示" },
  { key: "phase-4", name: "Phase 4", detail: "智能作业、治理与发布收口" },
  { key: "phase-5", name: "Phase 5", detail: "试点灰度与扩面准备" }
];

const workPackages = [
  "WP-A 页面资源与公共支撑层",
  "WP-B SDK版本中心与菜单灰度",
  "WP-C 页面启用策略与智能提示",
  "WP-D 智能作业与运行时分包",
  "WP-E 生命周期治理与审计",
  "WP-F 原型与试点验证"
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
        当前工作台按最新 plan 展示实施进度，核心基线已切换到“loader 稳定入口 + 菜单级 SDK 控制 + 页面级启用策略”。
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
                "对象层级固定为 site -> region -> menu -> page。",
                "SDK 统一通过 cc-sdk-loader.js 注入，菜单策略解析真实版本。",
                "灰度范围在 P0 仅到机构维度，页面和 iframe 继承菜单版本。",
                "页面启用策略由业务管理，页面识别与字段模型由技术维护。",
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
