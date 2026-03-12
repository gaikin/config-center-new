import { Card, Col, List, Row, Statistic, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import type { DashboardOverview } from "../types";

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
        当前页面基于 mock 数据模拟新版 Admin Web 主工作台，覆盖页面资源、规则、作业场景、治理和角色管理。
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="页面资源数" value={overview?.pageResourceCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="生效规则数" value={overview?.activeRuleCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="生效作业场景数" value={overview?.activeSceneCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic title="生效接口定义数" value={overview?.activeInterfaceCount ?? 0} />
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
        <Col xs={24} lg={12}>
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
        <Col xs={24} lg={12}>
          <Card title="当前基线">
            <List
              size="small"
              dataSource={[
                "发布前强校验作为主防线，运行时仅保留最小技术防护。",
                "规则和作业场景分开建模、分开版本化、分开治理。",
                "提示入口统一为确认按钮，复杂场景由悬浮入口承接。",
                "治理工作台默认进入待处理视图。",
                "平台只承诺基础校验，真实联调在外部环境完成。"
              ]}
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
            <div style={{ marginTop: 10 }}>
              <Tag color="blue">Mock Data</Tag>
              <Tag color="green">Admin Web P0</Tag>
              <Tag color="gold">TDSQL Baseline</Tag>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
