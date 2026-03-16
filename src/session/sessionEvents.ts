export const ROLE_PERMISSIONS_CHANGED_EVENT = "config-center:roles-changed";

export function notifyRolePermissionsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROLE_PERMISSIONS_CHANGED_EVENT));
  }
}
