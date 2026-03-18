import { configCenterService } from "./services/configCenterService";
import type { LifecycleState, PublishPendingItem, PublishValidationReport } from "./types";

export type EffectiveActionType = "PUBLISH" | "DISABLE" | "RESTORE";
export type EffectiveScopeMode = "ALL_ORGS" | "CUSTOM_ORGS";

export type EffectiveActionMeta = {
  type: EffectiveActionType;
  label: string;
  title: string;
  description: string;
};

export function getEffectiveActionMeta(status: LifecycleState): EffectiveActionMeta {
  if (status === "ACTIVE") {
    return {
      type: "DISABLE",
      label: "暂停生效",
      title: "确认暂停生效",
      description: "暂停后对象将不再对线上产生影响，可在后续恢复生效。"
    };
  }
  if (status === "DISABLED" || status === "EXPIRED") {
    return {
      type: "RESTORE",
      label: "恢复生效",
      title: "确认恢复生效",
      description: "恢复后对象将重新参与线上流程，系统会先执行生效检查。"
    };
  }
  return {
    type: "PUBLISH",
    label: "立即生效",
    title: "确认立即生效",
    description: "系统会自动执行生效检查，检查通过后才会正式生效。"
  };
}

type EffectivePermissionResourcePath = string;

const actionRequiredPermissions: Record<EffectiveActionType, EffectivePermissionResourcePath[]> = {
  PUBLISH: ["/action/common/base/publish", "/action/common/base/validate"],
  DISABLE: ["/action/common/base/publish"],
  RESTORE: ["/action/common/base/publish", "/action/common/base/validate"]
};

const actionLabelByPermission: Record<EffectivePermissionResourcePath, string> = {
  "/action/common/base/validate": "校验",
  "/action/common/base/publish": "发布"
};

const actionLabelByType: Record<EffectiveActionType, string> = {
  PUBLISH: "立即生效",
  DISABLE: "暂停生效",
  RESTORE: "恢复生效"
};

export function getEffectiveMissingPermissions(
  actionType: EffectiveActionType,
  hasPermission: (resourcePath: string) => boolean
): EffectivePermissionResourcePath[] {
  return actionRequiredPermissions[actionType].filter((resourcePath) => !hasPermission(resourcePath));
}

export function getEffectivePermissionBlockedMessage(
  actionType: EffectiveActionType,
  hasPermission: (resourcePath: string) => boolean
): string | null {
  const missing = getEffectiveMissingPermissions(actionType, hasPermission);
  if (missing.length === 0) {
    return null;
  }
  const labels = missing.map((resourcePath) => actionLabelByPermission[resourcePath] ?? resourcePath).join("、");
  return `缺少${labels}权限，暂不可执行${actionLabelByType[actionType]}。`;
}

export async function findPendingByResource(
  resourceType: PublishPendingItem["resourceType"],
  resourceId: number
): Promise<PublishPendingItem | null> {
  const pendingRows = await configCenterService.listPendingItems();
  return pendingRows.find((item) => item.resourceType === resourceType && item.resourceId === resourceId) ?? null;
}

export async function getPublishValidationByResource(
  resourceType: PublishPendingItem["resourceType"],
  resourceId: number
): Promise<{ pendingId: number; report: PublishValidationReport } | null> {
  const pending = await findPendingByResource(resourceType, resourceId);
  if (!pending) {
    return null;
  }
  const report = await configCenterService.getPendingValidationReport(pending.id);
  return {
    pendingId: pending.id,
    report
  };
}
