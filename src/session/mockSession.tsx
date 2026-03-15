import { createContext, useContext } from "react";

export type MockUserPersona = "CONFIG_USER" | "PUBLISH_MANAGER" | "MENU_ADMIN";

export type MockUserPersonaMeta = {
  label: string;
  description: string;
  defaultPath: string;
};

export const mockUserPersonaMetaMap: Record<MockUserPersona, MockUserPersonaMeta> = {
  CONFIG_USER: {
    label: "业务配置人员",
    description: "负责页面、提示、作业、API、名单等业务配置与校验，不承担正式发布和菜单能力开通。",
    defaultPath: "/"
  },
  PUBLISH_MANAGER: {
    label: "发布管理员",
    description: "负责发布、停用、延期、回滚和风险确认，只处理配置发布链路。",
    defaultPath: "/publish"
  },
  MENU_ADMIN: {
    label: "菜单开通管理员",
    description: "负责菜单智能提示 / 智能作业开通、槽位选择、机构范围和 IP 试点。",
    defaultPath: "/publish"
  }
};

type MockSessionContextValue = {
  persona: MockUserPersona;
  setPersona: (persona: MockUserPersona) => void;
};

export const mockUserPersonaOptions = (Object.entries(mockUserPersonaMetaMap) as Array<
  [MockUserPersona, MockUserPersonaMeta]
>).map(([value, meta]) => ({
  value,
  label: meta.label
}));

const MockSessionContext = createContext<MockSessionContextValue | null>(null);

export function MockSessionProvider({
  value,
  children
}: {
  value: MockSessionContextValue;
  children: React.ReactNode;
}) {
  return <MockSessionContext.Provider value={value}>{children}</MockSessionContext.Provider>;
}

export function useMockSession() {
  const context = useContext(MockSessionContext);
  if (!context) {
    throw new Error("useMockSession must be used within MockSessionProvider");
  }
  return context;
}
