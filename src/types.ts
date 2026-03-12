export type LifecycleState = "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED";

export type PromptMode = "SILENT" | "FLOATING";
export type PromptCloseMode = "AUTO_CLOSE" | "MANUAL_CLOSE" | "TIMER_THEN_MANUAL";
export type ExecutionMode =
  | "AUTO_WITHOUT_PROMPT"
  | "AUTO_AFTER_PROMPT"
  | "PREVIEW_THEN_EXECUTE"
  | "FLOATING_BUTTON";

export type RuleLogicType = "AND" | "OR";
export type RuleOperandSourceType = "PAGE_FIELD" | "INTERFACE_FIELD" | "CONST" | "CONTEXT";
export type RuleOperator = "EQ" | "NE" | "GT" | "GE" | "LT" | "LE" | "CONTAINS" | "NOT_CONTAINS" | "IN" | "EXISTS";

export interface PageSite {
  id: number;
  code: string;
  name: string;
  status: LifecycleState;
}

export interface PageMenu {
  id: number;
  siteId: number;
  zoneName: string;
  menuName: string;
  menuCode: string;
  status: LifecycleState;
  ownerOrgId: string;
}

export interface PageResource {
  id: number;
  menuId: number;
  name: string;
  status: LifecycleState;
  ownerOrgId: string;
  currentVersion: number;
  elementCount: number;
  detectRulesSummary: string;
  updatedAt: string;
}

export interface PageElement {
  id: number;
  pageResourceId: number;
  logicName: string;
  selector: string;
  selectorType: "XPATH" | "CSS";
  required: boolean;
  updatedAt: string;
}

export interface InterfaceDefinition {
  id: number;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  status: LifecycleState;
  ownerOrgId: string;
  currentVersion: number;
  timeoutMs: number;
  retryTimes: number;
  paramSourceSummary: string;
  responsePath: string;
  maskSensitive: boolean;
  updatedAt: string;
}

export interface PreprocessorDefinition {
  id: number;
  name: string;
  processorType: "BUILT_IN" | "SCRIPT";
  category: "STRING" | "NUMBER" | "DATE" | "JSON";
  status: LifecycleState;
  ownerOrgId: string;
  usedByCount: number;
  updatedAt: string;
}

export interface RuleDefinition {
  id: number;
  name: string;
  pageResourceId: number;
  pageResourceName: string;
  priority: number;
  promptMode: PromptMode;
  closeMode: PromptCloseMode;
  closeTimeoutSec?: number;
  hasConfirmButton: boolean;
  sceneId?: number;
  sceneName?: string;
  status: LifecycleState;
  currentVersion: number;
  ownerOrgId: string;
  updatedAt: string;
}

export interface RuleOperand {
  sourceType: RuleOperandSourceType;
  key: string;
  constValue?: string;
  preprocessorIds: number[];
}

export interface RuleConditionGroup {
  id: number;
  ruleId: number;
  logicType: RuleLogicType;
  parentGroupId?: number;
  updatedAt: string;
}

export interface RuleCondition {
  id: number;
  ruleId: number;
  groupId: number;
  left: RuleOperand;
  operator: RuleOperator;
  right?: RuleOperand;
  updatedAt: string;
}

export interface RulePreviewInput {
  pageFields: Record<string, string>;
  interfaceFields: Record<string, string>;
  context: Record<string, string>;
}

export interface RulePreviewTrace {
  conditionId: number;
  expression: string;
  leftValue: string;
  rightValue: string;
  passed: boolean;
  reason: string;
}

export interface RulePreviewResult {
  ruleId: number;
  matched: boolean;
  summary: string;
  traces: RulePreviewTrace[];
}

export type JobNodeType = "page_get" | "api_call" | "js_script" | "page_set";

export interface JobSceneDefinition {
  id: number;
  name: string;
  pageResourceId: number;
  pageResourceName: string;
  executionMode: ExecutionMode;
  status: LifecycleState;
  currentVersion: number;
  nodeCount: number;
  manualDurationSec: number;
  riskConfirmed: boolean;
  updatedAt: string;
}

export interface JobNodeDefinition {
  id: number;
  sceneId: number;
  nodeType: JobNodeType;
  name: string;
  orderNo: number;
  enabled: boolean;
  configJson: string;
  updatedAt: string;
}

export interface JobExecutionSummary {
  id: number;
  sceneId: number;
  sceneName: string;
  triggerSource: ExecutionLogItem["triggerSource"];
  result: ExecutionLogItem["result"];
  fallbackToManual: boolean;
  detail: string;
  startedAt: string;
  finishedAt: string;
}

export interface JobNodeRunLog {
  id: number;
  executionId: number;
  nodeId: number;
  nodeName: string;
  nodeType: JobNodeType;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  latencyMs: number;
  detail: string;
  createdAt: string;
}

export interface JobScenePreviewField {
  key: string;
  fieldName: string;
  originalValue: string;
  nextValue: string;
  source: string;
  abnormal: boolean;
}

export interface GovernancePendingSummary {
  draftCount: number;
  expiringSoonCount: number;
  validationFailedCount: number;
  conflictCount: number;
  riskConfirmPendingCount: number;
}

export interface GovernancePendingItem {
  id: number;
  resourceType: "PAGE_RESOURCE" | "RULE" | "JOB_SCENE" | "INTERFACE" | "PREPROCESSOR";
  resourceId: number;
  resourceName: string;
  status: LifecycleState;
  ownerOrgId: string;
  pendingType: "DRAFT" | "EXPIRING_SOON" | "VALIDATION_FAILED" | "CONFLICT" | "RISK_CONFIRM";
  updatedAt: string;
}

export interface GovernanceAuditLog {
  id: number;
  action: "PUBLISH" | "DISABLE" | "ROLLBACK" | "RISK_CONFIRM" | "ROLE_UPDATE" | "DEFER" | "VALIDATE" | "RESOLVE";
  resourceType: string;
  resourceId?: number;
  resourceName: string;
  operator: string;
  createdAt: string;
}

export interface ValidationItem {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ValidationReport {
  pass: boolean;
  items: ValidationItem[];
}

export interface TriggerLogItem {
  id: number;
  ruleName: string;
  pageResourceName: string;
  triggerResult: "HIT" | "MISS" | "FAILED";
  reason: string;
  operator: string;
  createdAt: string;
}

export interface ExecutionLogItem {
  id: number;
  sceneName: string;
  triggerSource: "PROMPT_CONFIRM" | "FLOATING_BUTTON" | "AUTO" | "MANUAL_RETRY";
  result: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  latencyMs: number;
  reason: string;
  createdAt: string;
}

export interface FailureReasonMetric {
  reason: string;
  count: number;
  ratio: number;
}

export interface MetricsOverview {
  executionSuccessRate: number;
  avgSavedSeconds: number;
  expiredResourceCount: number;
  expiringSoonResourceCount: number;
}

export type ActionType =
  | "VIEW"
  | "CONFIG"
  | "VALIDATE"
  | "PUBLISH"
  | "DISABLE"
  | "DEFER"
  | "ROLLBACK"
  | "AUDIT_VIEW"
  | "RISK_CONFIRM"
  | "ROLE_MANAGE";

export interface RoleItem {
  id: number;
  name: string;
  roleType:
    | "BUSINESS_OPERATOR"
    | "BUSINESS_CONFIG"
    | "BUSINESS_MANAGER"
    | "BUSINESS_AUDITOR"
    | "BUSINESS_SUPER_ADMIN"
    | "PLATFORM_SUPPORT";
  status: "ACTIVE" | "DISABLED";
  orgScopeId: string;
  actions: ActionType[];
  memberCount: number;
  updatedAt: string;
}

export interface DashboardOverview {
  pageResourceCount: number;
  activeRuleCount: number;
  activeSceneCount: number;
  activeInterfaceCount: number;
  roleCount: number;
  pendingCount: number;
  metrics: MetricsOverview;
}
