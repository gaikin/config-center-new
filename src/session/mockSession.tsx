import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import { ROLE_PERMISSIONS_CHANGED_EVENT } from "./sessionEvents";
import type { ActionType, RoleItem } from "../types";

export type MockUserPersona =
  | "CONFIG_OPERATOR_BRANCH"
  | "PERMISSION_ADMIN_BRANCH"
  | "PERMISSION_ADMIN_HEAD"
  | "CONFIG_OPERATOR_HEAD"
  | "TECH_SUPPORT_HEAD"
  | "CONFIG_USER"
  | "PUBLISH_MANAGER"
  | "MENU_ADMIN";

export type MockUserPersonaMeta = {
  label: string;
  description: string;
  defaultPath: string;
  roleType: RoleItem["roleType"];
  orgScopeId: string;
  operatorId: string;
  actions: ActionType[];
  deprecated?: boolean;
};

export const mockUserPersonaMetaMap: Record<MockUserPersona, MockUserPersonaMeta> = {
  CONFIG_OPERATOR_BRANCH: {
    label: "配置人员-华东",
    description: "负责业务配置、校验与发布，范围限定在华东机构。",
    defaultPath: "/",
    roleType: "CONFIG_OPERATOR",
    orgScopeId: "branch-east",
    operatorId: "person-zhao-yi",
    actions: ["VIEW", "CONFIG", "VALIDATE", "PUBLISH"]
  },
  PERMISSION_ADMIN_BRANCH: {
    label: "权限管理人员-华东",
    description: "负责角色授权管理，不承担业务发布执行。",
    defaultPath: "/advanced?tab=roles",
    roleType: "PERMISSION_ADMIN",
    orgScopeId: "branch-east",
    operatorId: "person-wu-zhuguan",
    actions: ["VIEW", "ROLE_MANAGE"]
  },
  PERMISSION_ADMIN_HEAD: {
    label: "权限管理人员-总行",
    description: "可执行总行范围角色授权，并可分配高权限操作。",
    defaultPath: "/advanced?tab=roles",
    roleType: "PERMISSION_ADMIN",
    orgScopeId: "head-office",
    operatorId: "person-head-admin-a",
    actions: ["VIEW", "ROLE_MANAGE", "MENU_ENABLE_MANAGE"]
  },
  CONFIG_OPERATOR_HEAD: {
    label: "配置人员-总行",
    description: "负责总行范围配置、校验与发布，并可执行菜单启用等高权限动作。",
    defaultPath: "/",
    roleType: "CONFIG_OPERATOR",
    orgScopeId: "head-office",
    operatorId: "person-head-config-a",
    actions: ["VIEW", "CONFIG", "VALIDATE", "PUBLISH", "MENU_ENABLE_MANAGE"]
  },
  TECH_SUPPORT_HEAD: {
    label: "技术支持人员-总行",
    description: "用于总行排障和审计查看，不参与业务配置发布。",
    defaultPath: "/stats",
    roleType: "TECH_SUPPORT",
    orgScopeId: "head-office",
    operatorId: "person-platform-support-a",
    actions: ["VIEW", "VALIDATE", "AUDIT_VIEW"]
  },
  CONFIG_USER: {
    label: "业务配置人员",
    description: "历史兼容身份，建议使用“配置人员-华东”。",
    defaultPath: "/",
    roleType: "CONFIG_OPERATOR",
    orgScopeId: "branch-east",
    operatorId: "person-zhao-yi",
    actions: ["VIEW", "CONFIG", "VALIDATE", "PUBLISH"],
    deprecated: true
  },
  PUBLISH_MANAGER: {
    label: "发布管理员",
    description: "历史兼容身份，建议使用“配置人员-总行”。",
    defaultPath: "/",
    roleType: "CONFIG_OPERATOR",
    orgScopeId: "head-office",
    operatorId: "person-head-config-a",
    actions: ["VIEW", "VALIDATE", "PUBLISH", "DISABLE", "DEFER", "ROLLBACK", "RISK_CONFIRM", "AUDIT_VIEW"],
    deprecated: true
  },
  MENU_ADMIN: {
    label: "菜单开通管理员",
    description: "历史兼容身份，建议使用“权限管理人员-总行”。",
    defaultPath: "/",
    roleType: "PERMISSION_ADMIN",
    orgScopeId: "head-office",
    operatorId: "person-head-admin-a",
    actions: ["VIEW", "MENU_ENABLE_MANAGE"],
    deprecated: true
  }
};

type MockSessionContextValue = {
  persona: MockUserPersona;
  setPersona: (persona: MockUserPersona) => void;
  effectiveActions: ActionType[];
};

export const mockUserPersonaOptions = (Object.entries(mockUserPersonaMetaMap) as Array<
  [MockUserPersona, MockUserPersonaMeta]
>)
  .filter(([, meta]) => !meta.deprecated)
  .map(([value, meta]) => ({
    value,
    label: meta.label
  }));

const MockSessionContext = createContext<MockSessionContextValue | null>(null);

export function MockSessionProvider({
  value,
  children
}: {
  value: Pick<MockSessionContextValue, "persona" | "setPersona">;
  children: React.ReactNode;
}) {
  const baseMeta = mockUserPersonaMetaMap[value.persona];
  const [effectiveActions, setEffectiveActions] = useState<ActionType[]>(baseMeta.actions);

  useEffect(() => {
    let alive = true;

    async function loadEffectiveActions() {
      const roles = await configCenterService.listRoles();
      const activeRoles = roles.filter((role) => role.status === "ACTIVE");
      const matchedRoles: RoleItem[] = [];
      for (const role of activeRoles) {
        const members = await configCenterService.listRoleMembers(role.id);
        if (members.includes(baseMeta.operatorId)) {
          matchedRoles.push(role);
        }
      }
      const merged = Array.from(new Set([...baseMeta.actions, ...matchedRoles.flatMap((role) => role.actions)]));
      if (alive) {
        setEffectiveActions(merged);
      }
    }

    void loadEffectiveActions();

    const handleRolesChanged = () => {
      void loadEffectiveActions();
    };
    if (typeof window !== "undefined") {
      window.addEventListener(ROLE_PERMISSIONS_CHANGED_EVENT, handleRolesChanged);
    }

    return () => {
      alive = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(ROLE_PERMISSIONS_CHANGED_EVENT, handleRolesChanged);
      }
    };
  }, [baseMeta.actions, baseMeta.operatorId, value.persona]);

  const contextValue = useMemo(
    () => ({
      ...value,
      effectiveActions
    }),
    [effectiveActions, value]
  );

  return <MockSessionContext.Provider value={contextValue}>{children}</MockSessionContext.Provider>;
}

export function useMockSession() {
  const context = useContext(MockSessionContext);
  if (!context) {
    throw new Error("useMockSession must be used within MockSessionProvider");
  }
  const meta = mockUserPersonaMetaMap[context.persona];
  return {
    ...context,
    meta,
    hasAction: (action: ActionType) => context.effectiveActions.includes(action)
  };
}
