export type LifecycleState = "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED";

export type PromptMode = "SILENT" | "FLOATING";
export type PromptCloseMode = "AUTO_CLOSE" | "MANUAL_CLOSE" | "TIMER_THEN_MANUAL";
export type ExecutionMode =
  | "AUTO_WITHOUT_PROMPT"
  | "AUTO_AFTER_PROMPT"
  | "PREVIEW_THEN_EXECUTE"
  | "FLOATING_BUTTON";

export type RuleLogicType = "AND" | "OR";
export type RuleOperandSourceType = "PAGE_FIELD" | "INTERFACE_FIELD" | "LIST_LOOKUP_FIELD" | "CONST" | "CONTEXT";
export type RuleLookupSourceType = Exclude<RuleOperandSourceType, "LIST_LOOKUP_FIELD">;
export type RuleOperator = "EQ" | "NE" | "GT" | "GE" | "LT" | "LE" | "CONTAINS" | "NOT_CONTAINS" | "IN" | "EXISTS";
export type RuleOperandValueType = "STRING" | "NUMBER" | "BOOLEAN" | "OBJECT" | "ARRAY";
export type ListDataBuildStatus = "PENDING" | "BUILDING" | "READY" | "FAILED";
export type ListLookupJudgement = "MATCHED" | "NOT_MATCHED";

export interface PageSite {
  id: number;
  code: string;
  name: string;
  status: LifecycleState;
}

export interface PageRegion {
  id: number;
  siteId: number;
  regionCode: string;
  regionName: string;
  status: LifecycleState;
}

export interface PageMenu {
  id: number;
  siteId: number;
  regionId: number;
  menuName: string;
  menuCode: string;
  status: LifecycleState;
  ownerOrgId: string;
}

export interface PageResource {
  id: number;
  menuId: number;
  pageCode: string;
  frameCode?: string;
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

export interface BusinessFieldDefinition {
  id: number;
  code: string;
  name: string;
  scope: "GLOBAL" | "PAGE_RESOURCE";
  pageResourceId?: number;
  valueType: RuleOperandValueType;
  required: boolean;
  description: string;
  ownerOrgId: string;
  status: LifecycleState;
  currentVersion: number;
  aliases: string[];
  updatedAt: string;
}

export interface PageFieldBinding {
  id: number;
  pageResourceId: number;
  businessFieldCode: string;
  pageElementId: number;
  required: boolean;
  updatedAt: string;
}

export type ApiValueType = "STRING" | "NUMBER" | "BOOLEAN" | "OBJECT" | "ARRAY";
export type ApiOutputPathMode = "AUTO" | "MANUAL";
export type ApiInputRegexMode = "NONE" | "TEMPLATE" | "CUSTOM";
export type ApiInputRegexTemplateKey = "MOBILE_CN" | "ID_CARD_CN" | "EMAIL";

export interface ApiInputValidationConfig {
  required: boolean;
  regexMode?: ApiInputRegexMode;
  regexTemplateKey?: ApiInputRegexTemplateKey;
  regexPattern?: string;
  regexErrorMessage?: string;
}

export interface ApiInputParam {
  id: string;
  name: string;
  description: string;
  valueType: ApiValueType;
  validationConfig?: ApiInputValidationConfig;
}

export interface ApiOutputParam {
  id: string;
  name: string;
  path: string;
  pathMode?: ApiOutputPathMode;
  description: string;
  valueType: ApiValueType;
  children?: ApiOutputParam[];
}

export interface InterfaceDefinition {
  id: number;
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  testPath: string;
  prodPath: string;
  url: string;
  status: LifecycleState;
  ownerOrgId: string;
  currentVersion: number;
  timeoutMs: number;
  retryTimes: number;
  bodyTemplateJson: string;
  inputConfigJson: string;
  outputConfigJson: string;
  paramSourceSummary: string;
  responsePath: string;
  maskSensitive: boolean;
  updatedAt: string;
}

export interface ListDataDefinition {
  id: number;
  name: string;
  description: string;
  ownerOrgId: string;
  scope: string;
  effectiveStartAt: string;
  effectiveEndAt: string;
  status: LifecycleState;
  currentVersion: number;
  rowCount: number;
  importColumns: string[];
  outputFields: string[];
  importFileName: string;
  indexBuildStatus: ListDataBuildStatus;
  activeAlias: string;
  updatedAt: string;
}

export interface RuleListLookupCondition {
  id: string;
  sourceType: RuleOperandSourceType;
  sourceValue: string;
  listDataId?: number;
  listDataName?: string;
  matchColumn: string;
  judgement: ListLookupJudgement;
}

export interface PreprocessorDefinition {
  id: number;
  name: string;
  processorType: "BUILT_IN" | "SCRIPT";
  category: "STRING" | "NUMBER" | "DATE" | "JSON";
  scriptContent?: string;
  status: LifecycleState;
  ownerOrgId: string;
  usedByCount: number;
  updatedAt: string;
}

export interface PromptContentConfig {
  version: 1;
  titleSuffix?: string;
  bodyTemplate: string;
  bodyEditorStateJson?: string;
}

export interface RuleDefinition {
  id: number;
  name: string;
  ruleScope: "SHARED" | "PAGE_RESOURCE";
  ruleSetCode: string;
  pageResourceId?: number;
  pageResourceName?: string;
  sourceRuleId?: number;
  sourceRuleName?: string;
  priority: number;
  promptMode: PromptMode;
  closeMode: PromptCloseMode;
  promptContentConfigJson: string;
  closeTimeoutSec?: number;
  hasConfirmButton: boolean;
  sceneId?: number;
  sceneName?: string;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  status: LifecycleState;
  currentVersion: number;
  ownerOrgId: string;
  listLookupConditions?: RuleListLookupCondition[];
  updatedAt: string;
}

export interface RuleOperand {
  sourceType: RuleOperandSourceType;
  key: string;
  constValue?: string;
  preprocessorIds: number[];
  valueType?: RuleOperandValueType;
  displayValue?: string;
  interfaceBinding?: {
    interfaceId?: number;
    interfaceName?: string;
    outputPath?: string;
    inputConfig?: string;
  };
  listBinding?: {
    listDataId?: number;
    listDataName?: string;
    matchColumn?: string;
    lookupSourceType?: RuleLookupSourceType;
    lookupSourceValue?: string;
    matchers?: Array<{
      matchColumn: string;
      sourceType: RuleLookupSourceType;
      sourceValue: string;
    }>;
    resultField?: string;
  };
  preprocessorConfigs?: Array<{
    preprocessorId: number;
    params?: string;
  }>;
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

export type JobNodeType = "page_get" | "api_call" | "list_lookup" | "js_script" | "page_set";

export interface JobSceneDefinition {
  id: number;
  name: string;
  pageResourceId: number;
  pageResourceName: string;
  executionMode: ExecutionMode;
  previewBeforeExecute?: boolean;
  floatingButtonEnabled?: boolean;
  floatingButtonLabel?: string;
  floatingButtonX?: number;
  floatingButtonY?: number;
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

export interface SdkArtifactVersion {
  id: number;
  sdkVersion: string;
  sdkMajorVersion: number;
  loaderVersion: string;
  artifactManifestUrl: string;
  compatibility: string;
  status: LifecycleState;
  publishedBy: string;
  publishedAt: string;
  notes: string;
}

export interface PlatformRuntimeConfig {
  promptStableVersion: string;
  promptGrayDefaultVersion?: string;
  jobStableVersion: string;
  jobGrayDefaultVersion?: string;
  updatedAt: string;
  updatedBy: string;
}

export type JobPreloadPolicy = "immediate" | "idle" | "intent" | "none";
export type CapabilityOpenStatus = "ENABLED" | "DISABLED" | "PENDING";

export interface MenuSdkPolicy {
  id: number;
  siteId: number;
  regionId: number;
  menuId: number;
  menuCode: string;
  promptGrayEnabled: boolean;
  promptGrayVersion?: string;
  promptGrayOrgIds: string[];
  jobGrayEnabled: boolean;
  jobGrayVersion?: string;
  jobGrayOrgIds: string[];
  effectiveStart: string;
  effectiveEnd: string;
  status: LifecycleState;
  ownerOrgId: string;
  updatedAt: string;
}

export interface MenuCapabilityPolicy {
  id: number;
  menuId: number;
  promptStatus: CapabilityOpenStatus;
  jobStatus: CapabilityOpenStatus;
  status: LifecycleState;
  updatedAt: string;
  updatedBy: string;
}

export interface MenuCapabilityRequest {
  id: number;
  menuId: number;
  capabilityType: "PROMPT" | "JOB";
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  applicant: string;
  createdAt: string;
}

export interface PageActivationPolicy {
  id: number;
  pageResourceId: number;
  enabled: boolean;
  promptRuleSetName: string;
  hasJobScenes: boolean;
  jobPreloadPolicy: JobPreloadPolicy;
  jobSceneName?: string;
  status: LifecycleState;
  ownerOrgId: string;
  updatedAt: string;
}

export interface PublishPendingSummary {
  draftCount: number;
  expiringSoonCount: number;
  validationFailedCount: number;
  conflictCount: number;
  riskConfirmPendingCount: number;
}

export interface PublishPendingItem {
  id: number;
  resourceType:
    | "PAGE_RESOURCE"
    | "RULE"
    | "JOB_SCENE"
    | "INTERFACE"
    | "LIST_DATA"
    | "PREPROCESSOR"
    | "MENU_SDK_POLICY"
    | "PAGE_ACTIVATION_POLICY";
  resourceId: number;
  resourceName: string;
  status: LifecycleState;
  ownerOrgId: string;
  pendingType: "DRAFT" | "EXPIRING_SOON" | "VALIDATION_FAILED" | "CONFLICT" | "RISK_CONFIRM";
  updatedAt: string;
}

export interface PublishAuditLog {
  id: number;
  action: "PUBLISH" | "DISABLE" | "ROLLBACK" | "RISK_CONFIRM" | "ROLE_UPDATE" | "DEFER" | "VALIDATE" | "RESOLVE";
  resourceType: string;
  resourceId?: number;
  resourceName: string;
  operator: string;
  effectiveScopeType?: "ALL_ORGS" | "CUSTOM_ORGS";
  effectiveOrgIds?: string[];
  effectiveScopeSummary?: string;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  approvalTicketId?: string;
  approvalSource?: string;
  approvalStatus?: string;
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

export type ValidationLevel = "blocking" | "warning";

export interface FieldValidationIssue {
  kind: "field";
  key: string;
  level: ValidationLevel;
  section: string;
  field: string;
  label: string;
  message: string;
  action?: string;
}

export interface SectionValidationIssue {
  kind: "section";
  key: string;
  level: ValidationLevel;
  section: string;
  title: string;
  message: string;
  action?: string;
}

export interface ObjectValidationIssue {
  kind: "object";
  key: string;
  level: ValidationLevel;
  section: string;
  objectType: string;
  title: string;
  message: string;
  objectName?: string;
  action?: string;
}

export type ValidationIssue = FieldValidationIssue | SectionValidationIssue | ObjectValidationIssue;

export interface SaveValidationReport {
  ok: boolean;
  canSaveDraft: boolean;
  summary: string;
  fieldIssues: FieldValidationIssue[];
  sectionIssues: SectionValidationIssue[];
  objectIssues: ObjectValidationIssue[];
  blockingCount: number;
  warningCount: number;
}

export interface PublishValidationReport extends ValidationReport {
  blockingCount: number;
  warningCount: number;
  impactSummary?: string;
  riskItems?: string[];
}

export interface SaveDraftResult<T> {
  success: boolean;
  data?: T;
  report: SaveValidationReport;
}

export interface PublishPendingResult {
  success: boolean;
  report: PublishValidationReport;
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

export type ResourceType = "MENU" | "PAGE" | "ACTION";
export type PermissionResourceStatus = "ACTIVE" | "DISABLED";

export interface PermissionResource {
  id: number;
  resourceCode: string;
  resourceName: string;
  resourceType: ResourceType;
  resourcePath: string;
  pagePath?: string;
  status: PermissionResourceStatus;
  orderNo: number;
  description?: string;
  updatedAt: string;
}

export interface RoleItem {
  id: number;
  name: string;
  roleType: "CONFIG_OPERATOR" | "PERMISSION_ADMIN" | "TECH_SUPPORT";
  status: "ACTIVE" | "DISABLED";
  orgScopeId: string;
  memberCount: number;
  updatedAt: string;
}

export interface RoleResourceGrant {
  id: number;
  roleId: number;
  resourceCode: string;
  createdAt: string;
}

export interface UserRoleBinding {
  id: number;
  userId: string;
  roleId: number;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
}

export interface RolePermissionOperator {
  operatorId: string;
  roleType: RoleItem["roleType"];
  orgScopeId: string;
  approvalTicketId?: string;
  approvalSource?: string;
  approvalStatus?: string;
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
