import { Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { mockUserPersonaMetaMap, mockUserPersonaOptions, type MockUserPersona, useMockSession } from "../../session/mockSession";

const resourceLabelMap: Record<string, string> = {
  "/menu/dashboard": "菜单: 工作台",
  "/menu/page-management": "菜单: 菜单管理",
  "/menu/prompts": "菜单: 智能提示",
  "/menu/jobs": "菜单: 智能作业",
  "/menu/interfaces": "菜单: API注册",
  "/menu/stats": "菜单: 运行统计",
  "/menu/advanced": "菜单: 高级配置",
  "/action/common/base/view": "动作: 查看",
  "/action/common/base/config": "动作: 配置",
  "/action/common/base/validate": "动作: 校验",
  "/action/common/base/publish": "动作: 发布",
  "/action/common/base/audit-view": "动作: 审计查看",
  "/action/roles/list/manage": "动作: 角色授权管理",
  "/action/page-management/capability/manage": "动作: 菜单启用管理"
};

export function LoginTestPage() {
  const navigate = useNavigate();
  const { persona, setPersona } = useMockSession();

  function switchPersona(next: MockUserPersona) {
    const meta = mockUserPersonaMetaMap[next];
    setPersona(next);
    navigate(meta.defaultPath, { replace: true });
  }

  return (
    <div>
      <Typography.Title level={4}>登录测试入口</Typography.Title>
      <Typography.Paragraph type="secondary">
        一键切换不同角色模拟登录。切换后会立即按该角色默认入口和权限范围展示页面。
      </Typography.Paragraph>

      <Row gutter={[12, 12]}>
        {mockUserPersonaOptions.map((option) => {
          const meta = mockUserPersonaMetaMap[option.value];
          return (
            <Col xs={24} md={12} key={option.value}>
              <Card
                size="small"
                title={meta.label}
                extra={persona === option.value ? <Tag color="processing">当前登录</Tag> : null}
                actions={[
                  <Button type={persona === option.value ? "default" : "primary"} onClick={() => switchPersona(option.value)}>
                    {persona === option.value ? "已登录" : "切换登录"}
                  </Button>
                ]}
              >
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Typography.Text type="secondary">{meta.description}</Typography.Text>
                  <Typography.Text type="secondary">默认入口：{meta.defaultPath}</Typography.Text>
                  <Space wrap>
                    {meta.resourcePaths.map((resourcePath) => (
                      <Tag key={resourcePath}>{resourceLabelMap[resourcePath] ?? resourcePath}</Tag>
                    ))}
                  </Space>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
