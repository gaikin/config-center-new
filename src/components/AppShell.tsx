import { MenuOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Select, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { MockSessionProvider, mockUserPersonaMetaMap, mockUserPersonaOptions, type MockUserPersona } from "../session/mockSession";

const { Header, Sider, Content } = Layout;

type NavItem = {
  key: string;
  label: string;
  personas: MockUserPersona[];
};

const navItems: NavItem[] = [
  { key: "/", label: "我的工作台", personas: ["CONFIG_USER", "PUBLISH_MANAGER", "MENU_ADMIN"] },
  { key: "/page-management", label: "页面管理", personas: ["CONFIG_USER"] },
  { key: "/prompts", label: "智能提示", personas: ["CONFIG_USER"] },
  { key: "/jobs", label: "智能作业", personas: ["CONFIG_USER"] },
  { key: "/interfaces", label: "API注册", personas: ["CONFIG_USER"] },
  { key: "/publish", label: "发布与灰度", personas: ["CONFIG_USER", "PUBLISH_MANAGER", "MENU_ADMIN"] },
  { key: "/stats", label: "运行统计", personas: ["CONFIG_USER", "PUBLISH_MANAGER"] },
  { key: "/advanced", label: "高级配置", personas: ["CONFIG_USER"] }
];

const compatiblePathToBizPath: Array<{ from: string; to: string }> = [
  { from: "/page-resources", to: "/page-management" },
  { from: "/page-activation", to: "/page-management" },
  { from: "/rules", to: "/prompts" },
  { from: "/rule-templates", to: "/prompts" },
  { from: "/job-scenes", to: "/jobs" },
  { from: "/sdk-version-center", to: "/publish" },
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
  const navigate = useNavigate();
  const location = useLocation();
  const [persona, setPersona] = useState<MockUserPersona>(() => {
    const cached = window.localStorage.getItem("config-center:mock-persona");
    return cached === "CONFIG_USER" || cached === "PUBLISH_MANAGER" || cached === "MENU_ADMIN" ? cached : "CONFIG_USER";
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selected = getSelectedKey(location.pathname);
  const currentMeta = mockUserPersonaMetaMap[persona];

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => item.personas.includes(persona));
  }, [persona]);

  useEffect(() => {
    window.localStorage.setItem("config-center:mock-persona", persona);
  }, [persona]);

  useEffect(() => {
    const normalized = normalizePath(location.pathname);
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
    <MockSessionProvider value={{ persona, setPersona }}>
      <MainLayout style={{ minHeight: "100vh" }}>
        <HeaderBar>
          <LogoBlock>
            <LogoTitle className="type-20">营小助配置中心（新版）</LogoTitle>
            <LogoSubtitle className="type-12">
              模拟登录：{currentMeta.label} · {currentMeta.description}
            </LogoSubtitle>
          </LogoBlock>
          <HeaderActions size={8}>
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
    </MockSessionProvider>
  );
}
