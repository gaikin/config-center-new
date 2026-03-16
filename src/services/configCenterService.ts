import {
  seedAuditLogs,
  seedBusinessFields,
  seedDashboardOverview,
  seedExecutionLogs,
  seedInterfaces,
  seedJobScenes,
  seedListDatas,
  seedMenuCapabilityPolicies,
  seedMenuCapabilityRequests,
  seedMenuSdkPolicies,
  seedPageElements,
  seedPageFieldBindings,
  seedPageMenus,
  seedPageRegions,
  seedPageResources,
  seedPageSites,
  seedPageActivationPolicies,
  seedPendingItems,
  seedPendingSummary,
  seedPreprocessors,
  seedRoleMembers,
  seedRoles,
  seedRules,
  seedSdkArtifactVersions,
  seedSdkReleaseLanes,
  seedTriggerLogs
} from "../mock/seeds";
import { getOrgLabel } from "../orgOptions";
import type {
  ApiInputParam,
  ApiOutputParam,
  BusinessFieldDefinition,
  DashboardOverview,
  ExecutionLogItem,
  FailureReasonMetric,
  PublishAuditLog,
  PublishPendingItem,
  PublishPendingSummary,
  InterfaceDefinition,
  JobSceneDefinition,
  JobScenePreviewField,
  ListDataDefinition,
  MenuCapabilityPolicy,
  MenuCapabilityRequest,
  MenuSdkPolicy,
  LifecycleState,
  PageElement,
  PageFieldBinding,
  PageMenu,
  PageRegion,
  PageResource,
  PageSite,
  PageActivationPolicy,
  PreprocessorDefinition,
  PublishPendingResult,
  PublishValidationReport,
  RoleItem,
  RuleDefinition,
  SaveDraftResult,
  SdkArtifactVersion,
  SdkReleaseLane,
  TriggerLogItem,
  ValidationItem,
  ValidationReport
} from "../types";
import {
  validateInterfaceDraftPayload,
  validateListDataDraftPayload,
  validateJobSceneDraftPayload,
  validateRuleDraftPayload
} from "../validation/formRules";

type RuleCreatePayload = Omit<RuleDefinition, "id" | "currentVersion" | "updatedAt"> & {
  currentVersion?: number;
};
type RuleUpsertPayload = Omit<RuleDefinition, "updatedAt"> & {
  updatedAt?: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

const store = {
  dashboard: structuredClone(seedDashboardOverview),
  pageSites: structuredClone(seedPageSites),
  pageRegions: structuredClone(seedPageRegions),
  pageMenus: structuredClone(seedPageMenus),
  pageResources: structuredClone(seedPageResources),
  pageElements: structuredClone(seedPageElements),
  businessFields: structuredClone(seedBusinessFields),
  pageFieldBindings: structuredClone(seedPageFieldBindings),
  sdkArtifactVersions: structuredClone(seedSdkArtifactVersions),
  sdkReleaseLanes: structuredClone(seedSdkReleaseLanes),
  menuSdkPolicies: structuredClone(seedMenuSdkPolicies),
  menuCapabilityPolicies: structuredClone(seedMenuCapabilityPolicies),
  menuCapabilityRequests: structuredClone(seedMenuCapabilityRequests),
  pageActivationPolicies: structuredClone(seedPageActivationPolicies),
  listDatas: structuredClone(seedListDatas),
  interfaces: structuredClone(seedInterfaces),
  preprocessors: structuredClone(seedPreprocessors),
  rules: structuredClone(seedRules),
  scenes: structuredClone(seedJobScenes),
  pendingSummary: structuredClone(seedPendingSummary),
  pendingItems: structuredClone(seedPendingItems),
  auditLogs: structuredClone(seedAuditLogs),
  triggerLogs: structuredClone(seedTriggerLogs),
  executionLogs: structuredClone(seedExecutionLogs),
  roles: structuredClone(seedRoles),
  roleMembers: structuredClone(seedRoleMembers)
};

function nowIso() {
  return new Date().toISOString();
}

function updateStatus<T extends { id: number; status: LifecycleState; updatedAt: string }>(
  items: T[],
  id: number,
  status: LifecycleState
) {
  return items.map((item) => (item.id === id ? { ...item, status, updatedAt: nowIso() } : item));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeStringList(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function inferListPreviewFromFileName(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const matched = store.listDatas.find((item) => item.importFileName.trim().toLowerCase() === normalized);
  if (matched) {
    return {
      importColumns: clone(matched.importColumns),
      rowCount: matched.rowCount
    };
  }

  if (normalized.includes("risk") || normalized.includes("高风险")) {
    return {
      importColumns: ["customer_id", "id_no", "mobile", "risk_level", "risk_score", "risk_tag", "expire_at"],
      rowCount: 1280
    };
  }
  if (normalized.includes("white") || normalized.includes("白名单")) {
    return {
      importColumns: ["id_no", "customer_id", "whitelist_flag", "effective_date", "remark"],
      rowCount: 320
    };
  }
  if (normalized.includes("credit") || normalized.includes("授信") || normalized.includes("watch")) {
    return {
      importColumns: ["customer_id", "mobile", "control_level", "risk_reason", "owner_team"],
      rowCount: 860
    };
  }

  return {
    importColumns: ["customer_id", "id_no", "mobile", "biz_code", "remark"],
    rowCount: 100
  };
}

function nextId(items: Array<{ id: number }>) {
  if (items.length === 0) {
    return 1;
  }
  return Math.max(...items.map((item) => item.id)) + 1;
}

function appendAuditLog(
  action: PublishAuditLog["action"],
  resourceType: string,
  resourceName: string,
  operator: string,
  resourceId?: number
) {
  store.auditLogs = [
    {
      id: nextId(store.auditLogs),
      action,
      resourceType,
      resourceId,
      resourceName,
      operator,
      createdAt: nowIso()
    },
    ...store.auditLogs
  ];
}

function recalcPendingSummary(): PublishPendingSummary {
  const next: PublishPendingSummary = {
    draftCount: store.pendingItems.filter((it) => it.pendingType === "DRAFT").length,
    expiringSoonCount: store.pendingItems.filter((it) => it.pendingType === "EXPIRING_SOON").length,
    validationFailedCount: store.pendingItems.filter((it) => it.pendingType === "VALIDATION_FAILED").length,
    conflictCount: store.pendingItems.filter((it) => it.pendingType === "CONFLICT").length,
    riskConfirmPendingCount: store.pendingItems.filter((it) => it.pendingType === "RISK_CONFIRM").length
  };
  store.pendingSummary = next;
  return next;
}

function getResourceRecord(pending: PublishPendingItem) {
  switch (pending.resourceType) {
    case "RULE":
      return store.rules.find((item) => item.id === pending.resourceId) ?? null;
    case "JOB_SCENE":
      return store.scenes.find((item) => item.id === pending.resourceId) ?? null;
    case "PAGE_RESOURCE":
      return store.pageResources.find((item) => item.id === pending.resourceId) ?? null;
    case "INTERFACE":
      return store.interfaces.find((item) => item.id === pending.resourceId) ?? null;
    case "LIST_DATA":
      return store.listDatas.find((item) => item.id === pending.resourceId) ?? null;
    case "PREPROCESSOR":
      return store.preprocessors.find((item) => item.id === pending.resourceId) ?? null;
    case "MENU_SDK_POLICY":
      return store.menuSdkPolicies.find((item) => item.id === pending.resourceId) ?? null;
    case "PAGE_ACTIVATION_POLICY":
      return store.pageActivationPolicies.find((item) => item.id === pending.resourceId) ?? null;
    default:
      return null;
  }
}

function createValidationReport(pending: PublishPendingItem): ValidationReport {
  const resource = getResourceRecord(pending);
  if (!resource) {
    return {
      pass: false,
      items: [
        {
          key: "resource_exists",
          label: "对象存在",
          passed: false,
          detail: "对象不存在或已被删除，请先刷新待发布列表。"
        }
      ]
    };
  }

  const items: ValidationItem[] = [];

  const ownerOrgId = "ownerOrgId" in resource ? String(resource.ownerOrgId ?? "") : pending.ownerOrgId;
  items.push({
    key: "owner",
    label: "归属机构",
    passed: ownerOrgId.trim().length > 0,
    detail: ownerOrgId.trim().length > 0 ? getOrgLabel(ownerOrgId) : "尚未配置归属机构"
  });

  const notExpired = resource.status !== "EXPIRED";
  items.push({
    key: "state",
    label: "对象状态",
    passed: notExpired,
    detail: notExpired ? "当前对象状态可继续发布" : "对象已过期，不能继续发布"
  });

  items.push({
    key: "time_range",
    label: "生效时间",
    passed: true,
    detail: "当前原型默认通过，真实环境应以后端最终门禁为准"
  });

  if (pending.resourceType === "RULE") {
    const rule = resource as RuleDefinition;
    const hasSceneIfNeed = !rule.hasConfirmButton || Boolean(rule.sceneId);
    items.push({
      key: "rule_scene_binding",
      label: "确认动作关联场景",
      passed: hasSceneIfNeed,
      detail: hasSceneIfNeed ? "已完成确认动作配置" : "开启确认按钮后还未绑定作业场景"
    });

    const conflict = store.rules.some(
      (item) =>
        item.id !== rule.id &&
        item.status === "ACTIVE" &&
        item.ruleScope === "PAGE_RESOURCE" &&
        rule.ruleScope === "PAGE_RESOURCE" &&
        item.pageResourceId === rule.pageResourceId &&
        item.priority === rule.priority
    );
    items.push({
      key: "rule_conflict",
      label: "同页优先级冲突",
      passed: !conflict,
      detail: conflict ? "同一页面已存在相同优先级的生效规则" : "未发现同页优先级冲突"
    });
  }

  if (pending.resourceType === "JOB_SCENE") {
    const scene = resource as JobSceneDefinition;
    const hasManualDuration = scene.manualDurationSec > 0;
    items.push({
      key: "manual_duration",
      label: "人工基准时长",
      passed: hasManualDuration,
      detail: hasManualDuration ? `${scene.manualDurationSec} 秒` : "尚未配置人工基准时长"
    });

    const needsRiskConfirm =
      scene.executionMode === "AUTO_AFTER_PROMPT" || scene.executionMode === "AUTO_WITHOUT_PROMPT";
    const riskPass = !needsRiskConfirm || scene.riskConfirmed;
    items.push({
      key: "risk_confirm",
      label: "自动执行风险确认",
      passed: riskPass,
      detail: riskPass ? "已满足自动执行风险要求" : "自动执行场景尚未完成风险确认"
    });
  }

  if (pending.resourceType === "INTERFACE") {
    const api = resource as InterfaceDefinition;
    const timeoutPass = api.timeoutMs > 0 && api.timeoutMs <= 5000;
    items.push({
      key: "timeout",
      label: "超时配置",
      passed: timeoutPass,
      detail: timeoutPass ? `${api.timeoutMs} ms` : "超时需保持在 1 到 5000 ms 之间"
    });

    const retryPass = api.retryTimes >= 0 && api.retryTimes <= 3;
    items.push({
      key: "retry",
      label: "重试次数",
      passed: retryPass,
      detail: retryPass ? `${api.retryTimes} 次` : "重试次数需保持在 0 到 3 次之间"
    });
  }

  if (pending.resourceType === "LIST_DATA") {
    const listData = resource as ListDataDefinition;
    const indexPass = listData.indexBuildStatus === "READY";
    items.push({
      key: "index_ready",
      label: "名单索引状态",
      passed: indexPass,
      detail: indexPass ? "名单索引已构建完成" : "名单索引尚未就绪，暂不可发布"
    });

    const outputPass = listData.outputFields.length > 0;
    items.push({
      key: "output_fields",
      label: "输出字段",
      passed: outputPass,
      detail: outputPass ? `已配置 ${listData.outputFields.length} 个输出字段` : "尚未配置输出字段"
    });
  }

  if (pending.resourceType === "PREPROCESSOR") {
    const processor = resource as PreprocessorDefinition;
    const controlledPass = processor.processorType === "BUILT_IN" || processor.status !== "ACTIVE";
    items.push({
      key: "processor_control",
      label: "脚本发布控制",
      passed: controlledPass,
      detail: controlledPass ? "当前发布控制满足要求" : "脚本型规则需先完成受控发布与审计确认"
    });
  }

  if (pending.resourceType === "MENU_SDK_POLICY") {
    const policy = resource as MenuSdkPolicy;
    const stableLanePass = store.sdkReleaseLanes.some((lane) => lane.id === policy.stableLaneId);
    items.push({
      key: "stable_lane",
      label: "正式版本通道",
      passed: stableLanePass,
      detail: stableLanePass ? "已绑定正式版本通道" : "尚未绑定正式版本通道"
    });

    const grayLanePass = policy.grayOrgIds.length === 0 || Boolean(policy.grayLaneId);
    items.push({
      key: "gray_lane",
      label: "试点版本通道",
      passed: grayLanePass,
      detail: grayLanePass ? "试点发布配置完整" : "已选择试点机构，但还未配置试点版本通道"
    });

    const timePass = policy.effectiveStart <= policy.effectiveEnd;
    items.push({
      key: "effective_time",
      label: "生效时间窗",
      passed: timePass,
      detail: timePass ? `${policy.effectiveStart} ~ ${policy.effectiveEnd}` : "生效时间范围不合法"
    });
  }

  if (pending.resourceType === "PAGE_ACTIVATION_POLICY") {
    const policy = resource as PageActivationPolicy;
    const pagePass = store.pageResources.some((page) => page.id === policy.pageResourceId);
    items.push({
      key: "page_binding",
      label: "页面绑定",
      passed: pagePass,
      detail: pagePass ? "已绑定页面" : "页面资源不存在"
    });

    const promptPass = !policy.enabled || policy.promptRuleSetName.trim().length > 0;
    items.push({
      key: "prompt_ruleset",
      label: "提示规则配置",
      passed: promptPass,
      detail: promptPass ? policy.promptRuleSetName || "页面未启用提示能力" : "页面启用后必须绑定提示规则"
    });

    const preloadPass = !policy.hasJobScenes || policy.jobPreloadPolicy !== "none";
    items.push({
      key: "job_preload_policy",
      label: "作业预热策略",
      passed: preloadPass,
      detail: preloadPass ? policy.jobPreloadPolicy : "已开通作业能力的页面需要补充作业预热策略"
    });
  }

  const pass = items.every((item) => item.passed);
  return { pass, items };
}

function buildPublishRiskItems(pending: PublishPendingItem, report: ValidationReport) {
  const riskItems = new Set<string>();

  if (pending.pendingType === "RISK_CONFIRM") {
    riskItems.add("当前对象仍待完成风险确认，本次不会正式生效。");
  }
  if (report.items.some((item) => item.key === "risk_confirm" && !item.passed)) {
    riskItems.add("自动执行场景尚未完成风险确认，请先补齐责任确认。");
  }
  if (report.items.some((item) => item.key === "rule_conflict" && !item.passed)) {
    riskItems.add("当前规则与同页已生效规则存在优先级冲突，请先确认覆盖策略。");
  }

  return Array.from(riskItems);
}

function toPublishValidationReport(pending: PublishPendingItem, report: ValidationReport): PublishValidationReport {
  const blockingCount = report.items.filter((item) => !item.passed).length;
  const warningCount = 0;
  return {
    ...report,
    blockingCount,
    warningCount,
    impactSummary: `${pending.resourceName} 预计影响机构：${getOrgLabel(pending.ownerOrgId)}`,
    riskItems: buildPublishRiskItems(pending, report)
  };
}

function touchPendingForResource(
  resourceType: PublishPendingItem["resourceType"],
  resourceId: number,
  status: LifecycleState,
  ownerOrgId: string,
  resourceName: string,
  pendingType: PublishPendingItem["pendingType"] = "DRAFT"
) {
  const existing = store.pendingItems.find(
    (item) => item.resourceType === resourceType && item.resourceId === resourceId
  );
  if (existing) {
    store.pendingItems = store.pendingItems.map((item) =>
      item.id === existing.id ? { ...item, status, pendingType, updatedAt: nowIso() } : item
    );
  } else {
    store.pendingItems = [
      {
        id: nextId(store.pendingItems),
        resourceType,
        resourceId,
        resourceName,
        status,
        ownerOrgId,
        pendingType,
        updatedAt: nowIso()
      },
      ...store.pendingItems
    ];
  }
  recalcPendingSummary();
}

export const configCenterService = {
  async getDashboardOverview(): Promise<DashboardOverview> {
    await sleep(120);
    store.dashboard = {
      ...store.dashboard,
      pageResourceCount: store.pageResources.length,
      activeRuleCount: store.rules.filter((it) => it.status === "ACTIVE").length,
      activeSceneCount: store.scenes.filter((it) => it.status === "ACTIVE").length,
      activeInterfaceCount: store.interfaces.filter((it) => it.status === "ACTIVE").length,
      roleCount: store.roles.length,
      pendingCount: store.pendingItems.length
    };
    return clone(store.dashboard);
  },

  async listPageSites(): Promise<PageSite[]> {
    await sleep(100);
    return clone(store.pageSites);
  },

  async listPageRegions(): Promise<PageRegion[]> {
    await sleep(100);
    return clone(store.pageRegions);
  },

  async listPageMenus(): Promise<PageMenu[]> {
    await sleep(100);
    return clone(store.pageMenus);
  },

  async listPageResources(): Promise<PageResource[]> {
    await sleep(150);
    return clone(store.pageResources);
  },

  async listSdkArtifactVersions(): Promise<SdkArtifactVersion[]> {
    await sleep(120);
    return clone(store.sdkArtifactVersions);
  },

  async listSdkReleaseLanes(): Promise<SdkReleaseLane[]> {
    await sleep(120);
    return clone(store.sdkReleaseLanes);
  },

  async listMenuSdkPolicies(): Promise<MenuSdkPolicy[]> {
    await sleep(150);
    return clone(store.menuSdkPolicies);
  },

  async upsertMenuSdkPolicy(
    payload: Omit<MenuSdkPolicy, "updatedAt" | "resolutionSummary"> & {
      updatedAt?: string;
      resolutionSummary?: string;
    }
  ): Promise<MenuSdkPolicy> {
    await sleep(180);
    const next: MenuSdkPolicy = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso(),
      resolutionSummary:
        payload.resolutionSummary ??
        `${payload.grayOrgIds.length > 0 ? payload.grayOrgIds.join("、") : "全部机构"} -> ${
          payload.grayLaneId ? "gray lane" : "stable"
        }`
    };
    const exists = store.menuSdkPolicies.find((item) => item.id === payload.id);
    store.menuSdkPolicies = exists
      ? store.menuSdkPolicies.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.menuSdkPolicies];
    touchPendingForResource("MENU_SDK_POLICY", next.id, next.status, next.ownerOrgId, `菜单策略-${next.menuCode}`);
    return clone(next);
  },

  async listMenuCapabilityPolicies(): Promise<MenuCapabilityPolicy[]> {
    await sleep(120);
    return clone(store.menuCapabilityPolicies);
  },

  async listMenuCapabilityRequests(menuId?: number): Promise<MenuCapabilityRequest[]> {
    await sleep(120);
    const rows = typeof menuId === "number"
      ? store.menuCapabilityRequests.filter((item) => item.menuId === menuId)
      : store.menuCapabilityRequests;
    return clone([...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  },

  async submitMenuCapabilityRequest(payload: {
    menuId: number;
    capabilityTypes: Array<"PROMPT" | "JOB">;
    reason: string;
    applicant?: string;
  }): Promise<MenuCapabilityPolicy> {
    await sleep(180);
    const current = store.menuCapabilityPolicies.find((item) => item.menuId === payload.menuId);
    const requested = Array.from(new Set(payload.capabilityTypes));
    if (requested.length === 0) {
      throw new Error("请选择至少一个申请能力");
    }
    if (!payload.reason.trim()) {
      throw new Error("请填写申请原因");
    }

    let nextPromptStatus = current?.promptStatus ?? "DISABLED";
    let nextJobStatus = current?.jobStatus ?? "DISABLED";
    let createdCount = 0;

    for (const capabilityType of requested) {
      if (capabilityType === "PROMPT") {
        if (nextPromptStatus === "DISABLED") {
          nextPromptStatus = "PENDING";
          createdCount += 1;
          store.menuCapabilityRequests = [
            {
              id: nextId(store.menuCapabilityRequests),
              menuId: payload.menuId,
              capabilityType,
              reason: payload.reason.trim(),
              status: "PENDING",
              applicant: payload.applicant ?? "person-business-operator",
              createdAt: nowIso()
            },
            ...store.menuCapabilityRequests
          ];
        }
      } else if (nextJobStatus === "DISABLED") {
        nextJobStatus = "PENDING";
        createdCount += 1;
        store.menuCapabilityRequests = [
          {
            id: nextId(store.menuCapabilityRequests),
            menuId: payload.menuId,
            capabilityType,
            reason: payload.reason.trim(),
            status: "PENDING",
            applicant: payload.applicant ?? "person-business-operator",
            createdAt: nowIso()
          },
          ...store.menuCapabilityRequests
        ];
      }
    }

    if (createdCount === 0) {
      throw new Error("所选能力已开通或已在申请中，请勿重复申请");
    }

    const next: MenuCapabilityPolicy = {
      id: current?.id ?? nextId(store.menuCapabilityPolicies),
      menuId: payload.menuId,
      promptStatus: nextPromptStatus,
      jobStatus: nextJobStatus,
      status: nextPromptStatus === "ENABLED" && nextJobStatus === "ENABLED" ? "ACTIVE" : "DRAFT",
      updatedAt: nowIso(),
      updatedBy: payload.applicant ?? "person-business-operator"
    };
    store.menuCapabilityPolicies = current
      ? store.menuCapabilityPolicies.map((item) => (item.id === current.id ? next : item))
      : [next, ...store.menuCapabilityPolicies];

    return clone(next);
  },

  async listPageActivationPolicies(): Promise<PageActivationPolicy[]> {
    await sleep(140);
    return clone(store.pageActivationPolicies);
  },

  async upsertPageActivationPolicy(
    payload: Omit<PageActivationPolicy, "updatedAt"> & { updatedAt?: string }
  ): Promise<PageActivationPolicy> {
    await sleep(180);
    const next: PageActivationPolicy = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    const exists = store.pageActivationPolicies.find((item) => item.id === payload.id);
    store.pageActivationPolicies = exists
      ? store.pageActivationPolicies.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.pageActivationPolicies];
    touchPendingForResource(
      "PAGE_ACTIVATION_POLICY",
      next.id,
      next.status,
      next.ownerOrgId,
      `页面启用策略-${next.pageResourceId}`
    );
    return clone(next);
  },

  async listListDatas(): Promise<ListDataDefinition[]> {
    await sleep(140);
    return clone(store.listDatas);
  },

  async previewListDataImport(fileName: string): Promise<{ importColumns: string[]; rowCount: number }> {
    await sleep(120);
    return inferListPreviewFromFileName(fileName);
  },

  async upsertListData(payload: Omit<ListDataDefinition, "updatedAt"> & { updatedAt?: string }): Promise<ListDataDefinition> {
    await sleep(170);
    const exists = store.listDatas.find((item) => item.id === payload.id);
    const importColumns = normalizeStringList(payload.importColumns ?? exists?.importColumns ?? []);
    const outputFields = normalizeStringList(payload.outputFields ?? exists?.outputFields ?? []);
    const next: ListDataDefinition = {
      ...payload,
      importColumns,
      outputFields,
      indexBuildStatus: payload.indexBuildStatus ?? exists?.indexBuildStatus ?? "PENDING",
      activeAlias: payload.activeAlias ?? exists?.activeAlias ?? `cc_list_data_${payload.id}_active`,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    store.listDatas = exists
      ? store.listDatas.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.listDatas];
    return clone(next);
  },

  async saveListDataDraft(
    payload: Omit<ListDataDefinition, "updatedAt"> & { updatedAt?: string }
  ): Promise<SaveDraftResult<ListDataDefinition>> {
    await sleep(120);
    const report = validateListDataDraftPayload(payload, store.listDatas);
    if (!report.canSaveDraft) {
      return { success: false, report };
    }
    const data = await configCenterService.upsertListData(payload);
    return { success: true, data, report };
  },

  async updateListDataStatus(id: number, status: LifecycleState): Promise<void> {
    await sleep(120);
    store.listDatas = updateStatus(store.listDatas, id, status);
  },

  async buildListDataIndex(id: number): Promise<ListDataDefinition> {
    const current = store.listDatas.find((item) => item.id === id);
    if (!current) {
      throw new Error("名单不存在");
    }
    store.listDatas = store.listDatas.map((item) =>
      item.id === id ? { ...item, indexBuildStatus: "BUILDING", updatedAt: nowIso() } : item
    );
    await sleep(320);
    const next = store.listDatas.find((item) => item.id === id);
    if (!next) {
      throw new Error("名单不存在");
    }
    const ready: ListDataDefinition = {
      ...next,
      indexBuildStatus: "READY",
      activeAlias: next.activeAlias || `cc_list_data_${id}_active`,
      updatedAt: nowIso()
    };
    store.listDatas = store.listDatas.map((item) => (item.id === id ? ready : item));
    return clone(ready);
  },

  async updateRuleListLookupConditions(ruleId: number, conditions: RuleDefinition["listLookupConditions"]): Promise<RuleDefinition> {
    await sleep(140);
    const current = store.rules.find((item) => item.id === ruleId);
    if (!current) {
      throw new Error("规则不存在");
    }
    const next: RuleDefinition = {
      ...current,
      listLookupConditions: clone(conditions ?? []),
      updatedAt: nowIso()
    };
    store.rules = store.rules.map((item) => (item.id === ruleId ? next : item));
    return clone(next);
  },

  async upsertPageResource(payload: Omit<PageResource, "updatedAt"> & { updatedAt?: string }): Promise<PageResource> {
    await sleep(180);
    const exists = store.pageResources.find((item) => item.id === payload.id);
    const next: PageResource = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };

    if (exists && exists.status === "ACTIVE") {
      const draftVersion: PageResource = {
        ...next,
        id: nextId(store.pageResources),
        status: "DRAFT",
        currentVersion: exists.currentVersion + 1,
        updatedAt: nowIso()
      };
      store.pageResources = [draftVersion, ...store.pageResources];
      touchPendingForResource("PAGE_RESOURCE", draftVersion.id, "DRAFT", draftVersion.ownerOrgId, draftVersion.name);
      return clone(draftVersion);
    }

    store.pageResources = exists
      ? store.pageResources.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.pageResources];

    if (next.status === "DRAFT") {
      touchPendingForResource("PAGE_RESOURCE", next.id, "DRAFT", next.ownerOrgId, next.name);
    }

    return clone(next);
  },

  async listPageElements(pageResourceId: number): Promise<PageElement[]> {
    await sleep(120);
    return clone(store.pageElements.filter((item) => item.pageResourceId === pageResourceId));
  },

  async listBusinessFields(pageResourceId?: number): Promise<BusinessFieldDefinition[]> {
    await sleep(120);
    return clone(
      store.businessFields.filter(
        (item) => item.scope === "GLOBAL" || pageResourceId === undefined || item.pageResourceId === pageResourceId
      )
    );
  },

  async upsertBusinessField(
    payload: Omit<BusinessFieldDefinition, "updatedAt"> & { updatedAt?: string }
  ): Promise<BusinessFieldDefinition> {
    await sleep(150);
    const next: BusinessFieldDefinition = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    const exists = store.businessFields.some((item) => item.id === next.id);
    store.businessFields = exists
      ? store.businessFields.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.businessFields];
    return clone(next);
  },

  async listPageFieldBindings(pageResourceId: number): Promise<PageFieldBinding[]> {
    await sleep(120);
    return clone(store.pageFieldBindings.filter((item) => item.pageResourceId === pageResourceId));
  },

  async upsertPageFieldBinding(
    payload: Omit<PageFieldBinding, "updatedAt"> & { updatedAt?: string }
  ): Promise<PageFieldBinding> {
    await sleep(150);
    const next: PageFieldBinding = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    const exists = store.pageFieldBindings.some((item) => item.id === next.id);
    store.pageFieldBindings = exists
      ? store.pageFieldBindings.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.pageFieldBindings];
    return clone(next);
  },

  async deletePageFieldBinding(id: number): Promise<void> {
    await sleep(100);
    store.pageFieldBindings = store.pageFieldBindings.filter((item) => item.id !== id);
  },

  async upsertPageElement(payload: Omit<PageElement, "updatedAt"> & { updatedAt?: string }): Promise<PageElement> {
    await sleep(140);
    const next: PageElement = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    const exists = store.pageElements.some((item) => item.id === next.id);
    store.pageElements = exists
      ? store.pageElements.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.pageElements];

    const resource = store.pageResources.find((item) => item.id === next.pageResourceId);
    if (resource) {
      const elementCount = store.pageElements.filter((item) => item.pageResourceId === resource.id).length;
      store.pageResources = store.pageResources.map((item) =>
        item.id === resource.id ? { ...item, elementCount, updatedAt: nowIso() } : item
      );
    }
    return clone(next);
  },

  async deletePageElement(elementId: number): Promise<void> {
    await sleep(120);
    const target = store.pageElements.find((item) => item.id === elementId);
    if (!target) {
      return;
    }
    store.pageElements = store.pageElements.filter((item) => item.id !== elementId);
    const elementCount = store.pageElements.filter((item) => item.pageResourceId === target.pageResourceId).length;
    store.pageResources = store.pageResources.map((item) =>
      item.id === target.pageResourceId ? { ...item, elementCount, updatedAt: nowIso() } : item
    );
  },

  async listInterfaces(): Promise<InterfaceDefinition[]> {
    await sleep(150);
    return clone(store.interfaces);
  },

  async upsertInterface(payload: Omit<InterfaceDefinition, "updatedAt"> & { updatedAt?: string }): Promise<InterfaceDefinition> {
    await sleep(170);
    const exists = store.interfaces.find((item) => item.id === payload.id);
    const next: InterfaceDefinition = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    if (exists && exists.status === "ACTIVE") {
      const draftVersion: InterfaceDefinition = {
        ...next,
        id: nextId(store.interfaces),
        status: "DRAFT",
        currentVersion: exists.currentVersion + 1,
        updatedAt: nowIso()
      };
      store.interfaces = [draftVersion, ...store.interfaces];
      touchPendingForResource("INTERFACE", draftVersion.id, "DRAFT", draftVersion.ownerOrgId, draftVersion.name);
      return clone(draftVersion);
    }

    store.interfaces = exists
      ? store.interfaces.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.interfaces];

    if (next.status === "DRAFT") {
      touchPendingForResource("INTERFACE", next.id, "DRAFT", next.ownerOrgId, next.name);
    }

    return clone(next);
  },

  async saveInterfaceDraft(
    payload: Omit<InterfaceDefinition, "updatedAt"> & { updatedAt?: string },
    options: { inputConfig: Record<string, ApiInputParam[]>; outputConfig: ApiOutputParam[] }
  ): Promise<SaveDraftResult<InterfaceDefinition>> {
    await sleep(120);
    const report = validateInterfaceDraftPayload(payload, options.inputConfig, options.outputConfig, store.interfaces);
    if (!report.canSaveDraft) {
      return { success: false, report };
    }
    const data = await configCenterService.upsertInterface(payload);
    return { success: true, data, report };
  },

  async updateInterfaceStatus(id: number, status: LifecycleState): Promise<void> {
    await sleep(120);
    store.interfaces = updateStatus(store.interfaces, id, status);
    const row = store.interfaces.find((item) => item.id === id);
    if (row) {
      appendAuditLog("DISABLE", "INTERFACE", row.name, "绯荤粺", row.id);
    }
  },

  async listPreprocessors(): Promise<PreprocessorDefinition[]> {
    await sleep(120);
    return clone(store.preprocessors);
  },

  async upsertPreprocessor(
    payload: Omit<PreprocessorDefinition, "updatedAt" | "usedByCount"> & {
      usedByCount?: number;
      updatedAt?: string;
    }
  ): Promise<PreprocessorDefinition> {
    await sleep(160);
    const exists = store.preprocessors.find((item) => item.id === payload.id);
    const usedByCount = exists?.usedByCount ?? payload.usedByCount ?? 0;
    const next: PreprocessorDefinition = {
      ...payload,
      usedByCount,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    if (exists && exists.status === "ACTIVE") {
      const draftVersion: PreprocessorDefinition = {
        ...next,
        id: nextId(store.preprocessors),
        status: "DRAFT",
        updatedAt: nowIso()
      };
      store.preprocessors = [draftVersion, ...store.preprocessors];
      touchPendingForResource("PREPROCESSOR", draftVersion.id, "DRAFT", draftVersion.ownerOrgId, draftVersion.name);
      return clone(draftVersion);
    }

    store.preprocessors = exists
      ? store.preprocessors.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.preprocessors];

    if (next.status === "DRAFT") {
      touchPendingForResource("PREPROCESSOR", next.id, "DRAFT", next.ownerOrgId, next.name);
    }

    return clone(next);
  },

  async updatePreprocessorStatus(id: number, status: LifecycleState): Promise<void> {
    await sleep(120);
    store.preprocessors = updateStatus(store.preprocessors, id, status);
    const row = store.preprocessors.find((item) => item.id === id);
    if (row) {
      appendAuditLog("DISABLE", "PREPROCESSOR", row.name, "绯荤粺", row.id);
    }
  },

  async listRules(): Promise<RuleDefinition[]> {
    await sleep(150);
    return clone(store.rules);
  },

  async createRule(payload: RuleCreatePayload): Promise<RuleDefinition> {
    await sleep(200);
    if (payload.closeMode === "TIMER_THEN_MANUAL" && (!payload.closeTimeoutSec || payload.closeTimeoutSec <= 0)) {
      throw new Error("closeTimeoutSec is required when closeMode is TIMER_THEN_MANUAL");
    }
    const duplicated = store.rules.some((item) => item.name === payload.name);
    if (duplicated) {
      throw new Error(`Rule name already exists: ${payload.name}`);
    }
    const created: RuleDefinition = {
      ...payload,
      listLookupConditions: clone(payload.listLookupConditions ?? []),
      id: nextId(store.rules),
      currentVersion: payload.currentVersion ?? 1,
      updatedAt: nowIso()
    };
    store.rules = [created, ...store.rules];
    if (created.status === "DRAFT") {
      touchPendingForResource("RULE", created.id, "DRAFT", created.ownerOrgId, created.name);
    }
    return clone(created);
  },
  async upsertRule(payload: RuleUpsertPayload): Promise<RuleDefinition> {
    await sleep(200);
    if (payload.closeMode === "TIMER_THEN_MANUAL" && (!payload.closeTimeoutSec || payload.closeTimeoutSec <= 0)) {
      throw new Error("closeTimeoutSec is required when closeMode is TIMER_THEN_MANUAL");
    }
    const duplicated = store.rules.some((item) => item.name === payload.name && item.id !== payload.id);
    if (duplicated) {
      throw new Error(`Rule name already exists: ${payload.name}`);
    }

    const exists = store.rules.find((item) => item.id === payload.id);
    const next: RuleDefinition = {
      ...payload,
      listLookupConditions: clone(payload.listLookupConditions ?? exists?.listLookupConditions ?? []),
      updatedAt: payload.updatedAt ?? nowIso()
    };

    if (exists && exists.status === "ACTIVE") {
      const draftVersion: RuleDefinition = {
        ...next,
        id: nextId(store.rules),
        status: "DRAFT",
        currentVersion: exists.currentVersion + 1,
        updatedAt: nowIso()
      };
      store.rules = [draftVersion, ...store.rules];
      touchPendingForResource("RULE", draftVersion.id, "DRAFT", draftVersion.ownerOrgId, draftVersion.name);
      return clone(draftVersion);
    }

    store.rules = exists
      ? store.rules.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.rules];

    if (next.status === "DRAFT") {
      touchPendingForResource("RULE", next.id, "DRAFT", next.ownerOrgId, next.name);
    }

    return clone(next);
  },
  async saveRuleDraft(payload: RuleUpsertPayload): Promise<SaveDraftResult<RuleDefinition>> {
    await sleep(120);
    const report = validateRuleDraftPayload(payload, store.rules);
    if (!report.canSaveDraft) {
      return { success: false, report };
    }
    const data = await configCenterService.upsertRule(payload);
    return { success: true, data, report };
  },
  async updateRuleStatus(id: number, status: LifecycleState): Promise<void> {
    await sleep(120);
    store.rules = updateStatus(store.rules, id, status);
    const row = store.rules.find((item) => item.id === id);
    if (row) {
      appendAuditLog("DISABLE", "RULE", row.name, "绯荤粺", row.id);
    }
  },

  async previewRule(ruleId: number): Promise<{ ruleId: number; previewOnly: true; matched: boolean; detail: string }> {
    await sleep(200);
    const rule = store.rules.find((item) => item.id === ruleId);
    return {
      ruleId,
      previewOnly: true,
      matched: Boolean(rule),
      detail: rule
        ? `Rule ${rule.name} parsed successfully；普通条件 ${rule.id ? "已加载" : "未加载"}，可在高级条件中配置 API 字段、名单字段等来源。`
        : "Rule does not exist; preview unavailable."
    };
  },

  async listJobScenes(): Promise<JobSceneDefinition[]> {
    await sleep(150);
    return clone(store.scenes);
  },

  async upsertJobScene(payload: Omit<JobSceneDefinition, "updatedAt"> & { updatedAt?: string }): Promise<JobSceneDefinition> {
    await sleep(170);
    const exists = store.scenes.find((item) => item.id === payload.id);
    const next: JobSceneDefinition = {
      ...payload,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    if (exists && exists.status === "ACTIVE") {
      const draftVersion: JobSceneDefinition = {
        ...next,
        id: nextId(store.scenes),
        status: "DRAFT",
        currentVersion: exists.currentVersion + 1,
        riskConfirmed: false,
        updatedAt: nowIso()
      };
      store.scenes = [draftVersion, ...store.scenes];
      touchPendingForResource("JOB_SCENE", draftVersion.id, "DRAFT", "branch-east", draftVersion.name);
      return clone(draftVersion);
    }

    store.scenes = exists
      ? store.scenes.map((item) => (item.id === next.id ? next : item))
      : [next, ...store.scenes];

    if (next.status === "DRAFT") {
      touchPendingForResource("JOB_SCENE", next.id, "DRAFT", "branch-east", next.name);
    }

    return clone(next);
  },

  async saveJobSceneDraft(
    payload: Omit<JobSceneDefinition, "updatedAt"> & { updatedAt?: string }
  ): Promise<SaveDraftResult<JobSceneDefinition>> {
    await sleep(120);
    const report = validateJobSceneDraftPayload(payload, store.scenes);
    if (!report.canSaveDraft) {
      return { success: false, report };
    }
    const data = await configCenterService.upsertJobScene(payload);
    return { success: true, data, report };
  },

  async updateJobSceneStatus(id: number, status: LifecycleState): Promise<void> {
    await sleep(120);
    store.scenes = updateStatus(store.scenes, id, status);
    const row = store.scenes.find((item) => item.id === id);
    if (row) {
      appendAuditLog("DISABLE", "JOB_SCENE", row.name, "绯荤粺", row.id);
    }
  },

  async confirmJobSceneRisk(id: number): Promise<void> {
    await sleep(160);
    store.scenes = store.scenes.map((item) =>
      item.id === id ? { ...item, riskConfirmed: true, updatedAt: nowIso() } : item
    );

    const row = store.scenes.find((item) => item.id === id);
    if (row) {
      appendAuditLog("RISK_CONFIRM", "JOB_SCENE", row.name, "person-business-manager", row.id);
      store.pendingItems = store.pendingItems.filter(
        (item) => !(item.resourceType === "JOB_SCENE" && item.resourceId === id && item.pendingType === "RISK_CONFIRM")
      );
      recalcPendingSummary();
    }
  },

  async previewJobScene(sceneId: number): Promise<JobScenePreviewField[]> {
    await sleep(160);
    const scene = store.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      return [];
    }

    return [
      {
        key: "customer_name",
        fieldName: "Customer Name",
        originalValue: "Zhang San",
        nextValue: "Zhang San",
        source: "page_get(customer_name)",
        abnormal: false
      },
      {
        key: "risk_score",
        fieldName: "Risk Score",
        originalValue: "-",
        nextValue: "86",
        source: "api_call(risk_score_query)",
        abnormal: false
      },
      {
        key: "mobile",
        fieldName: "Mobile",
        originalValue: "138****8888",
        nextValue: "13800008888",
        source: "js_script(mask_mobile)",
        abnormal: scene.executionMode === "AUTO_WITHOUT_PROMPT"
      }
    ];
  },

  async executeJobScenePreview(sceneId: number, selectedFieldKeys: string[]): Promise<{ writtenCount: number; skippedCount: number; detail: string }> {
    await sleep(180);
    const scene = store.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      throw new Error("Job scene does not exist");
    }
    const total = 3;
    const writtenCount = selectedFieldKeys.length;
    const skippedCount = Math.max(total - writtenCount, 0);
    const result: ExecutionLogItem["result"] = skippedCount > 0 ? "PARTIAL_SUCCESS" : "SUCCESS";
    store.executionLogs = [
      {
        id: nextId(store.executionLogs),
        sceneName: scene.name,
        triggerSource: "PROMPT_CONFIRM",
        result,
        latencyMs: 900 + writtenCount * 120,
        reason: skippedCount > 0 ? `${skippedCount} fields were skipped` : "All fields written successfully",
        createdAt: nowIso()
      },
      ...store.executionLogs
    ];

    return {
      writtenCount,
      skippedCount,
      detail: skippedCount > 0 ? `Wrote ${writtenCount} fields, skipped ${skippedCount} fields` : "All fields written"
    };
  },

  async getPendingSummary(): Promise<PublishPendingSummary> {
    await sleep(100);
    return clone(recalcPendingSummary());
  },

  async listPendingItems(): Promise<PublishPendingItem[]> {
    await sleep(140);
    return clone([...store.pendingItems].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
  },

  async validatePendingItem(pendingId: number, operator = "person-business-manager"): Promise<ValidationReport> {
    await sleep(120);
    const pending = store.pendingItems.find((item) => item.id === pendingId);
    if (!pending) {
      throw new Error("Pending item not found");
    }
    const report = createValidationReport(pending);
    appendAuditLog("VALIDATE", pending.resourceType, pending.resourceName, operator, pending.resourceId);
    if (!report.pass) {
      store.pendingItems = store.pendingItems.map((item) =>
        item.id === pendingId ? { ...item, pendingType: "VALIDATION_FAILED", updatedAt: nowIso() } : item
      );
      recalcPendingSummary();
    }
    return report;
  },

  async getPendingValidationReport(pendingId: number): Promise<PublishValidationReport> {
    await sleep(80);
    const pending = store.pendingItems.find((item) => item.id === pendingId);
    if (!pending) {
      throw new Error("Pending item not found");
    }
    return clone(toPublishValidationReport(pending, createValidationReport(pending)));
  },

  async publishPendingItem(pendingId: number, operator = "person-business-manager"): Promise<PublishPendingResult> {
    await sleep(180);
    const pending = store.pendingItems.find((item) => item.id === pendingId);
    if (!pending) {
      throw new Error("Pending item not found");
    }

    const report = createValidationReport(pending);
    if (!report.pass) {
      store.pendingItems = store.pendingItems.map((item) =>
        item.id === pendingId ? { ...item, pendingType: "VALIDATION_FAILED", updatedAt: nowIso() } : item
      );
      recalcPendingSummary();
      return {
        success: false,
        report: toPublishValidationReport(pending, report)
      };
    }

    const activate = <T extends { id: number; status: LifecycleState; updatedAt: string }>(items: T[]) =>
      items.map((item) =>
        item.id === pending.resourceId ? { ...item, status: "ACTIVE", updatedAt: nowIso() } : item
      );

    if (pending.resourceType === "RULE") {
      store.rules = activate(store.rules);
    } else if (pending.resourceType === "JOB_SCENE") {
      store.scenes = activate(store.scenes);
    } else if (pending.resourceType === "PAGE_RESOURCE") {
      store.pageResources = activate(store.pageResources);
    } else if (pending.resourceType === "INTERFACE") {
      store.interfaces = activate(store.interfaces);
    } else if (pending.resourceType === "LIST_DATA") {
      store.listDatas = activate(store.listDatas);
    } else if (pending.resourceType === "PREPROCESSOR") {
      store.preprocessors = activate(store.preprocessors);
    } else if (pending.resourceType === "MENU_SDK_POLICY") {
      store.menuSdkPolicies = activate(store.menuSdkPolicies);
    } else if (pending.resourceType === "PAGE_ACTIVATION_POLICY") {
      store.pageActivationPolicies = activate(store.pageActivationPolicies);
    }

    store.pendingItems = store.pendingItems.filter((item) => item.id !== pendingId);
    recalcPendingSummary();
    appendAuditLog("PUBLISH", pending.resourceType, pending.resourceName, operator, pending.resourceId);
    return {
      success: true,
      report: toPublishValidationReport(pending, report)
    };
  },

  async deferPendingItem(pendingId: number, operator = "person-business-manager"): Promise<void> {
    await sleep(120);
    const pending = store.pendingItems.find((item) => item.id === pendingId);
    if (!pending) {
      throw new Error("Pending item not found");
    }
    store.pendingItems = store.pendingItems.map((item) =>
      item.id === pendingId ? { ...item, pendingType: "EXPIRING_SOON", updatedAt: nowIso() } : item
    );
    recalcPendingSummary();
    appendAuditLog("DEFER", pending.resourceType, pending.resourceName, operator, pending.resourceId);
  },

  async resolvePendingItem(pendingId: number, operator = "person-business-manager"): Promise<void> {
    await sleep(120);
    const pending = store.pendingItems.find((item) => item.id === pendingId);
    if (!pending) {
      throw new Error("Pending item not found");
    }
    store.pendingItems = store.pendingItems.filter((item) => item.id !== pendingId);
    recalcPendingSummary();
    appendAuditLog("RESOLVE", pending.resourceType, pending.resourceName, operator, pending.resourceId);
  },

  async rollbackResource(resourceType: string, resourceId: number, operator = "person-business-manager"): Promise<void> {
    await sleep(160);

    const rollback = <T extends { id: number; status: LifecycleState; updatedAt: string }>(
      items: T[],
      type: PublishPendingItem["resourceType"],
      ownerOrgId: string,
      getName: (item: T) => string
    ) => {
      const target = items.find((item) => item.id === resourceId);
      if (!target) {
        return { items, target: null as T | null };
      }
      const nextItems = items.map((item) =>
        item.id === resourceId ? { ...item, status: "DRAFT", updatedAt: nowIso() } : item
      );
      touchPendingForResource(type, resourceId, "DRAFT", ownerOrgId, getName(target));
      return { items: nextItems, target };
    };

    if (resourceType === "RULE") {
      const result = rollback(store.rules, "RULE", "branch-east", (item) => item.name);
      store.rules = result.items;
      if (result.target) {
        appendAuditLog("ROLLBACK", "RULE", result.target.name, operator, resourceId);
      }
      return;
    }

    if (resourceType === "JOB_SCENE") {
      const result = rollback(store.scenes, "JOB_SCENE", "branch-east", (item) => item.name);
      store.scenes = result.items;
      if (result.target) {
        appendAuditLog("ROLLBACK", "JOB_SCENE", result.target.name, operator, resourceId);
      }
      return;
    }

    if (resourceType === "INTERFACE") {
      const result = rollback(store.interfaces, "INTERFACE", "branch-east", (item) => item.name);
      store.interfaces = result.items;
      if (result.target) {
        appendAuditLog("ROLLBACK", "INTERFACE", result.target.name, operator, resourceId);
      }
      return;
    }

    if (resourceType === "MENU_SDK_POLICY") {
      const result = rollback(store.menuSdkPolicies, "MENU_SDK_POLICY", "head-office", (item) => `菜单策略-${item.menuCode}`);
      store.menuSdkPolicies = result.items;
      if (result.target) {
        appendAuditLog("ROLLBACK", "MENU_SDK_POLICY", `菜单策略-${result.target.menuCode}`, operator, resourceId);
      }
      return;
    }

    if (resourceType === "PAGE_ACTIVATION_POLICY") {
      const result = rollback(
        store.pageActivationPolicies,
        "PAGE_ACTIVATION_POLICY",
        "branch-east",
        (item) => `页面启用策略-${item.pageResourceId}`
      );
      store.pageActivationPolicies = result.items;
      if (result.target) {
        appendAuditLog(
          "ROLLBACK",
          "PAGE_ACTIVATION_POLICY",
          `页面启用策略-${result.target.pageResourceId}`,
          operator,
          resourceId
        );
      }
      return;
    }

    if (resourceType === "PAGE_RESOURCE") {
      const result = rollback(store.pageResources, "PAGE_RESOURCE", "branch-east", (item) => item.name);
      store.pageResources = result.items;
      if (result.target) {
        appendAuditLog("ROLLBACK", "PAGE_RESOURCE", result.target.name, operator, resourceId);
      }
      return;
    }

    if (resourceType === "PREPROCESSOR") {
      const result = rollback(store.preprocessors, "PREPROCESSOR", "branch-east", (item) => item.name);
      store.preprocessors = result.items;
      if (result.target) {
        appendAuditLog("ROLLBACK", "PREPROCESSOR", result.target.name, operator, resourceId);
      }
    }
  },

  async listAuditLogs(): Promise<PublishAuditLog[]> {
    await sleep(140);
    return clone(store.auditLogs);
  },

  async listTriggerLogs(): Promise<TriggerLogItem[]> {
    await sleep(140);
    return clone(store.triggerLogs);
  },

  async listExecutionLogs(): Promise<ExecutionLogItem[]> {
    await sleep(140);
    return clone(store.executionLogs);
  },

  async listFailureReasonMetrics(): Promise<FailureReasonMetric[]> {
    await sleep(120);
    const failed = store.executionLogs.filter((item) => item.result === "FAILED");
    if (failed.length === 0) {
      return [];
    }
    const grouped = new Map<string, number>();
    for (const item of failed) {
      grouped.set(item.reason, (grouped.get(item.reason) ?? 0) + 1);
    }
    return Array.from(grouped.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        ratio: Number(((count / failed.length) * 100).toFixed(1))
      }))
      .sort((a, b) => b.count - a.count);
  },

  async listRoles(): Promise<RoleItem[]> {
    await sleep(120);
    return clone(store.roles);
  },

  async upsertRole(
    payload: Omit<RoleItem, "updatedAt" | "memberCount"> & { memberCount?: number; updatedAt?: string }
  ): Promise<RoleItem> {
    await sleep(140);
    const exists = store.roles.find((item) => item.id === payload.id);
    if (!store.roleMembers[payload.id]) {
      store.roleMembers[payload.id] = [];
    }
    const memberCount = store.roleMembers[payload.id]?.length ?? payload.memberCount ?? 0;
    const next: RoleItem = {
      ...payload,
      memberCount,
      updatedAt: payload.updatedAt ?? nowIso()
    };
    store.roles = exists ? store.roles.map((item) => (item.id === next.id ? next : item)) : [next, ...store.roles];
    appendAuditLog("ROLE_UPDATE", "ROLE", next.name, "person-business-admin", next.id);
    return clone(next);
  },

  async cloneRole(roleId: number): Promise<RoleItem> {
    await sleep(160);
    const source = store.roles.find((item) => item.id === roleId);
    if (!source) {
      throw new Error("Role does not exist; cannot clone.");
    }
    const cloned: RoleItem = {
      ...source,
      id: nextId(store.roles),
      name: `${source.name}-copy`,
      memberCount: 0,
      updatedAt: nowIso()
    };
    store.roles = [cloned, ...store.roles];
    store.roleMembers[cloned.id] = [];
    appendAuditLog("ROLE_UPDATE", "ROLE", cloned.name, "person-business-admin", cloned.id);
    return clone(cloned);
  },

  async toggleRoleStatus(roleId: number): Promise<void> {
    await sleep(120);
    store.roles = store.roles.map((role) => {
      if (role.id !== roleId) {
        return role;
      }
      return {
        ...role,
        status: role.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
        updatedAt: nowIso()
      };
    });
  },

  async listRoleMembers(roleId: number): Promise<string[]> {
    await sleep(100);
    return clone(store.roleMembers[roleId] ?? []);
  },

  async assignRoleMembers(roleId: number, members: string[]): Promise<void> {
    await sleep(140);
    const normalized = Array.from(new Set(members.map((name) => name.trim()).filter(Boolean)));
    store.roleMembers[roleId] = normalized;
    store.roles = store.roles.map((role) =>
      role.id === roleId ? { ...role, memberCount: normalized.length, updatedAt: nowIso() } : role
    );

    const role = store.roles.find((item) => item.id === roleId);
    if (role) {
      appendAuditLog("ROLE_UPDATE", "ROLE", role.name, "person-business-admin", role.id);
    }
  }
};




