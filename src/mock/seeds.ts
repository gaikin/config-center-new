import type {
  BusinessFieldDefinition,
  DashboardOverview,
  ExecutionLogItem,
  PublishAuditLog,
  PublishPendingItem,
  PublishPendingSummary,
  InterfaceDefinition,
  JobExecutionSummary,
  JobNodeDefinition,
  JobNodeRunLog,
  JobSceneDefinition,
  ListDataDefinition,
  MenuSdkPolicy,
  MenuCapabilityPolicy,
  MenuCapabilityRequest,
  PageElement,
  PageFieldBinding,
  PageMenu,
  PageRegion,
  PageResource,
  PageSite,
  PageActivationPolicy,
  PreprocessorDefinition,
  PermissionResource,
  RoleItem,
  RoleResourceGrant,
  RuleCondition,
  RuleConditionGroup,
  RuleDefinition,
  PlatformRuntimeConfig,
  SdkArtifactVersion,
  TriggerLogItem,
  UserRoleBinding
} from "../types";

const now = () => new Date().toISOString();

export const seedPageSites: PageSite[] = [
  { id: 1, code: "kaiyang", name: "开阳核心业务系统", status: "ACTIVE" },
  { id: 2, code: "counter", name: "柜面统一办理系统", status: "ACTIVE" }
];

export const seedPageRegions: PageRegion[] = [
  { id: 11, siteId: 1, regionCode: "loan_region", regionName: "贷款专区", status: "ACTIVE" },
  { id: 21, siteId: 2, regionCode: "corp_region", regionName: "对公专区", status: "ACTIVE" }
];

export const seedPageMenus: PageMenu[] = [
  {
    id: 101,
    siteId: 1,
    regionId: 11,
    menuName: "贷款申请",
    menuCode: "loan_apply",
    status: "ACTIVE",
    ownerOrgId: "branch-east"
  },
  {
    id: 102,
    siteId: 1,
    regionId: 11,
    menuName: "贷款审核",
    menuCode: "loan_review",
    status: "ACTIVE",
    ownerOrgId: "branch-east"
  },
  {
    id: 201,
    siteId: 2,
    regionId: 21,
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
    pageCode: "loan_apply_main",
    frameCode: "main-frame",
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
    menuId: 101,
    pageCode: "loan_apply_collateral",
    frameCode: "collateral-iframe",
    name: "贷款申请抵押信息页",
    status: "ACTIVE",
    ownerOrgId: "branch-east",
    currentVersion: 3,
    elementCount: 12,
    detectRulesSummary: "pageCode + iframe 标记优先",
    updatedAt: now()
  },
  {
    id: 1003,
    menuId: 201,
    pageCode: "open_account_main",
    frameCode: "main-frame",
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
    logicName: "客户号",
    selector: "//*[@id='customer-id']",
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
    id: 12004,
    pageResourceId: 1001,
    logicName: "客户手机号",
    selector: "#mobile",
    selectorType: "CSS",
    required: false,
    updatedAt: now()
  },
  {
    id: 12005,
    pageResourceId: 1002,
    logicName: "抵押物类型",
    selector: "//*[@id='collateral-type']",
    selectorType: "XPATH",
    required: false,
    updatedAt: now()
  },
  {
    id: 12003,
    pageResourceId: 1003,
    logicName: "开户用途",
    selector: "//*[@name='purpose']",
    selectorType: "XPATH",
    required: false,
    updatedAt: now()
  }
];

export const seedBusinessFields: BusinessFieldDefinition[] = [
  {
    id: 13001,
    code: "customer_id",
    name: "客户号",
    scope: "GLOBAL",
    valueType: "STRING",
    required: true,
    description: "跨菜单公共字段，用于客户唯一标识。",
    ownerOrgId: "head-office",
    status: "ACTIVE",
    currentVersion: 3,
    aliases: ["cust_id", "client_id"],
    updatedAt: now()
  },
  {
    id: 13002,
    code: "id_no",
    name: "证件号",
    scope: "GLOBAL",
    valueType: "STRING",
    required: true,
    description: "跨页面公共字段，用于接口入参与规则条件复用。",
    ownerOrgId: "head-office",
    status: "ACTIVE",
    currentVersion: 2,
    aliases: ["certificate_no"],
    updatedAt: now()
  },
  {
    id: 13003,
    code: "mobile",
    name: "手机号",
    scope: "GLOBAL",
    valueType: "STRING",
    required: false,
    description: "客户联系方式公共字段。",
    ownerOrgId: "head-office",
    status: "ACTIVE",
    currentVersion: 2,
    aliases: ["mobile_phone"],
    updatedAt: now()
  },
  {
    id: 13004,
    code: "collateral_type",
    name: "抵押物类型",
    scope: "PAGE_RESOURCE",
    pageResourceId: 1002,
    valueType: "STRING",
    required: false,
    description: "贷款申请抵押页特有字段。",
    ownerOrgId: "branch-east",
    status: "ACTIVE",
    currentVersion: 1,
    aliases: [],
    updatedAt: now()
  },
  {
    id: 13005,
    code: "account_purpose",
    name: "开户用途",
    scope: "PAGE_RESOURCE",
    pageResourceId: 1003,
    valueType: "STRING",
    required: false,
    description: "开户页面特有字段。",
    ownerOrgId: "branch-south",
    status: "ACTIVE",
    currentVersion: 1,
    aliases: [],
    updatedAt: now()
  }
];

export const seedPageFieldBindings: PageFieldBinding[] = [
  {
    id: 14001,
    pageResourceId: 1001,
    businessFieldCode: "customer_id",
    pageElementId: 12001,
    required: true,
    updatedAt: now()
  },
  {
    id: 14002,
    pageResourceId: 1001,
    businessFieldCode: "id_no",
    pageElementId: 12002,
    required: true,
    updatedAt: now()
  },
  {
    id: 14003,
    pageResourceId: 1001,
    businessFieldCode: "mobile",
    pageElementId: 12004,
    required: false,
    updatedAt: now()
  },
  {
    id: 14004,
    pageResourceId: 1002,
    businessFieldCode: "collateral_type",
    pageElementId: 12005,
    required: false,
    updatedAt: now()
  },
  {
    id: 14005,
    pageResourceId: 1003,
    businessFieldCode: "account_purpose",
    pageElementId: 12003,
    required: false,
    updatedAt: now()
  }
];

export const seedSdkArtifactVersions: SdkArtifactVersion[] = [
  {
    id: 8001,
    sdkVersion: "1.3.0",
    sdkMajorVersion: 1,
    loaderVersion: "1.0.2",
    artifactManifestUrl: "/manifest/kaiyang/prod/1.3.0.json",
    compatibility: "loader>=1.0.0, core/prompt/job/preview 分包兼容",
    status: "ACTIVE",
    publishedBy: "平台支持A",
    publishedAt: now(),
    notes: "智能提示正式版本。"
  },
  {
    id: 8002,
    sdkVersion: "1.4.0-rc.2",
    sdkMajorVersion: 1,
    loaderVersion: "1.0.2",
    artifactManifestUrl: "/manifest/kaiyang/prod/1.4.0-rc.2.json",
    compatibility: "新增 sdk-release-index 与菜单级灰度支持",
    status: "DRAFT",
    publishedBy: "平台支持A",
    publishedAt: now(),
    notes: "智能提示灰度候选版本。"
  },
  {
    id: 8003,
    sdkVersion: "2.1.0",
    sdkMajorVersion: 2,
    loaderVersion: "1.0.2",
    artifactManifestUrl: "/manifest/kaiyang/prod/2.1.0.json",
    compatibility: "job-runtime 稳定版本",
    status: "ACTIVE",
    publishedBy: "平台支持B",
    publishedAt: now(),
    notes: "智能作业正式版本。"
  },
  {
    id: 8004,
    sdkVersion: "2.2.0-rc.1",
    sdkMajorVersion: 2,
    loaderVersion: "1.0.2",
    artifactManifestUrl: "/manifest/kaiyang/prod/2.2.0-rc.1.json",
    compatibility: "作业回填链路灰度增强",
    status: "DRAFT",
    publishedBy: "平台支持B",
    publishedAt: now(),
    notes: "智能作业灰度候选版本。"
  }
];

export const seedPlatformRuntimeConfig: PlatformRuntimeConfig = {
  promptStableVersion: "1.3.0",
  promptGrayDefaultVersion: "1.4.0-rc.2",
  jobStableVersion: "2.1.0",
  jobGrayDefaultVersion: "2.2.0-rc.1",
  updatedAt: now(),
  updatedBy: "person-platform-admin"
};

export const seedMenuSdkPolicies: MenuSdkPolicy[] = [
  {
    id: 8201,
    siteId: 1,
    regionId: 11,
    menuId: 101,
    menuCode: "loan_apply",
    promptGrayEnabled: true,
    promptGrayVersion: "1.4.0-rc.2",
    promptGrayOrgIds: ["branch-east", "branch-east-sub1"],
    jobGrayEnabled: false,
    jobGrayVersion: undefined,
    jobGrayOrgIds: [],
    effectiveStart: "2026-03-14 09:00",
    effectiveEnd: "2026-03-31 23:59",
    status: "DRAFT",
    ownerOrgId: "head-office",
    updatedAt: now()
  },
  {
    id: 8202,
    siteId: 2,
    regionId: 21,
    menuId: 201,
    menuCode: "open_account",
    promptGrayEnabled: false,
    promptGrayVersion: undefined,
    promptGrayOrgIds: [],
    jobGrayEnabled: true,
    jobGrayVersion: "2.2.0-rc.1",
    jobGrayOrgIds: ["branch-south"],
    effectiveStart: "2026-03-14 09:00",
    effectiveEnd: "2026-12-31 23:59",
    status: "ACTIVE",
    ownerOrgId: "head-office",
    updatedAt: now()
  }
];

export const seedMenuCapabilityPolicies: MenuCapabilityPolicy[] = [
  {
    id: 8401,
    menuId: 101,
    promptStatus: "ENABLED",
    jobStatus: "ENABLED",
    status: "ACTIVE",
    updatedAt: now(),
    updatedBy: "person-platform-admin"
  },
  {
    id: 8402,
    menuId: 102,
    promptStatus: "DISABLED",
    jobStatus: "DISABLED",
    status: "DRAFT",
    updatedAt: now(),
    updatedBy: "person-platform-admin"
  },
  {
    id: 8403,
    menuId: 201,
    promptStatus: "PENDING",
    jobStatus: "ENABLED",
    status: "DRAFT",
    updatedAt: now(),
    updatedBy: "person-platform-admin"
  }
];

export const seedMenuCapabilityRequests: MenuCapabilityRequest[] = [
  {
    id: 8501,
    menuId: 201,
    capabilityType: "PROMPT",
    reason: "开户办理场景需要补充提示开通，减少漏填。",
    status: "PENDING",
    applicant: "person-business-manager-south",
    createdAt: now()
  }
];

export const seedPageActivationPolicies: PageActivationPolicy[] = [
  {
    id: 8301,
    pageResourceId: 1001,
    enabled: true,
    promptRuleSetName: "贷款申请提示规则集",
    hasJobScenes: true,
    jobPreloadPolicy: "idle",
    jobSceneName: "贷款申请自动查数预填",
    status: "ACTIVE",
    ownerOrgId: "branch-east",
    updatedAt: now()
  },
  {
    id: 8302,
    pageResourceId: 1002,
    enabled: false,
    promptRuleSetName: "贷款申请抵押信息补录",
    hasJobScenes: false,
    jobPreloadPolicy: "none",
    status: "DRAFT",
    ownerOrgId: "branch-east",
    updatedAt: now()
  },
  {
    id: 8303,
    pageResourceId: 1003,
    enabled: true,
    promptRuleSetName: "开户办理完整性规则集",
    hasJobScenes: true,
    jobPreloadPolicy: "intent",
    jobSceneName: "开户证件信息同步",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    updatedAt: now()
  }
];

export const seedInterfaces: InterfaceDefinition[] = [
  {
    id: 3001,
    name: "客户风险评分查询",
    description: "查询客户风险评分并返回风险等级信息。",
    method: "POST",
    testPath: "/test/risk/score/query",
    prodPath: "/risk/score/query",
    url: "/risk/score/query",
    status: "ACTIVE",
    ownerOrgId: "branch-east",
    currentVersion: 3,
    timeoutMs: 3000,
    retryTimes: 1,
    bodyTemplateJson: "{\"customerId\":\"{{customer_id}}\"}",
    inputConfigJson:
      "{\"headers\":[],\"query\":[],\"path\":[],\"body\":[{\"id\":\"body-1\",\"name\":\"customerId\",\"description\":\"客户号\",\"valueType\":\"STRING\",\"validationConfig\":{\"required\":true,\"regexMode\":\"NONE\"}}]}",
    outputConfigJson:
      "[{\"id\":\"out-1\",\"name\":\"score\",\"path\":\"$.data.score\",\"description\":\"风险评分\",\"valueType\":\"NUMBER\"},{\"id\":\"out-2\",\"name\":\"riskLevel\",\"path\":\"$.data.riskLevel\",\"description\":\"风险等级\",\"valueType\":\"STRING\"}]",
    paramSourceSummary: "客户号来自页面元素 customer_id",
    responsePath: "$.data.score",
    maskSensitive: true,
    updatedAt: now()
  },
  {
    id: 3002,
    name: "客户基础信息查询",
    description: "查询客户基础资料，支持开户场景补全信息。",
    method: "POST",
    testPath: "/test/customer/profile/query",
    prodPath: "/customer/profile/query",
    url: "/customer/profile/query",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    currentVersion: 1,
    timeoutMs: 3000,
    retryTimes: 0,
    bodyTemplateJson: "{\"idNo\":\"{{id_no}}\"}",
    inputConfigJson:
      "{\"headers\":[],\"query\":[],\"path\":[],\"body\":[{\"id\":\"body-2\",\"name\":\"idNo\",\"description\":\"证件号\",\"valueType\":\"STRING\",\"validationConfig\":{\"required\":true,\"regexMode\":\"NONE\"}}]}",
    outputConfigJson:
      "[{\"id\":\"out-3\",\"name\":\"profile\",\"path\":\"$.data.profile\",\"description\":\"客户档案\",\"valueType\":\"OBJECT\",\"children\":[{\"id\":\"out-3-1\",\"name\":\"name\",\"path\":\"$.data.profile.name\",\"description\":\"姓名\",\"valueType\":\"STRING\"},{\"id\":\"out-3-2\",\"name\":\"mobile\",\"path\":\"$.data.profile.mobile\",\"description\":\"手机号\",\"valueType\":\"STRING\"}]}]",
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
    previewBeforeExecute: true,
    floatingButtonEnabled: true,
    floatingButtonLabel: "重新执行",
    floatingButtonX: 86,
    floatingButtonY: 78,
    status: "ACTIVE",
    currentVersion: 4,
    nodeCount: 5,
    manualDurationSec: 55,
    riskConfirmed: true,
    updatedAt: now()
  },
  {
    id: 5002,
    name: "开户证件信息同步",
    pageResourceId: 1003,
    pageResourceName: "开户办理主页面",
    executionMode: "AUTO_AFTER_PROMPT",
    previewBeforeExecute: false,
    floatingButtonEnabled: false,
    floatingButtonLabel: "重试回填",
    floatingButtonX: 84,
    floatingButtonY: 76,
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
    nodeType: "list_lookup",
    name: "查询高风险名单",
    orderNo: 2,
    enabled: true,
    configJson: "{\"listDataId\":6001,\"inputSource\":\"customer_id\",\"resultKey\":\"high_risk_match\"}",
    updatedAt: now()
  },
  {
    id: 51003,
    sceneId: 5001,
    nodeType: "api_call",
    name: "查询风险评分",
    orderNo: 3,
    enabled: true,
    configJson: "{\"interfaceId\":3001}",
    updatedAt: now()
  },
  {
    id: 51004,
    sceneId: 5001,
    nodeType: "js_script",
    name: "格式化手机号",
    orderNo: 4,
    enabled: true,
    configJson: "{\"script\":\"maskMobile\"}",
    updatedAt: now()
  },
  {
    id: 51005,
    sceneId: 5001,
    nodeType: "page_set",
    name: "写入风险评分",
    orderNo: 5,
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
    ruleScope: "SHARED",
    ruleSetCode: "loan_high_risk_prompt",
    priority: 950,
    promptMode: "FLOATING",
    closeMode: "MANUAL_CLOSE",
    promptContentConfigJson:
      "{\"version\":1,\"titleSuffix\":\"贷款高风险客户\",\"bodyTemplate\":\"检测到客户 {{customer_id}} 风险等级为 {{riskLevel}}，请核对证件信息并确认是否继续办理。\"}",
    hasConfirmButton: true,
    sceneId: 5001,
    sceneName: "贷款申请自动查数预填",
    effectiveStartAt: "2026-03-01 00:00",
    effectiveEndAt: "2026-12-31 23:59",
    status: "ACTIVE",
    currentVersion: 6,
    ownerOrgId: "branch-east",
    updatedAt: now()
  },
  {
    id: 4002,
    name: "开户信息完整性提醒",
    ruleScope: "PAGE_RESOURCE",
    ruleSetCode: "open_account_integrity_prompt",
    pageResourceId: 1003,
    pageResourceName: "开户办理主页面",
    priority: 700,
    promptMode: "SILENT",
    closeMode: "AUTO_CLOSE",
    promptContentConfigJson:
      "{\"version\":1,\"titleSuffix\":\"开户资料补录\",\"bodyTemplate\":\"检测到开户用途缺失，请补充客户开户地址及用途说明后再继续提交。\"}",
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
    left: {
      sourceType: "LIST_LOOKUP_FIELD",
      key: "risk_level",
      displayValue: "高风险客户名单.risk_level",
      valueType: "STRING",
      preprocessorIds: [],
      listBinding: {
        listDataId: 6001,
        listDataName: "高风险客户名单",
        matchColumn: "customer_id",
        lookupSourceType: "PAGE_FIELD",
        lookupSourceValue: "customer_id",
        matchers: [
          { matchColumn: "customer_id", sourceType: "PAGE_FIELD", sourceValue: "customer_id" },
          { matchColumn: "id_no", sourceType: "PAGE_FIELD", sourceValue: "id_no" }
        ],
        resultField: "risk_level"
      }
    },
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

export const seedPendingSummary: PublishPendingSummary = {
  draftCount: 6,
  expiringSoonCount: 1,
  validationFailedCount: 1,
  conflictCount: 0,
  riskConfirmPendingCount: 0
};

export const seedPendingItems: PublishPendingItem[] = [
  {
    id: 1,
    resourceType: "JOB_SCENE",
    resourceId: 5002,
    resourceName: "开户证件信息同步",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    pendingType: "DRAFT",
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
    resourceType: "INTERFACE",
    resourceId: 3002,
    resourceName: "客户基础信息查询 API",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    pendingType: "DRAFT",
    updatedAt: now()
  },
  {
    id: 5,
    resourceType: "LIST_DATA",
    resourceId: 6002,
    resourceName: "身份证白名单",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    pendingType: "DRAFT",
    updatedAt: now()
  },
  {
    id: 6,
    resourceType: "PREPROCESSOR",
    resourceId: 3503,
    resourceName: "手机号脱敏脚本",
    status: "DRAFT",
    ownerOrgId: "branch-east",
    pendingType: "DRAFT",
    updatedAt: now()
  },
  {
    id: 7,
    resourceType: "MENU_SDK_POLICY",
    resourceId: 8201,
    resourceName: "贷款申请菜单 SDK 灰度策略",
    status: "DRAFT",
    ownerOrgId: "head-office",
    pendingType: "DRAFT",
    updatedAt: now()
  },
  {
    id: 8,
    resourceType: "PAGE_ACTIVATION_POLICY",
    resourceId: 8303,
    resourceName: "开户办理主页面启用策略",
    status: "DRAFT",
    ownerOrgId: "branch-south",
    pendingType: "DRAFT",
    updatedAt: now()
  }
];

export const seedListDatas: ListDataDefinition[] = [
  {
    id: 6001,
    name: "高风险客户名单",
    description: "用于贷款申请高风险命中判断。",
    ownerOrgId: "branch-east",
    scope: "贷款专区 / 东部分行",
    effectiveStartAt: "2026-03-01",
    effectiveEndAt: "2026-12-31",
    status: "ACTIVE",
    currentVersion: 3,
    rowCount: 1280,
    importColumns: ["customer_id", "id_no", "mobile", "risk_level", "risk_score", "risk_tag", "expire_at"],
    outputFields: ["risk_level", "risk_score", "risk_tag", "expire_at"],
    importFileName: "high-risk-customers-v3.xlsx",
    indexBuildStatus: "READY",
    activeAlias: "cc_list_data_6001_active",
    updatedAt: now()
  },
  {
    id: 6002,
    name: "身份证白名单",
    description: "用于开户场景白名单核验。",
    ownerOrgId: "branch-south",
    scope: "对公专区 / 南部分行",
    effectiveStartAt: "2026-03-10",
    effectiveEndAt: "2026-09-30",
    status: "DRAFT",
    currentVersion: 1,
    rowCount: 320,
    importColumns: ["id_no", "customer_id", "whitelist_flag", "effective_date", "remark"],
    outputFields: ["whitelist_flag", "effective_date", "remark"],
    importFileName: "id-whitelist.xlsx",
    indexBuildStatus: "PENDING",
    activeAlias: "cc_list_data_6002_active",
    updatedAt: now()
  },
  {
    id: 6003,
    name: "存量授信观察名单",
    description: "用于授信客户存量观察和风险跟踪。",
    ownerOrgId: "head-office",
    scope: "贷款专区 / 全机构",
    effectiveStartAt: "2026-03-05",
    effectiveEndAt: "2026-08-31",
    status: "ACTIVE",
    currentVersion: 2,
    rowCount: 860,
    importColumns: ["customer_id", "mobile", "control_level", "risk_reason", "owner_team"],
    outputFields: ["control_level", "risk_reason", "owner_team"],
    importFileName: "credit-watch-list-v2.xlsx",
    indexBuildStatus: "READY",
    activeAlias: "cc_list_data_6003_active",
    updatedAt: now()
  }
];

export const seedAuditLogs: PublishAuditLog[] = [
  {
    id: 9001,
    action: "PUBLISH",
    resourceType: "RULE",
    resourceId: 4001,
    resourceName: "贷款高风险强提示",
    operator: "person-li-manager",
    createdAt: now()
  },
  {
    id: 9002,
    action: "RISK_CONFIRM",
    resourceType: "JOB_SCENE",
    resourceId: 5001,
    resourceName: "贷款申请自动查数预填",
    operator: "person-wang-manager",
    createdAt: now()
  },
  {
    id: 9003,
    action: "ROLE_UPDATE",
    resourceType: "ROLE",
    resourceId: 7002,
    resourceName: "业务管理角色-华东",
    operator: "person-business-super-admin",
    createdAt: now()
  },
  {
    id: 9004,
    action: "VALIDATE",
    resourceType: "MENU_SDK_POLICY",
    resourceId: 8201,
    resourceName: "贷款申请菜单 SDK 灰度策略",
    operator: "person-business-manager-east",
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
    operator: "person-zhang-san",
    createdAt: now()
  },
  {
    id: 10002,
    ruleName: "开户信息完整性提醒",
    pageResourceName: "开户办理主页面",
    triggerResult: "MISS",
    reason: "开户用途字段为空，不满足提醒条件",
    operator: "person-li-si",
    createdAt: now()
  },
  {
    id: 10003,
    ruleName: "开户信息完整性提醒",
    pageResourceName: "开户办理主页面",
    triggerResult: "FAILED",
    reason: "接口超时：customer/profile/query",
    operator: "person-wang-wu",
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
    name: "配置人员-华东",
    roleType: "CONFIG_OPERATOR",
    status: "ACTIVE",
    orgScopeId: "branch-east",
    memberCount: 16,
    updatedAt: now()
  },
  {
    id: 7002,
    name: "权限管理人员-华东",
    roleType: "PERMISSION_ADMIN",
    status: "ACTIVE",
    orgScopeId: "branch-east",
    memberCount: 8,
    updatedAt: now()
  },
  {
    id: 7003,
    name: "权限管理人员-总行",
    roleType: "PERMISSION_ADMIN",
    status: "ACTIVE",
    orgScopeId: "head-office",
    memberCount: 5,
    updatedAt: now()
  },
  {
    id: 7004,
    name: "技术支持人员-总行",
    roleType: "TECH_SUPPORT",
    status: "ACTIVE",
    orgScopeId: "head-office",
    memberCount: 4,
    updatedAt: now()
  },
  {
    id: 7005,
    name: "配置人员-总行",
    roleType: "CONFIG_OPERATOR",
    status: "ACTIVE",
    orgScopeId: "head-office",
    memberCount: 3,
    updatedAt: now()
  }
];

export const seedPermissionResources: PermissionResource[] = [
  {
    id: 91001,
    resourceCode: "menu_dashboard",
    resourceName: "工作台菜单",
    resourceType: "MENU",
    resourcePath: "/menu/dashboard",
    status: "ACTIVE",
    orderNo: 10,
    description: "导航入口：我的工作台",
    updatedAt: now()
  },
  {
    id: 91002,
    resourceCode: "menu_page_management",
    resourceName: "菜单管理菜单",
    resourceType: "MENU",
    resourcePath: "/menu/page-management",
    status: "ACTIVE",
    orderNo: 20,
    description: "导航入口：菜单管理",
    updatedAt: now()
  },
  {
    id: 91003,
    resourceCode: "menu_prompts",
    resourceName: "智能提示菜单",
    resourceType: "MENU",
    resourcePath: "/menu/prompts",
    status: "ACTIVE",
    orderNo: 30,
    description: "导航入口：智能提示",
    updatedAt: now()
  },
  {
    id: 91004,
    resourceCode: "menu_jobs",
    resourceName: "智能作业菜单",
    resourceType: "MENU",
    resourcePath: "/menu/jobs",
    status: "ACTIVE",
    orderNo: 40,
    description: "导航入口：智能作业",
    updatedAt: now()
  },
  {
    id: 91005,
    resourceCode: "menu_interfaces",
    resourceName: "API注册菜单",
    resourceType: "MENU",
    resourcePath: "/menu/interfaces",
    status: "ACTIVE",
    orderNo: 50,
    description: "导航入口：API注册",
    updatedAt: now()
  },
  {
    id: 91006,
    resourceCode: "menu_stats",
    resourceName: "运行统计菜单",
    resourceType: "MENU",
    resourcePath: "/menu/stats",
    status: "ACTIVE",
    orderNo: 60,
    description: "导航入口：运行统计",
    updatedAt: now()
  },
  {
    id: 91007,
    resourceCode: "menu_advanced",
    resourceName: "高级配置菜单",
    resourceType: "MENU",
    resourcePath: "/menu/advanced",
    status: "ACTIVE",
    orderNo: 70,
    description: "导航入口：高级配置",
    updatedAt: now()
  },
  {
    id: 91101,
    resourceCode: "page_dashboard_list",
    resourceName: "工作台页面",
    resourceType: "PAGE",
    resourcePath: "/page/dashboard/list",
    pagePath: "/",
    status: "ACTIVE",
    orderNo: 110,
    description: "页面访问：我的工作台",
    updatedAt: now()
  },
  {
    id: 91102,
    resourceCode: "page_page_management_list",
    resourceName: "菜单管理页面",
    resourceType: "PAGE",
    resourcePath: "/page/page-management/list",
    pagePath: "/page-management",
    status: "ACTIVE",
    orderNo: 120,
    description: "页面访问：菜单管理",
    updatedAt: now()
  },
  {
    id: 91103,
    resourceCode: "page_prompts_list",
    resourceName: "智能提示页面",
    resourceType: "PAGE",
    resourcePath: "/page/prompts/list",
    pagePath: "/prompts",
    status: "ACTIVE",
    orderNo: 130,
    description: "页面访问：智能提示",
    updatedAt: now()
  },
  {
    id: 91104,
    resourceCode: "page_jobs_list",
    resourceName: "智能作业页面",
    resourceType: "PAGE",
    resourcePath: "/page/jobs/list",
    pagePath: "/jobs",
    status: "ACTIVE",
    orderNo: 140,
    description: "页面访问：智能作业",
    updatedAt: now()
  },
  {
    id: 91105,
    resourceCode: "page_interfaces_list",
    resourceName: "API注册页面",
    resourceType: "PAGE",
    resourcePath: "/page/interfaces/list",
    pagePath: "/interfaces",
    status: "ACTIVE",
    orderNo: 150,
    description: "页面访问：API注册",
    updatedAt: now()
  },
  {
    id: 91106,
    resourceCode: "page_stats_list",
    resourceName: "运行统计页面",
    resourceType: "PAGE",
    resourcePath: "/page/stats/list",
    pagePath: "/stats",
    status: "ACTIVE",
    orderNo: 160,
    description: "页面访问：运行统计",
    updatedAt: now()
  },
  {
    id: 91107,
    resourceCode: "page_advanced_list",
    resourceName: "高级配置页面",
    resourceType: "PAGE",
    resourcePath: "/page/advanced/list",
    pagePath: "/advanced",
    status: "ACTIVE",
    orderNo: 170,
    description: "页面访问：高级配置",
    updatedAt: now()
  },
  {
    id: 91201,
    resourceCode: "action_common_view",
    resourceName: "查看能力",
    resourceType: "ACTION",
    resourcePath: "/action/common/base/view",
    status: "ACTIVE",
    orderNo: 210,
    description: "基础查看权限",
    updatedAt: now()
  },
  {
    id: 91202,
    resourceCode: "action_common_config",
    resourceName: "配置能力",
    resourceType: "ACTION",
    resourcePath: "/action/common/base/config",
    status: "ACTIVE",
    orderNo: 220,
    description: "配置与编辑相关能力",
    updatedAt: now()
  },
  {
    id: 91203,
    resourceCode: "action_common_validate",
    resourceName: "校验能力",
    resourceType: "ACTION",
    resourcePath: "/action/common/base/validate",
    status: "ACTIVE",
    orderNo: 230,
    description: "校验和验证能力",
    updatedAt: now()
  },
  {
    id: 91204,
    resourceCode: "action_common_publish",
    resourceName: "发布能力",
    resourceType: "ACTION",
    resourcePath: "/action/common/base/publish",
    status: "ACTIVE",
    orderNo: 240,
    description: "发布能力",
    updatedAt: now()
  },
  {
    id: 91205,
    resourceCode: "action_common_audit_view",
    resourceName: "审计查看能力",
    resourceType: "ACTION",
    resourcePath: "/action/common/base/audit-view",
    status: "ACTIVE",
    orderNo: 250,
    description: "审计查看能力",
    updatedAt: now()
  },
  {
    id: 91206,
    resourceCode: "action_roles_manage",
    resourceName: "角色授权管理",
    resourceType: "ACTION",
    resourcePath: "/action/roles/list/manage",
    status: "ACTIVE",
    orderNo: 260,
    description: "角色管理与授权能力",
    updatedAt: now()
  },
  {
    id: 91207,
    resourceCode: "action_menu_capability_manage",
    resourceName: "菜单启用管理",
    resourceType: "ACTION",
    resourcePath: "/action/page-management/capability/manage",
    status: "ACTIVE",
    orderNo: 270,
    description: "菜单启用/停用等高权限操作",
    updatedAt: now()
  }
];

export const seedRoleResourceGrants: RoleResourceGrant[] = [
  { id: 92001, roleId: 7001, resourceCode: "menu_dashboard", createdAt: now() },
  { id: 92002, roleId: 7001, resourceCode: "menu_page_management", createdAt: now() },
  { id: 92003, roleId: 7001, resourceCode: "menu_prompts", createdAt: now() },
  { id: 92004, roleId: 7001, resourceCode: "menu_jobs", createdAt: now() },
  { id: 92005, roleId: 7001, resourceCode: "menu_interfaces", createdAt: now() },
  { id: 92006, roleId: 7001, resourceCode: "menu_stats", createdAt: now() },
  { id: 92007, roleId: 7001, resourceCode: "menu_advanced", createdAt: now() },
  { id: 92008, roleId: 7001, resourceCode: "page_dashboard_list", createdAt: now() },
  { id: 92009, roleId: 7001, resourceCode: "page_page_management_list", createdAt: now() },
  { id: 92010, roleId: 7001, resourceCode: "page_prompts_list", createdAt: now() },
  { id: 92011, roleId: 7001, resourceCode: "page_jobs_list", createdAt: now() },
  { id: 92012, roleId: 7001, resourceCode: "page_interfaces_list", createdAt: now() },
  { id: 92013, roleId: 7001, resourceCode: "page_stats_list", createdAt: now() },
  { id: 92014, roleId: 7001, resourceCode: "page_advanced_list", createdAt: now() },
  { id: 92015, roleId: 7001, resourceCode: "action_common_view", createdAt: now() },
  { id: 92016, roleId: 7001, resourceCode: "action_common_config", createdAt: now() },
  { id: 92017, roleId: 7001, resourceCode: "action_common_validate", createdAt: now() },
  { id: 92018, roleId: 7001, resourceCode: "action_common_publish", createdAt: now() },

  { id: 92101, roleId: 7002, resourceCode: "menu_dashboard", createdAt: now() },
  { id: 92102, roleId: 7002, resourceCode: "menu_stats", createdAt: now() },
  { id: 92103, roleId: 7002, resourceCode: "menu_advanced", createdAt: now() },
  { id: 92104, roleId: 7002, resourceCode: "page_dashboard_list", createdAt: now() },
  { id: 92105, roleId: 7002, resourceCode: "page_stats_list", createdAt: now() },
  { id: 92106, roleId: 7002, resourceCode: "page_advanced_list", createdAt: now() },
  { id: 92107, roleId: 7002, resourceCode: "action_common_view", createdAt: now() },
  { id: 92108, roleId: 7002, resourceCode: "action_roles_manage", createdAt: now() },

  { id: 92201, roleId: 7003, resourceCode: "menu_dashboard", createdAt: now() },
  { id: 92202, roleId: 7003, resourceCode: "menu_stats", createdAt: now() },
  { id: 92203, roleId: 7003, resourceCode: "menu_advanced", createdAt: now() },
  { id: 92204, roleId: 7003, resourceCode: "page_dashboard_list", createdAt: now() },
  { id: 92205, roleId: 7003, resourceCode: "page_stats_list", createdAt: now() },
  { id: 92206, roleId: 7003, resourceCode: "page_advanced_list", createdAt: now() },
  { id: 92207, roleId: 7003, resourceCode: "action_common_view", createdAt: now() },
  { id: 92208, roleId: 7003, resourceCode: "action_roles_manage", createdAt: now() },
  { id: 92209, roleId: 7003, resourceCode: "action_menu_capability_manage", createdAt: now() },

  { id: 92301, roleId: 7004, resourceCode: "menu_dashboard", createdAt: now() },
  { id: 92302, roleId: 7004, resourceCode: "menu_stats", createdAt: now() },
  { id: 92303, roleId: 7004, resourceCode: "page_dashboard_list", createdAt: now() },
  { id: 92304, roleId: 7004, resourceCode: "page_stats_list", createdAt: now() },
  { id: 92305, roleId: 7004, resourceCode: "action_common_view", createdAt: now() },
  { id: 92306, roleId: 7004, resourceCode: "action_common_validate", createdAt: now() },
  { id: 92307, roleId: 7004, resourceCode: "action_common_audit_view", createdAt: now() },

  { id: 92401, roleId: 7005, resourceCode: "menu_dashboard", createdAt: now() },
  { id: 92402, roleId: 7005, resourceCode: "menu_page_management", createdAt: now() },
  { id: 92403, roleId: 7005, resourceCode: "menu_prompts", createdAt: now() },
  { id: 92404, roleId: 7005, resourceCode: "menu_jobs", createdAt: now() },
  { id: 92405, roleId: 7005, resourceCode: "menu_interfaces", createdAt: now() },
  { id: 92406, roleId: 7005, resourceCode: "menu_stats", createdAt: now() },
  { id: 92407, roleId: 7005, resourceCode: "menu_advanced", createdAt: now() },
  { id: 92408, roleId: 7005, resourceCode: "page_dashboard_list", createdAt: now() },
  { id: 92409, roleId: 7005, resourceCode: "page_page_management_list", createdAt: now() },
  { id: 92410, roleId: 7005, resourceCode: "page_prompts_list", createdAt: now() },
  { id: 92411, roleId: 7005, resourceCode: "page_jobs_list", createdAt: now() },
  { id: 92412, roleId: 7005, resourceCode: "page_interfaces_list", createdAt: now() },
  { id: 92413, roleId: 7005, resourceCode: "page_stats_list", createdAt: now() },
  { id: 92414, roleId: 7005, resourceCode: "page_advanced_list", createdAt: now() },
  { id: 92415, roleId: 7005, resourceCode: "action_common_view", createdAt: now() },
  { id: 92416, roleId: 7005, resourceCode: "action_common_config", createdAt: now() },
  { id: 92417, roleId: 7005, resourceCode: "action_common_validate", createdAt: now() },
  { id: 92418, roleId: 7005, resourceCode: "action_common_publish", createdAt: now() },
  { id: 92419, roleId: 7005, resourceCode: "action_menu_capability_manage", createdAt: now() }
];

export const seedUserRoleBindings: UserRoleBinding[] = [
  { id: 93001, userId: "person-zhao-yi", roleId: 7001, status: "ACTIVE", createdAt: now() },
  { id: 93002, userId: "person-qian-er", roleId: 7001, status: "ACTIVE", createdAt: now() },
  { id: 93003, userId: "person-sun-san", roleId: 7001, status: "ACTIVE", createdAt: now() },
  { id: 93004, userId: "person-zhou-zong", roleId: 7002, status: "ACTIVE", createdAt: now() },
  { id: 93005, userId: "person-wu-zhuguan", roleId: 7002, status: "ACTIVE", createdAt: now() },
  { id: 93006, userId: "person-head-admin-a", roleId: 7003, status: "ACTIVE", createdAt: now() },
  { id: 93007, userId: "person-head-admin-b", roleId: 7003, status: "ACTIVE", createdAt: now() },
  { id: 93008, userId: "person-platform-support-a", roleId: 7004, status: "ACTIVE", createdAt: now() },
  { id: 93009, userId: "person-head-config-a", roleId: 7005, status: "ACTIVE", createdAt: now() },
  { id: 93010, userId: "person-head-config-b", roleId: 7005, status: "ACTIVE", createdAt: now() }
];

export const seedRoleMembers: Record<number, string[]> = {
  7001: ["person-zhao-yi", "person-qian-er", "person-sun-san"],
  7002: ["person-zhou-zong", "person-wu-zhuguan"],
  7003: ["person-head-admin-a", "person-head-admin-b"],
  7004: ["person-platform-support-a"],
  7005: ["person-head-config-a", "person-head-config-b"]
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
