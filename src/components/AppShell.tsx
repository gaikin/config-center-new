import { Layout, Menu, Typography } from "antd";
import styled from "styled-components";
import { Link, useLocation } from "react-router-dom";

const { Header, Sider, Content } = Layout;

const navItems = [
  { key: "/", label: "总览" },
  { key: "/wizard", label: "配置向导" },
  { key: "/templates", label: "模板中心" },
  { key: "/scopes", label: "菜单范围" },
  { key: "/interfaces", label: "接口配置" },
  { key: "/hints", label: "提示规则" },
  { key: "/orchestrations", label: "作业编排" },
  { key: "/plugin-sdk", label: "运行时配置包" }
];

const HeaderBar = styled(Header)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(90deg, #0f172a 0%, #1f3a8a 100%);
  color: #fff;
  padding: 0 20px;
`;

const LogoBlock = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.1;
`;

const ContentWrap = styled(Content)`
  margin: 16px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
`;

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const selected = navItems.find((item) => location.pathname === item.key)?.key ?? location.pathname;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <HeaderBar>
        <LogoBlock>
          <Typography.Text style={{ color: "#fff", fontWeight: 700 }}>营小助配置中心</Typography.Text>
          <Typography.Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
            智能提示 + 智能作业 + 脚本 SDK
          </Typography.Text>
        </LogoBlock>
      </HeaderBar>
      <Layout>
        <Sider width={232} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[selected]}
            items={navItems.map((item) => ({
              key: item.key,
              label: <Link to={item.key}>{item.label}</Link>
            }))}
            style={{ height: "100%", borderInlineEnd: 0 }}
          />
        </Sider>
        <ContentWrap>{children}</ContentWrap>
      </Layout>
    </Layout>
  );
}
