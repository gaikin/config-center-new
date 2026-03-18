import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getRoleTypeRecommendedResourcePaths } from "../permissionPolicy";
import { configCenterService } from "../services/configCenterService";
import { ROLE_PERMISSIONS_CHANGED_EVENT } from "./sessionEvents";
import type { RoleItem } from "../types";

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
  resourcePaths: string[];
  deprecated?: boolean;
};

function buildPersonaResourcePaths(roleType: RoleItem["roleType"], orgScopeId: string) {
  return getRoleTypeRecommendedResourcePaths(roleType, orgScopeId);
}

export const mockUserPersonaMetaMap: Record<MockUserPersona, MockUserPersonaMeta> = {
  CONFIG_OPERATOR_BRANCH: {
    label: "配置人员-华东",
    description: "负责业务配置、校验与发布，范围限定在华东机构。",
    defaultPath: "/",
    roleType: "CONFIG_OPERATOR",
    orgScopeId: "branch-east",
    operatorId: "person-zhao-yi",
    resourcePaths: buildPersonaResourcePaths("CONFIG_OPERATOR", "branch-east")
  },
  PERMISSION_ADMIN_BRANCH: {
    label: "权限管理人员-华东",
    description: "负责角色授权管理，不承担业务发布执行。",
    defaultPath: "/advanced?tab=roles",
    roleType: "PERMISSION_ADMIN",
    orgScopeId: "branch-east",
    operatorId: "person-wu-zhuguan",
    resourcePaths: buildPersonaResourcePaths("PERMISSION_ADMIN", "branch-east")
  },
  PERMISSION_ADMIN_HEAD: {
    label: "权限管理人员-总行",
    description: "可执行总行范围角色授权，并可分配高权限操作。",
    defaultPath: "/advanced?tab=roles",
    roleType: "PERMISSION_ADMIN",
    orgScopeId: "head-office",
    operatorId: "person-head-admin-a",
    resourcePaths: buildPersonaResourcePaths("PERMISSION_ADMIN", "head-office")
  },
  CONFIG_OPERATOR_HEAD: {
    label: "配置人员-总行",
    description: "负责总行范围配置、校验与发布，并可执行菜单启用等高权限动作。",
    defaultPath: "/",
    roleType: "CONFIG_OPERATOR",
    orgScopeId: "head-office",
    operatorId: "person-head-config-a",
    resourcePaths: buildPersonaResourcePaths("CONFIG_OPERATOR", "head-office")
  },
  TECH_SUPPORT_HEAD: {
    label: "技术支持人员-总行",
    description: "用于总行排障和审计查看，不参与业务配置发布。",
    defaultPath: "/stats",
    roleType: "TECH_SUPPORT",
    orgScopeId: "head-office",
    operatorId: "person-platform-support-a",
    resourcePaths: buildPersonaResourcePaths("TECH_SUPPORT", "head-office")
  },
  CONFIG_USER: {
    label: "业务配置人员",
    description: "历史兼容身份，建议使用“配置人员-华东”。",
    defaultPath: "/",
    roleType: "CONFIG_OPERATOR",
    orgScopeId: "branch-east",
    operatorId: "person-zhao-yi",
    resourcePaths: buildPersonaResourcePaths("CONFIG_OPERATOR", "branch-east"),
    deprecated: true
  },
  PUBLISH_MANAGER: {
    label: "发布管理员",
    description: "历史兼容身份，建议使用“配置人员-总行”。",
    defaultPath: "/",
    roleType: "CONFIG_OPERATOR",
    orgScopeId: "head-office",
    operatorId: "person-head-config-a",
    resourcePaths: buildPersonaResourcePaths("CONFIG_OPERATOR", "head-office"),
    deprecated: true
  },
  MENU_ADMIN: {
    label: "菜单开通管理员",
    description: "历史兼容身份，建议使用“权限管理人员-总行”。",
    defaultPath: "/",
    roleType: "PERMISSION_ADMIN",
    orgScopeId: "head-office",
    operatorId: "person-head-admin-a",
    resourcePaths: buildPersonaResourcePaths("PERMISSION_ADMIN", "head-office"),
    deprecated: true
  }
};

type MockSessionContextValue = {
  persona: MockUserPersona;
  setPersona: (persona: MockUserPersona) => void;
  effectiveResourcePaths: string[];
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
  const [effectiveResourcePaths, setEffectiveResourcePaths] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadEffectiveResourcePaths() {
      try {
        const [roles, bindings, resources] = await Promise.all([
          configCenterService.listRoles(),
          configCenterService.listUserRoleBindings(),
          configCenterService.listPermissionResources()
        ]);
        const activeRoleIds = new Set(roles.filter((role) => role.status === "ACTIVE").map((role) => role.id));
        const matchedRoleIds = Array.from(
          new Set(
            bindings
              .filter(
                (binding) =>
                  binding.status === "ACTIVE" &&
                  binding.userId === baseMeta.operatorId &&
                  activeRoleIds.has(binding.roleId)
              )
              .map((binding) => binding.roleId)
          )
        );
        const grantGroups = await Promise.all(
          matchedRoleIds.map((roleId) => configCenterService.listRoleResourceGrants(roleId))
        );
        const activeResourcePathByCode = new Map(
          resources
            .filter((resource) => resource.status === "ACTIVE")
            .map((resource) => [resource.resourceCode, resource.resourcePath] as const)
        );
        const grantedPaths = grantGroups
          .flat()
          .map((grant) => activeResourcePathByCode.get(grant.resourceCode))
          .filter((resourcePath): resourcePath is string => Boolean(resourcePath));
        const merged = Array.from(new Set(grantedPaths));
        if (alive) {
          setEffectiveResourcePaths(merged);
        }
      } catch {
        if (alive) {
          setEffectiveResourcePaths([]);
        }
      }
    }

    void loadEffectiveResourcePaths();

    const handleRolesChanged = () => {
      void loadEffectiveResourcePaths();
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
  }, [baseMeta.operatorId, value.persona]);

  const contextValue = useMemo(
    () => ({
      ...value,
      effectiveResourcePaths
    }),
    [effectiveResourcePaths, value]
  );

  return <MockSessionContext.Provider value={contextValue}>{children}</MockSessionContext.Provider>;
}

export function useMockSession() {
  const context = useContext(MockSessionContext);
  if (!context) {
    throw new Error("useMockSession must be used within MockSessionProvider");
  }
  const meta = mockUserPersonaMetaMap[context.persona];
  const hasResource = (resourcePath: string) => context.effectiveResourcePaths.includes(resourcePath);
  return {
    ...context,
    meta,
    hasResource
  };
}
