import { MenuOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Select, Space, Typography } from "antd";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styled from "styled-components";

const { Header, Sider, Content } = Layout;

type AppRole = "BUSINESS" | "ADVANCED" | "ADMIN";

type NavItem = {
  key: string;
  label: string;
  minRole?: Exclude<AppRole, "BUSINESS">;
};

const navItems: NavItem[] = [
  { key: "/", label: "我的工作台" },
  { key: "/page-management", label: "页面管理" },
  { key: "/prompts", label: "智能提示" },
  { key: "/jobs", label: "智能作业" },
  { key: "/interfaces", label: "API注册" },
  { key: "/publish", label: "发布与灰度" },
  { key: "/stats", label: "运行统计" },
  { key: "/advanced", label: "高级配置", minRole: "ADVANCED" }
];

const compatiblePathToBizPath: Array<{ from: string; to: string }> = [
  { from: "/page-resources", to: "/page-management" },
  { from: "/page-activation", to: "/page-management" },
  { from: "/rules", to: "/prompts" },
  { from: "/rule-templates", to: "/prompts" },
  { from: "/job-scenes", to: "/jobs" },
  { from: "/sdk-version-center", to: "/publish" },
  { from: "/governance", to: "/publish" },
  { from: "/audit-metrics", to: "/stats" },
  { from: "/preprocessors", to: "/advanced" },
  { from: "/roles", to: "/advanced" }
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

function normalizePath(pathname: string) {
  const matched = compatiblePathToBizPath.find((item) => pathname.startsWith(item.from));
  return matched?.to ?? pathname;
}

function getSelectedKey(pathname: string) {
  const normalized = normalizePath(pathname);
  const matched = navItems.find((item) => {
    if (item.key === "/") {
      return normalized === "/";
    }
    return normalized.startsWith(item.key);
  });
  return matched?.key ?? "/";
}

function renderMenuItems(items: NavItem[]) {
  return items.map((item) => ({
    key: item.key,
    label: <Link to={item.key}>{item.label}</Link>
  }));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [role, setRole] = useState<AppRole>("BUSINESS");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selected = getSelectedKey(location.pathname);

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (!item.minRole) {
        return true;
      }
      if (item.minRole === "ADVANCED") {
        return role === "ADVANCED" || role === "ADMIN";
      }
      return role === "ADMIN";
    });
  }, [role]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <HeaderBar>
        <LogoBlock>
          <Typography.Text style={{ color: "#fff", fontWeight: 700 }}>营小助配置中心（新版）</Typography.Text>
          <Typography.Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
            业务主路径：找页面、配规则、接接口、做发布、看结果
          </Typography.Text>
        </LogoBlock>
        <Space>
          <Select
            value={role}
            size="small"
            style={{ width: 148 }}
            onChange={(next) => setRole(next as AppRole)}
            options={[
              { label: "业务人员视角", value: "BUSINESS" },
              { label: "高级运营视角", value: "ADVANCED" },
              { label: "平台管理员视角", value: "ADMIN" }
            ]}
          />
          <MobileNavButton icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)}>
            导航
          </MobileNavButton>
        </Space>
      </HeaderBar>
      <Layout>
        <StyledSider width={248} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[selected]}
            items={renderMenuItems(visibleNavItems)}
            style={{ height: "100%", borderInlineEnd: 0 }}
          />
        </StyledSider>
        <ContentWrap>{children}</ContentWrap>
      </Layout>
      <Drawer title="业务导航" placement="left" width={248} onClose={() => setDrawerOpen(false)} open={drawerOpen}>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={renderMenuItems(visibleNavItems)}
          onClick={() => setDrawerOpen(false)}
          style={{ borderInlineEnd: 0 }}
        />
      </Drawer>
    </Layout>
  );
}
