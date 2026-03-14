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
  background: var(--color-top-region-bg);
  color: var(--color-top-region-text);
  padding: var(--space-12) var(--space-24);
  border-bottom: 1px solid var(--color-top-region-border);
  box-shadow: var(--shadow-1);
`;

const LogoBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`;

const LogoTitle = styled(Typography.Text)`
  color: var(--color-top-region-text);
`;

const LogoSubtitle = styled(Typography.Text)`
  color: var(--color-top-region-text-muted);
`;

const ContentWrap = styled(Content)`
  margin: var(--space-24);
  padding: var(--space-24);
  border-radius: var(--radius-16);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-1);

  @media (max-width: 1024px) {
    margin: var(--space-16);
    padding: var(--space-16);
  }
`;

const StyledSider = styled(Sider)`
  border-inline-end: 1px solid var(--color-border);

  @media (max-width: 1024px) {
    display: none;
  }
`;

const MainLayout = styled(Layout)`
  background: var(--color-bg);
`;

const MobileNavButton = styled(Button)`
  display: none;
  color: var(--color-top-region-text);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);

  &:hover,
  &:focus {
    color: var(--color-top-region-text) !important;
    border-color: rgba(255, 255, 255, 0.32) !important;
    background: rgba(255, 255, 255, 0.12) !important;
  }

  @media (max-width: 1024px) {
    display: inline-flex;
  }
`;

const HeaderActions = styled(Space)`
  .ant-select-selector {
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.2) !important;
    color: var(--color-top-region-text) !important;
  }

  .ant-select-selection-item,
  .ant-select-selection-placeholder {
    color: var(--color-top-region-text) !important;
  }

  .ant-select-arrow {
    color: var(--color-top-region-text-muted);
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
    <MainLayout style={{ minHeight: "100vh" }}>
      <HeaderBar>
        <LogoBlock>
          <LogoTitle className="type-20">营小助配置中心（新版）</LogoTitle>
          <LogoSubtitle className="type-12">
            业务主路径：找页面、配规则、接接口、做发布、看结果
          </LogoSubtitle>
        </LogoBlock>
        <HeaderActions size={8}>
          <Select
            value={role}
            size="small"
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
        </HeaderActions>
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
    </MainLayout>
  );
}
