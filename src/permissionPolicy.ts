import type { RoleItem } from "./types";

export const HEAD_OFFICE_ORG_ID = "head-office";

export const HIGH_PRIVILEGE_RESOURCE_PATHS: string[] = ["/action/page-management/capability/manage"];

const BASE_RESOURCE_PATHS: string[] = [
  "/menu/dashboard",
  "/menu/stats",
  "/page/dashboard/list",
  "/page/stats/list",
  "/action/common/base/view"
];

const CONFIG_OPERATOR_RESOURCE_PATHS: string[] = [
  ...BASE_RESOURCE_PATHS,
  "/menu/page-management",
  "/menu/prompts",
  "/menu/jobs",
  "/menu/interfaces",
  "/menu/advanced",
  "/page/page-management/list",
  "/page/prompts/list",
  "/page/jobs/list",
  "/page/interfaces/list",
  "/page/advanced/list",
  "/action/common/base/config",
  "/action/common/base/validate",
  "/action/common/base/publish"
];

const PERMISSION_ADMIN_RESOURCE_PATHS: string[] = [
  ...BASE_RESOURCE_PATHS,
  "/menu/advanced",
  "/page/advanced/list",
  "/action/roles/list/manage"
];

const TECH_SUPPORT_RESOURCE_PATHS: string[] = [
  ...BASE_RESOURCE_PATHS,
  "/menu/advanced",
  "/page/advanced/list",
  "/action/common/base/validate",
  "/action/common/base/audit-view"
];

export function getRoleTypeRecommendedResourcePaths(roleType: RoleItem["roleType"], orgScopeId: string): string[] {
  if (roleType === "CONFIG_OPERATOR") {
    const withHighPrivilege =
      orgScopeId === HEAD_OFFICE_ORG_ID
        ? [...CONFIG_OPERATOR_RESOURCE_PATHS, ...HIGH_PRIVILEGE_RESOURCE_PATHS]
        : CONFIG_OPERATOR_RESOURCE_PATHS;
    return Array.from(new Set(withHighPrivilege));
  }
  if (roleType === "PERMISSION_ADMIN") {
    const withHighPrivilege =
      orgScopeId === HEAD_OFFICE_ORG_ID
        ? [...PERMISSION_ADMIN_RESOURCE_PATHS, ...HIGH_PRIVILEGE_RESOURCE_PATHS]
        : PERMISSION_ADMIN_RESOURCE_PATHS;
    return Array.from(new Set(withHighPrivilege));
  }
  return Array.from(new Set(TECH_SUPPORT_RESOURCE_PATHS));
}

export function normalizeRoleResourcePaths(
  roleType: RoleItem["roleType"],
  orgScopeId: string,
  resourcePaths: string[]
): string[] {
  const recommended = getRoleTypeRecommendedResourcePaths(roleType, orgScopeId);
  const merged = Array.from(new Set([...recommended, ...resourcePaths]));
  if (orgScopeId !== HEAD_OFFICE_ORG_ID) {
    return merged.filter((resourcePath) => !HIGH_PRIVILEGE_RESOURCE_PATHS.includes(resourcePath));
  }
  return merged;
}

export function hasHighPrivilegeResource(resourcePaths: string[]): boolean {
  return resourcePaths.some((resourcePath) => HIGH_PRIVILEGE_RESOURCE_PATHS.includes(resourcePath));
}

export function isHeadOfficePermissionAdmin(operator: {
  roleType: RoleItem["roleType"];
  orgScopeId: string;
}): boolean {
  return operator.roleType === "PERMISSION_ADMIN" && operator.orgScopeId === HEAD_OFFICE_ORG_ID;
}

export function isHeadOfficeOnlyRole(roleType: RoleItem["roleType"]): boolean {
  return roleType === "TECH_SUPPORT";
}
