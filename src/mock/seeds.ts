import type {
  DashboardOverview,
  ExecutionLogItem,
  GovernanceAuditLog,
  GovernancePendingItem,
  GovernancePendingSummary,
  InterfaceDefinition,
  JobExecutionSummary,
  JobNodeDefinition,
  JobNodeRunLog,
  JobSceneDefinition,
  PageElement,
  PageMenu,
  PageResource,
  PageSite,
  PreprocessorDefinition,
  RoleItem,
  RuleCondition,
  RuleConditionGroup,
  RuleDefinition,
  TriggerLogItem
} from "../types";

const now = () => new Date().toISOString();

export const seedPageSites: PageSite[] = [
  { id: 1, code: "kaiyang", name: "开阳核心业务系统", status: "ACTIVE" },
  { id: 2, code: "counter", name: "柜面统一办理系统", status: "ACTIVE" }
];

export const seedPageMenus: PageMenu[] = [
  {
    id: 101,
    siteId: 1,
    zoneName: "贷款专区",
    menuName: "贷款申请",
    menuCode: "loan_apply",
    status: "ACTIVE",
    ownerOrgId: "branch-east"
  },
  {
    id: 102,
    siteId: 1,
    zoneName: "贷款专区",
    menuName: "贷款审核",
    menuCode: "loan_review",
    status: "ACTIVE",
    ownerOrgId: "branch-east"
  },
  {
    id: 201,
    siteId: 2,
    zoneName: "对公专区",
    menuName: "开户办理",
    menuCode: "open_account",
    status: "ACTIVE",
    ownerOrgId: "branch-south"
  }
];

export const seedPageResources: PageResource[] = [
  {
    id: 1001,
    menuId: 101,
    name: "贷款申请主页面",
    status: "ACTIVE",
    ownerOrgId: "branch-east",
    currentVersion: 5,
    elementCount: 28,
    detectRulesSummary: "业务标识优先 + URL兜底",
    updatedAt: now()
  },
  {
    id: 1002,
    menuId: 201,
    name: "开户办理主页面",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    currentVersion: 2,
    elementCount: 18,
    detectRulesSummary: "URL兜底",
    updatedAt: now()
  }
];

export const seedPageElements: PageElement[] = [
  {
    id: 12001,
    pageResourceId: 1001,
    logicName: "客户姓名",
    selector: "//*[@id='customer-name']",
    selectorType: "XPATH",
    required: true,
    updatedAt: now()
  },
  {
    id: 12002,
    pageResourceId: 1001,
    logicName: "客户证件号",
    selector: "#id-no",
    selectorType: "CSS",
    required: true,
    updatedAt: now()
  },
  {
    id: 12003,
    pageResourceId: 1002,
    logicName: "开户用途",
    selector: "//*[@name='purpose']",
    selectorType: "XPATH",
    required: false,
    updatedAt: now()
  }
];

export const seedInterfaces: InterfaceDefinition[] = [
  {
    id: 3001,
    name: "客户风险评分查询",
    method: "POST",
    url: "/risk/score/query",
    status: "ACTIVE",
    ownerOrgId: "branch-east",
    currentVersion: 3,
    timeoutMs: 3000,
    retryTimes: 1,
    paramSourceSummary: "客户号来自页面元素 customer_id",
    responsePath: "$.data.score",
    maskSensitive: true,
    updatedAt: now()
  },
  {
    id: 3002,
    name: "客户基础信息查询",
    method: "POST",
    url: "/customer/profile/query",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    currentVersion: 1,
    timeoutMs: 3000,
    retryTimes: 0,
    paramSourceSummary: "身份证号来自页面元素 id_no",
    responsePath: "$.data.profile",
    maskSensitive: true,
    updatedAt: now()
  }
];

export const seedPreprocessors: PreprocessorDefinition[] = [
  {
    id: 3501,
    name: "去空格",
    processorType: "BUILT_IN",
    category: "STRING",
    status: "ACTIVE",
    ownerOrgId: "head-office",
    usedByCount: 22,
    updatedAt: now()
  },
  {
    id: 3502,
    name: "日期格式化 yyyy-MM-dd",
    processorType: "BUILT_IN",
    category: "DATE",
    status: "ACTIVE",
    ownerOrgId: "head-office",
    usedByCount: 14,
    updatedAt: now()
  },
  {
    id: 3503,
    name: "手机号脱敏脚本",
    processorType: "SCRIPT",
    category: "STRING",
    status: "DRAFT",
    ownerOrgId: "branch-east",
    usedByCount: 4,
    updatedAt: now()
  }
];

export const seedJobScenes: JobSceneDefinition[] = [
  {
    id: 5001,
    name: "贷款申请自动查数预填",
    pageResourceId: 1001,
    pageResourceName: "贷款申请主页面",
    executionMode: "PREVIEW_THEN_EXECUTE",
    status: "ACTIVE",
    currentVersion: 4,
    nodeCount: 4,
    manualDurationSec: 55,
    riskConfirmed: true,
    updatedAt: now()
  },
  {
    id: 5002,
    name: "开户证件信息同步",
    pageResourceId: 1002,
    pageResourceName: "开户办理主页面",
    executionMode: "AUTO_AFTER_PROMPT",
    status: "DRAFT",
    currentVersion: 1,
    nodeCount: 3,
    manualDurationSec: 35,
    riskConfirmed: false,
    updatedAt: now()
  }
];

export const seedJobNodes: JobNodeDefinition[] = [
  {
    id: 51001,
    sceneId: 5001,
    nodeType: "page_get",
    name: "读取客户号",
    orderNo: 1,
    enabled: true,
    configJson: "{\"field\":\"customer_id\"}",
    updatedAt: now()
  },
  {
    id: 51002,
    sceneId: 5001,
    nodeType: "api_call",
    name: "查询风险评分",
    orderNo: 2,
    enabled: true,
    configJson: "{\"interfaceId\":3001}",
    updatedAt: now()
  },
  {
    id: 51003,
    sceneId: 5001,
    nodeType: "js_script",
    name: "格式化手机号",
    orderNo: 3,
    enabled: true,
    configJson: "{\"script\":\"maskMobile\"}",
    updatedAt: now()
  },
  {
    id: 51004,
    sceneId: 5001,
    nodeType: "page_set",
    name: "写入风险评分",
    orderNo: 4,
    enabled: true,
    configJson: "{\"target\":\"risk_score\"}",
    updatedAt: now()
  },
  {
    id: 52001,
    sceneId: 5002,
    nodeType: "page_get",
    name: "读取开户证件号",
    orderNo: 1,
    enabled: true,
    configJson: "{\"field\":\"id_no\"}",
    updatedAt: now()
  },
  {
    id: 52002,
    sceneId: 5002,
    nodeType: "api_call",
    name: "查询客户基础信息",
    orderNo: 2,
    enabled: true,
    configJson: "{\"interfaceId\":3002,\"forceFail\":true}",
    updatedAt: now()
  },
  {
    id: 52003,
    sceneId: 5002,
    nodeType: "page_set",
    name: "写入开户信息",
    orderNo: 3,
    enabled: true,
    configJson: "{\"target\":\"open_account_form\"}",
    updatedAt: now()
  }
];

export const seedRules: RuleDefinition[] = [
  {
    id: 4001,
    name: "贷款高风险强提示",
    pageResourceId: 1001,
    pageResourceName: "贷款申请主页面",
    priority: 950,
    promptMode: "FLOATING",
    closeMode: "MANUAL_CLOSE",
    hasConfirmButton: true,
    sceneId: 5001,
    sceneName: "贷款申请自动查数预填",
    status: "ACTIVE",
    currentVersion: 6,
    ownerOrgId: "branch-east",
    updatedAt: now()
  },
  {
    id: 4002,
    name: "开户信息完整性提醒",
    pageResourceId: 1002,
    pageResourceName: "开户办理主页面",
    priority: 700,
    promptMode: "SILENT",
    closeMode: "AUTO_CLOSE",
    hasConfirmButton: false,
    status: "DRAFT",
    currentVersion: 1,
    ownerOrgId: "branch-south",
    updatedAt: now()
  }
];

export const seedRuleConditionGroups: RuleConditionGroup[] = [
  { id: 41001, ruleId: 4001, logicType: "AND", updatedAt: now() },
  { id: 41002, ruleId: 4001, logicType: "OR", parentGroupId: 41001, updatedAt: now() },
  { id: 42001, ruleId: 4002, logicType: "AND", updatedAt: now() }
];

export const seedRuleConditions: RuleCondition[] = [
  {
    id: 41101,
    ruleId: 4001,
    groupId: 41001,
    left: { sourceType: "INTERFACE_FIELD", key: "risk_score", preprocessorIds: [] },
    operator: "GE",
    right: { sourceType: "CONST", key: "80", constValue: "80", preprocessorIds: [] },
    updatedAt: now()
  },
  {
    id: 41102,
    ruleId: 4001,
    groupId: 41002,
    left: { sourceType: "CONTEXT", key: "user_role", preprocessorIds: [] },
    operator: "EQ",
    right: { sourceType: "CONST", key: "new_staff", constValue: "new_staff", preprocessorIds: [] },
    updatedAt: now()
  },
  {
    id: 41103,
    ruleId: 4001,
    groupId: 41002,
    left: { sourceType: "INTERFACE_FIELD", key: "risk_level", preprocessorIds: [] },
    operator: "EQ",
    right: { sourceType: "CONST", key: "HIGH", constValue: "HIGH", preprocessorIds: [] },
    updatedAt: now()
  },
  {
    id: 42101,
    ruleId: 4002,
    groupId: 42001,
    left: { sourceType: "PAGE_FIELD", key: "account_purpose", preprocessorIds: [3501] },
    operator: "EXISTS",
    updatedAt: now()
  }
];

export const seedPendingSummary: GovernancePendingSummary = {
  draftCount: 5,
  expiringSoonCount: 2,
  validationFailedCount: 1,
  conflictCount: 1,
  riskConfirmPendingCount: 2
};

export const seedPendingItems: GovernancePendingItem[] = [
  {
    id: 1,
    resourceType: "JOB_SCENE",
    resourceId: 5002,
    resourceName: "开户证件信息同步",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    pendingType: "RISK_CONFIRM",
    updatedAt: now()
  },
  {
    id: 2,
    resourceType: "RULE",
    resourceId: 4002,
    resourceName: "开户信息完整性提醒",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    pendingType: "VALIDATION_FAILED",
    updatedAt: now()
  },
  {
    id: 3,
    resourceType: "RULE",
    resourceId: 4001,
    resourceName: "贷款高风险强提示",
    status: "ACTIVE",
    ownerOrgId: "branch-east",
    pendingType: "EXPIRING_SOON",
    updatedAt: now()
  },
  {
    id: 4,
    resourceType: "PREPROCESSOR",
    resourceId: 3503,
    resourceName: "手机号脱敏脚本",
    status: "DRAFT",
    ownerOrgId: "branch-east",
    pendingType: "DRAFT",
    updatedAt: now()
  }
];

export const seedAuditLogs: GovernanceAuditLog[] = [
  {
    id: 9001,
    action: "PUBLISH",
    resourceType: "RULE",
    resourceId: 4001,
    resourceName: "贷款高风险强提示",
    operator: "李主管",
    createdAt: now()
  },
  {
    id: 9002,
    action: "RISK_CONFIRM",
    resourceType: "JOB_SCENE",
    resourceId: 5001,
    resourceName: "贷款申请自动查数预填",
    operator: "王经理",
    createdAt: now()
  },
  {
    id: 9003,
    action: "ROLE_UPDATE",
    resourceType: "ROLE",
    resourceId: 7002,
    resourceName: "业务管理角色-华东",
    operator: "业务超管",
    createdAt: now()
  }
];

export const seedTriggerLogs: TriggerLogItem[] = [
  {
    id: 10001,
    ruleName: "贷款高风险强提示",
    pageResourceName: "贷款申请主页面",
    triggerResult: "HIT",
    reason: "风险评分 >= 80",
    operator: "张三",
    createdAt: now()
  },
  {
    id: 10002,
    ruleName: "开户信息完整性提醒",
    pageResourceName: "开户办理主页面",
    triggerResult: "MISS",
    reason: "开户用途字段为空，不满足提醒条件",
    operator: "李四",
    createdAt: now()
  },
  {
    id: 10003,
    ruleName: "开户信息完整性提醒",
    pageResourceName: "开户办理主页面",
    triggerResult: "FAILED",
    reason: "接口超时：customer/profile/query",
    operator: "王五",
    createdAt: now()
  }
];

export const seedExecutionLogs: ExecutionLogItem[] = [
  {
    id: 11001,
    sceneName: "贷款申请自动查数预填",
    triggerSource: "PROMPT_CONFIRM",
    result: "SUCCESS",
    latencyMs: 940,
    reason: "全部节点执行成功",
    createdAt: now()
  },
  {
    id: 11002,
    sceneName: "开户证件信息同步",
    triggerSource: "AUTO",
    result: "FAILED",
    latencyMs: 2110,
    reason: "页面元素缺失",
    createdAt: now()
  },
  {
    id: 11003,
    sceneName: "贷款申请自动查数预填",
    triggerSource: "FLOATING_BUTTON",
    result: "PARTIAL_SUCCESS",
    latencyMs: 1530,
    reason: "2 个字段已跳过（只读）",
    createdAt: now()
  },
  {
    id: 11004,
    sceneName: "开户证件信息同步",
    triggerSource: "AUTO",
    result: "FAILED",
    latencyMs: 1788,
    reason: "接口超时",
    createdAt: now()
  }
];

export const seedJobExecutions: JobExecutionSummary[] = [
  {
    id: 61001,
    sceneId: 5001,
    sceneName: "贷款申请自动查数预填",
    triggerSource: "PROMPT_CONFIRM",
    result: "SUCCESS",
    fallbackToManual: false,
    detail: "全部节点执行成功",
    startedAt: now(),
    finishedAt: now()
  },
  {
    id: 61002,
    sceneId: 5002,
    sceneName: "开户证件信息同步",
    triggerSource: "AUTO",
    result: "FAILED",
    fallbackToManual: true,
    detail: "api_call 节点失败，已回退手工路径",
    startedAt: now(),
    finishedAt: now()
  }
];

export const seedJobNodeRunLogs: JobNodeRunLog[] = [
  {
    id: 62001,
    executionId: 61001,
    nodeId: 51001,
    nodeName: "读取客户号",
    nodeType: "page_get",
    status: "SUCCESS",
    latencyMs: 80,
    detail: "读取字段 customer_id",
    createdAt: now()
  },
  {
    id: 62002,
    executionId: 61001,
    nodeId: 51002,
    nodeName: "查询风险评分",
    nodeType: "api_call",
    status: "SUCCESS",
    latencyMs: 320,
    detail: "调用 interfaceId=3001",
    createdAt: now()
  },
  {
    id: 62003,
    executionId: 61001,
    nodeId: 51003,
    nodeName: "格式化手机号",
    nodeType: "js_script",
    status: "SUCCESS",
    latencyMs: 140,
    detail: "执行 maskMobile",
    createdAt: now()
  },
  {
    id: 62004,
    executionId: 61001,
    nodeId: 51004,
    nodeName: "写入风险评分",
    nodeType: "page_set",
    status: "SUCCESS",
    latencyMs: 110,
    detail: "写入 target=risk_score",
    createdAt: now()
  },
  {
    id: 62005,
    executionId: 61002,
    nodeId: 52001,
    nodeName: "读取开户证件号",
    nodeType: "page_get",
    status: "SUCCESS",
    latencyMs: 70,
    detail: "读取字段 id_no",
    createdAt: now()
  },
  {
    id: 62006,
    executionId: 61002,
    nodeId: 52002,
    nodeName: "查询客户基础信息",
    nodeType: "api_call",
    status: "FAILED",
    latencyMs: 580,
    detail: "接口超时",
    createdAt: now()
  },
  {
    id: 62007,
    executionId: 61002,
    nodeId: 52003,
    nodeName: "写入开户信息",
    nodeType: "page_set",
    status: "SKIPPED",
    latencyMs: 0,
    detail: "上游失败，节点跳过",
    createdAt: now()
  }
];

export const seedRoles: RoleItem[] = [
  {
    id: 7001,
    name: "业务配置角色-华东",
    roleType: "BUSINESS_CONFIG",
    status: "ACTIVE",
    orgScopeId: "branch-east",
    actions: ["VIEW", "CONFIG", "VALIDATE"],
    memberCount: 16,
    updatedAt: now()
  },
  {
    id: 7002,
    name: "业务管理角色-华东",
    roleType: "BUSINESS_MANAGER",
    status: "ACTIVE",
    orgScopeId: "branch-east",
    actions: ["VIEW", "VALIDATE", "PUBLISH", "DISABLE", "DEFER", "ROLLBACK", "AUDIT_VIEW", "RISK_CONFIRM"],
    memberCount: 8,
    updatedAt: now()
  },
  {
    id: 7003,
    name: "平台支持角色-总行",
    roleType: "PLATFORM_SUPPORT",
    status: "ACTIVE",
    orgScopeId: "head-office",
    actions: ["VIEW", "VALIDATE", "AUDIT_VIEW"],
    memberCount: 5,
    updatedAt: now()
  }
];

export const seedRoleMembers: Record<number, string[]> = {
  7001: ["赵一", "钱二", "孙三"],
  7002: ["周总", "吴主管"],
  7003: ["平台支持A"]
};

export const seedDashboardOverview: DashboardOverview = {
  pageResourceCount: seedPageResources.length,
  activeRuleCount: seedRules.filter((it) => it.status === "ACTIVE").length,
  activeSceneCount: seedJobScenes.filter((it) => it.status === "ACTIVE").length,
  activeInterfaceCount: seedInterfaces.filter((it) => it.status === "ACTIVE").length,
  roleCount: seedRoles.length,
  pendingCount: seedPendingItems.length,
  metrics: {
    executionSuccessRate: 97.8,
    avgSavedSeconds: 36.5,
    expiredResourceCount: 3,
    expiringSoonResourceCount: 7
  }
};
