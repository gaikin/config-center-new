import type {
  ExecutionLogItem,
  PublishAuditLog,
  PublishPendingItem,
  JobExecutionSummary,
  LifecycleState,
  PromptMode,
  TriggerLogItem
} from "./types";

export const lifecycleLabelMap: Record<LifecycleState, string> = {
  DRAFT: "草稿",
  ACTIVE: "生效",
  DISABLED: "停用",
  EXPIRED: "失效"
};

export const lifecycleOptions = (["DRAFT", "ACTIVE", "DISABLED", "EXPIRED"] as const).map((value) => ({
  value,
  label: lifecycleLabelMap[value]
}));

export const promptModeLabelMap: Record<PromptMode, string> = {
  SILENT: "静默提示",
  FLOATING: "浮窗提示"
};

export const pendingTypeLabelMap: Record<PublishPendingItem["pendingType"], string> = {
  DRAFT: "待发布",
  EXPIRING_SOON: "即将到期",
  VALIDATION_FAILED: "检查未通过",
  CONFLICT: "冲突",
  RISK_CONFIRM: "待风险确认"
};

export const resourceTypeLabelMap: Record<PublishPendingItem["resourceType"] | "ROLE", string> = {
  PAGE_RESOURCE: "页面",
  RULE: "提示规则",
  JOB_SCENE: "作业场景",
  INTERFACE: "API",
  LIST_DATA: "名单",
  PREPROCESSOR: "数据转换规则",
  MENU_SDK_POLICY: "菜单能力灰度策略",
  PAGE_ACTIVATION_POLICY: "页面开通设置",
  ROLE: "角色"
};

export const auditActionLabelMap: Record<PublishAuditLog["action"], string> = {
  PUBLISH: "发布",
  DISABLE: "停用",
  ROLLBACK: "回滚",
  RISK_CONFIRM: "风险确认",
  ROLE_UPDATE: "角色变更",
  DEFER: "延期",
  VALIDATE: "发布检查",
  RESOLVE: "处理完成"
};

export const triggerResultLabelMap: Record<TriggerLogItem["triggerResult"], string> = {
  HIT: "命中",
  MISS: "未命中",
  FAILED: "失败"
};

export const triggerSourceLabelMap: Record<ExecutionLogItem["triggerSource"], string> = {
  PROMPT_CONFIRM: "提示确认",
  FLOATING_BUTTON: "悬浮触发",
  AUTO: "自动触发",
  MANUAL_RETRY: "人工重试"
};

export const executionResultLabelMap: Record<ExecutionLogItem["result"], string> = {
  SUCCESS: "成功",
  PARTIAL_SUCCESS: "部分成功",
  FAILED: "失败"
};

export const jobNodeResultLabelMap: Record<JobExecutionSummary["result"], string> = {
  SUCCESS: "成功",
  PARTIAL_SUCCESS: "部分成功",
  FAILED: "失败"
};
