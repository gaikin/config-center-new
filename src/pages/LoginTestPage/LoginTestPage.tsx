import { Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { mockUserPersonaMetaMap, mockUserPersonaOptions, type MockUserPersona, useMockSession } from "../../session/mockSession";

const actionLabelMap: Record<string, string> = {
  VIEW: "查看",
  CONFIG: "配置",
  VALIDATE: "校验",
  PUBLISH: "发布",
  DISABLE: "停用",
  DEFER: "延期",
  ROLLBACK: "回滚",
  AUDIT_VIEW: "审计查看",
  RISK_CONFIRM: "风险确认",
  ROLE_MANAGE: "角色授权管理",
  MENU_ENABLE_MANAGE: "菜单启用管理"
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
                extra={persona === option.value ? <Tag color="green">当前登录</Tag> : null}
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
                    {meta.actions.map((action) => (
                      <Tag key={action}>{actionLabelMap[action] ?? action}</Tag>
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
