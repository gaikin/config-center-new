import type { ActionType, RoleItem } from "./types";

export const HEAD_OFFICE_ORG_ID = "head-office";

// Future high-privilege actions should be added here.
export const HIGH_PRIVILEGE_ACTIONS: ActionType[] = ["MENU_ENABLE_MANAGE"];

export function getRoleTypeDefaultActions(roleType: RoleItem["roleType"], orgScopeId: string): ActionType[] {
  if (roleType === "CONFIG_OPERATOR") {
    return ["VIEW", "CONFIG", "VALIDATE", "PUBLISH"];
  }
  if (roleType === "PERMISSION_ADMIN") {
    return orgScopeId === HEAD_OFFICE_ORG_ID
      ? ["VIEW", "ROLE_MANAGE", "MENU_ENABLE_MANAGE"]
      : ["VIEW", "ROLE_MANAGE"];
  }
  return ["VIEW", "VALIDATE", "AUDIT_VIEW"];
}

export function normalizeRoleActions(
  roleType: RoleItem["roleType"],
  orgScopeId: string,
  actions: ActionType[]
): ActionType[] {
  const defaultActions = getRoleTypeDefaultActions(roleType, orgScopeId);
  const merged = Array.from(new Set([...defaultActions, ...actions]));
  if (orgScopeId !== HEAD_OFFICE_ORG_ID) {
    return merged.filter((action) => !HIGH_PRIVILEGE_ACTIONS.includes(action));
  }
  return merged;
}

export function hasHighPrivilegeAction(actions: ActionType[]): boolean {
  return actions.some((action) => HIGH_PRIVILEGE_ACTIONS.includes(action));
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
