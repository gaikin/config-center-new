import { Button, Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

export function DashboardPage() {
  const navigate = useNavigate();
  const { menus, interfaces, hints, operations, orchestrations, templates } = useAppStore();

  const metrics = useMemo(
    () => ({
      menuEnabled: menus.filter((x) => x.enabledHint || x.enabledOperation).length,
      interfacePublished: interfaces.filter((x) => x.status === "PUBLISHED").length,
      hintPublished: hints.filter((x) => x.status === "PUBLISHED").length,
      operationPublished: operations.filter((x) => x.status === "PUBLISHED").length,
      orchestrationEnabled: orchestrations.filter((x) => x.status === "ENABLED").length,
      templateCount: templates.length
    }),
    [menus, interfaces, hints, operations, orchestrations, templates]
  );

  return (
    <div>
      <Typography.Title level={4}>配置中心总览</Typography.Title>
      <Typography.Paragraph type="secondary">
        {"当前为前端实现阶段，数据使用本地写死。核心流程面向业务人员：模板选用 -> 向导配置 -> 发布生效。"}
      </Typography.Paragraph>

      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => navigate("/wizard")}>进入配置向导</Button>
        <Button onClick={() => navigate("/templates")}>打开模板中心</Button>
      </Space>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="已启用菜单" value={metrics.menuEnabled} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="已发布接口" value={metrics.interfacePublished} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="已发布提示规则" value={metrics.hintPublished} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="已发布作业" value={metrics.operationPublished} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="已启用编排" value={metrics.orchestrationEnabled} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="模板数量" value={metrics.templateCount} /></Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="执行原则">
            <List
              size="small"
              dataSource={[
                "智能作业只能由命中的提示规则触发。",
                "一个作业只能绑定一个编排定义。",
                "编排节点失败策略固定为停止（STOP）。",
                "发布与生效范围一体化提交。",
                "运行时执行防抖与频控策略。"
              ]}
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="当前能力基线">
            <Space wrap>
              <Tag color="blue">提示联动作业</Tag>
              <Tag color="green">注入前预览</Tag>
              <Tag color="purple">悬浮重复触发</Tag>
              <Tag color="gold">模板化配置</Tag>
              <Tag color="red">审计可追溯</Tag>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
