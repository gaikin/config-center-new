import { MenuOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Typography } from "antd";
import styled from "styled-components";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

const { Header, Sider, Content } = Layout;

const navItems = [
  { key: "/", label: "总览" },
  { key: "/page-resources", label: "页面资源中心" },
  { key: "/interfaces", label: "API注册" },
  { key: "/preprocessors", label: "预处理器中心" },
  { key: "/rules", label: "智能提示" },
  { key: "/job-scenes", label: "智能作业" },
  { key: "/governance", label: "治理工作台" },
  { key: "/audit-metrics", label: "审计与指标中心" },
  { key: "/roles", label: "角色管理" }
];

const HeaderBar = styled(Header)`
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(95deg, #0f172a 0%, #1e3a8a 55%, #0ea5a4 100%);
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
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
`;

const StyledSider = styled(Sider)`
  @media (max-width: 1024px) {
    display: none;
  }
`;

const MobileNavButton = styled(Button)`
  display: none;

  @media (max-width: 1024px) {
    display: inline-flex;
  }
`;

function getSelectedKey(pathname: string) {
  const matched = navItems.find((item) => {
    if (item.key === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(item.key);
  });
  return matched?.key ?? "/";
}

function renderMenuItems() {
  return navItems.map((item) => ({
    key: item.key,
    label: <Link to={item.key}>{item.label}</Link>
  }));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const selected = getSelectedKey(location.pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <HeaderBar>
        <LogoBlock>
          <Typography.Text style={{ color: "#fff", fontWeight: 700 }}>营小助配置中心（新版）</Typography.Text>
          <Typography.Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
            Phase 0-5 | WP-A~WP-F 实施导航
          </Typography.Text>
        </LogoBlock>
        <MobileNavButton icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)}>
          导航
        </MobileNavButton>
      </HeaderBar>
      <Layout>
        <StyledSider width={248} theme="light">
          <Menu mode="inline" selectedKeys={[selected]} items={renderMenuItems()} style={{ height: "100%", borderInlineEnd: 0 }} />
        </StyledSider>
        <ContentWrap>{children}</ContentWrap>
      </Layout>
      <Drawer
        title="实施导航"
        placement="left"
        width={248}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={renderMenuItems()}
          onClick={() => setDrawerOpen(false)}
          style={{ borderInlineEnd: 0 }}
        />
      </Drawer>
    </Layout>
  );
}
