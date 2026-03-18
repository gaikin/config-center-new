import {
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BulbOutlined,
  HomeOutlined,
  MenuOutlined,
  RobotOutlined,
  SettingOutlined
} from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Select, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  MockSessionProvider,
  mockUserPersonaMetaMap,
  mockUserPersonaOptions,
  type MockUserPersona,
  useMockSession
} from "../session/mockSession";

const { Header, Sider, Content } = Layout;

type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  menuResourcePath: string;
};

const navItems: NavItem[] = [
  { key: "/", label: "我的工作台", icon: <HomeOutlined />, menuResourcePath: "/menu/dashboard" },
  { key: "/page-management", label: "菜单管理", icon: <AppstoreOutlined />, menuResourcePath: "/menu/page-management" },
  { key: "/prompts", label: "智能提示", icon: <BulbOutlined />, menuResourcePath: "/menu/prompts" },
  { key: "/jobs", label: "智能作业", icon: <RobotOutlined />, menuResourcePath: "/menu/jobs" },
  { key: "/interfaces", label: "API注册", icon: <ApiOutlined />, menuResourcePath: "/menu/interfaces" },
  { key: "/stats", label: "运行统计", icon: <BarChartOutlined />, menuResourcePath: "/menu/stats" },
  { key: "/advanced", label: "高级配置", icon: <SettingOutlined />, menuResourcePath: "/menu/advanced" }
];

const compatiblePathToBizPath: Array<{ from: string; to: string }> = [
  { from: "/publish", to: "/" },
  { from: "/page-resources", to: "/page-management" },
  { from: "/page-activation", to: "/page-management" },
  { from: "/rules", to: "/prompts" },
  { from: "/rule-templates", to: "/prompts" },
  { from: "/job-scenes", to: "/jobs" },
  { from: "/sdk-version-center", to: "/advanced" },
  { from: "/permission-resources", to: "/advanced" },
  { from: "/audit-metrics", to: "/stats" },
  { from: "/preprocessors", to: "/advanced" },
  { from: "/roles", to: "/advanced" },
  { from: "/login-test", to: "/" }
];

const HeaderBar = styled(Header)`
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(120deg, var(--color-top-region-bg) 0%, var(--color-top-region-bg-end) 100%);
  color: var(--color-top-region-text);
  padding: var(--space-12) var(--space-24) var(--space-16);
  min-height: 88px;
  border-bottom: 1px solid var(--color-top-region-border);
  box-shadow: var(--shadow-1);
  backdrop-filter: blur(8px);
`;

const LogoBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`;

const LogoPill = styled.span`
  width: fit-content;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: var(--font-12);
  line-height: var(--lh-12);
  color: var(--color-top-region-text);
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
`;

const LogoTitle = styled(Typography.Text)`
  color: var(--color-top-region-text);
`;

const LogoSubtitle = styled(Typography.Text)`
  color: var(--color-top-region-text-muted);
  font-weight: 600;
`;

const ContentWrap = styled(Content)`
  margin: var(--space-24) var(--space-24) var(--space-24) var(--space-16);
  padding: var(--space-24);
  border-radius: var(--radius-20);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-2);
  animation: shell-content-in 280ms ease-out;

  @keyframes shell-content-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 1024px) {
    margin: var(--space-16);
    padding: var(--space-16);
  }
`;

const StyledSider = styled(Sider)`
  border-inline-end: 1px solid var(--color-border);
  background: var(--color-surface) !important;
  margin: var(--space-16) 0 var(--space-16) var(--space-16);
  border-radius: var(--radius-20);
  overflow: hidden;
  box-shadow: var(--shadow-1);

  @media (max-width: 1024px) {
    display: none;
  }
`;

const MainLayout = styled(Layout)`
  background: transparent;
`;

const ShellBody = styled(Layout)`
  background: transparent;
`;

const SiderInner = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--space-16) var(--space-8);
`;

const SideTitle = styled(Typography.Text)`
  color: var(--color-text-secondary);
  margin: 0 var(--space-8) var(--space-8);
`;

const SideMenu = styled(Menu)`
  border-inline-end: 0 !important;
  background: transparent !important;
`;

const HeaderActionButton = styled(Button)`
  color: var(--color-top-region-text);
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.26);

  &:hover,
  &:focus {
    color: var(--color-top-region-text) !important;
    border-color: rgba(255, 255, 255, 0.44) !important;
    background: rgba(255, 255, 255, 0.2) !important;
  }
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
  .ant-btn-default {
    color: var(--color-top-region-text);
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.24);
  }

  .ant-select-selector {
    background: rgba(255, 255, 255, 0.12) !important;
    border-color: rgba(255, 255, 255, 0.24) !important;
    color: var(--color-top-region-text) !important;
  }

  .ant-select-selection-item,
  .ant-select-selection-placeholder {
    color: var(--color-top-region-text) !important;
  }

  .ant-select-arrow {
    color: var(--color-top-region-text);
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
    icon: item.icon,
    label: <Link to={item.key}>{item.label}</Link>
  }));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<MockUserPersona>(() => {
    const cached = window.localStorage.getItem("config-center:mock-persona");
    const legacyMap: Record<string, MockUserPersona> = {
      CONFIG_USER: "CONFIG_OPERATOR_BRANCH",
      PUBLISH_MANAGER: "CONFIG_OPERATOR_HEAD",
      MENU_ADMIN: "PERMISSION_ADMIN_HEAD"
    };
    if (cached && legacyMap[cached]) {
      return legacyMap[cached];
    }
    if (cached && cached in mockUserPersonaMetaMap) {
      return cached as MockUserPersona;
    }
    return "CONFIG_OPERATOR_BRANCH";
  });

  return (
    <MockSessionProvider value={{ persona, setPersona }}>
      <AppShellLayout>{children}</AppShellLayout>
    </MockSessionProvider>
  );
}

function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { persona, setPersona, hasResource, meta: currentMeta } = useMockSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selected = getSelectedKey(location.pathname);

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => hasResource(item.menuResourcePath));
  }, [hasResource]);

  useEffect(() => {
    window.localStorage.setItem("config-center:mock-persona", persona);
  }, [persona]);

  useEffect(() => {
    const normalized = normalizePath(location.pathname);
    if (normalized === "/login-test") {
      return;
    }
    const canAccess = visibleNavItems.some((item) => {
      if (item.key === "/") {
        return normalized === "/";
      }
      return normalized.startsWith(item.key);
    });
    if (!canAccess) {
      navigate(currentMeta.defaultPath, { replace: true });
    }
  }, [currentMeta.defaultPath, location.pathname, navigate, visibleNavItems]);

  return (
    <MainLayout style={{ minHeight: "100vh" }}>
      <HeaderBar>
        <LogoBlock>
          <LogoPill>CONFIG CENTER</LogoPill>
          <LogoTitle className="type-20">营小助配置中心（新版）</LogoTitle>
          <LogoSubtitle className="type-12">
            模拟登录：{currentMeta.label} · {currentMeta.description}
          </LogoSubtitle>
        </LogoBlock>
        <HeaderActions size={8}>
          <HeaderActionButton size="small" onClick={() => navigate("/login-test")}>
            登录测试
          </HeaderActionButton>
          <Select
            value={persona}
            size="small"
            style={{ minWidth: 172 }}
            onChange={(next) => setPersona(next as MockUserPersona)}
            options={mockUserPersonaOptions}
          />
          <MobileNavButton icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)}>
            导航
          </MobileNavButton>
        </HeaderActions>
      </HeaderBar>
      <ShellBody>
        <StyledSider width={248} theme="light">
          <SiderInner>
            <SideTitle className="type-12">业务导航</SideTitle>
            <SideMenu mode="inline" selectedKeys={[selected]} items={renderMenuItems(visibleNavItems)} style={{ height: "100%" }} />
          </SiderInner>
        </StyledSider>
        <ContentWrap>{children}</ContentWrap>
      </ShellBody>
      <Drawer title="业务导航" placement="left" width={248} onClose={() => setDrawerOpen(false)} open={drawerOpen}>
        <SideMenu mode="inline" selectedKeys={[selected]} items={renderMenuItems(visibleNavItems)} onClick={() => setDrawerOpen(false)} />
      </Drawer>
    </MainLayout>
  );
}
