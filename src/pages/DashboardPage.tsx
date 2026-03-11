import { Card, Col, List, Row, Statistic, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";

export function DashboardPage() {
  const { menus, interfaces, hints, operations, orchestrations } = useAppStore();

  const metrics = useMemo(
    () => ({
      menuEnabled: menus.filter((x) => x.enabledHint || x.enabledOperation).length,
      interfacePublished: interfaces.filter((x) => x.status === "PUBLISHED").length,
      hintCount: hints.length,
      operationCount: operations.length,
      orchestrationEnabled: orchestrations.filter((x) => x.status === "ENABLED").length
    }),
    [menus, interfaces, hints, operations, orchestrations]
  );

  return (
    <div>
      <Typography.Title level={4}>配置中心总览</Typography.Title>
      <Typography.Paragraph type="secondary">
        当前仅实现配置端。运行时闭环已转为插件端 SDK 实现（不在管理端做仿真）。
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="启用菜单" value={metrics.menuEnabled} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="已发布接口" value={metrics.interfacePublished} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="提示规则" value={metrics.hintCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="智能作业" value={metrics.operationCount} />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="关键口径">
            <List
              size="small"
              dataSource={[
                "智能作业触发完全由智能提示控制",
                "编排为单作业单编排，节点顺序执行",
                "预览模式为编排完成后统一预览，一次性写入",
                "接口 timeout/retry 由平台统一控制，不对前端开放",
                "接口被引用时不可直接下线"
              ]}
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="插件端交付包">
            <Typography.Paragraph>
              可在 <Tag color="blue">Plugin SDK</Tag> 页面导出当前配置快照，供插件端加载执行。
            </Typography.Paragraph>
            <List
              size="small"
              dataSource={[
                `Interfaces: ${interfaces.length}`,
                `Hints: ${hints.length}`,
                `Operations: ${operations.length}`,
                `Orchestrations: ${orchestrations.length}`
              ]}
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
