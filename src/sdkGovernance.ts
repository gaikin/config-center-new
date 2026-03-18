import type { CapabilityOpenStatus, MenuSdkPolicy, PlatformRuntimeConfig } from "./types";

export type SdkCapability = "PROMPT" | "JOB";
export type EffectiveVersionSource = "MENU_GRAY" | "PLATFORM_STABLE";

export interface MenuSdkPolicyValidationInput {
  policy: Pick<
    MenuSdkPolicy,
    | "effectiveStart"
    | "effectiveEnd"
    | "promptGrayEnabled"
    | "promptGrayVersion"
    | "promptGrayOrgIds"
    | "jobGrayEnabled"
    | "jobGrayVersion"
    | "jobGrayOrgIds"
  >;
  platformConfig: Pick<
    PlatformRuntimeConfig,
    "promptStableVersion" | "jobStableVersion"
  >;
  capabilityStatus?: {
    promptStatus: CapabilityOpenStatus;
    jobStatus: CapabilityOpenStatus;
  };
}

export interface EffectiveVersionResult {
  capability: SdkCapability;
  version: string;
  source: EffectiveVersionSource;
  grayHit: boolean;
}

function normalizeVersion(version: string | undefined) {
  const normalized = version?.trim();
  return normalized ? normalized : undefined;
}

function isTimeWindowValid(effectiveStart: string, effectiveEnd: string) {
  return effectiveStart.trim() !== "" && effectiveEnd.trim() !== "" && effectiveStart <= effectiveEnd;
}

function isGrayConfigured(
  enabled: boolean,
  version: string | undefined,
  orgIds: string[]
) {
  return enabled && Boolean(normalizeVersion(version)) && orgIds.length > 0;
}

export function validatePlatformRuntimeConfig(
  config: Pick<PlatformRuntimeConfig, "promptStableVersion" | "jobStableVersion">
) {
  const errors: string[] = [];
  if (!normalizeVersion(config.promptStableVersion)) {
    errors.push("智能提示正式版本不能为空");
  }
  if (!normalizeVersion(config.jobStableVersion)) {
    errors.push("智能作业正式版本不能为空");
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateMenuSdkPolicy(input: MenuSdkPolicyValidationInput) {
  const { policy, platformConfig, capabilityStatus } = input;
  const errors: string[] = [];

  if (!isTimeWindowValid(policy.effectiveStart, policy.effectiveEnd)) {
    errors.push("灰度时间窗不合法");
  }

  const promptVersion = normalizeVersion(policy.promptGrayVersion);
  const jobVersion = normalizeVersion(policy.jobGrayVersion);

  if (policy.promptGrayEnabled) {
    if (capabilityStatus && capabilityStatus.promptStatus !== "ENABLED") {
      errors.push("菜单未开通智能提示能力，不能配置提示灰度");
    }
    if (!promptVersion) {
      errors.push("开启提示灰度后必须配置灰度版本");
    }
    if (policy.promptGrayOrgIds.length === 0) {
      errors.push("开启提示灰度后至少选择一个灰度机构");
    }
    if (promptVersion && promptVersion === normalizeVersion(platformConfig.promptStableVersion)) {
      errors.push("提示灰度版本不能等于提示正式版本");
    }
  }

  if (policy.jobGrayEnabled) {
    if (capabilityStatus && capabilityStatus.jobStatus !== "ENABLED") {
      errors.push("菜单未开通智能作业能力，不能配置作业灰度");
    }
    if (!jobVersion) {
      errors.push("开启作业灰度后必须配置灰度版本");
    }
    if (policy.jobGrayOrgIds.length === 0) {
      errors.push("开启作业灰度后至少选择一个灰度机构");
    }
    if (jobVersion && jobVersion === normalizeVersion(platformConfig.jobStableVersion)) {
      errors.push("作业灰度版本不能等于作业正式版本");
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function isCapabilityGrayConfigured(
  policy: MenuSdkPolicy,
  capability: SdkCapability
) {
  if (capability === "PROMPT") {
    return isGrayConfigured(policy.promptGrayEnabled, policy.promptGrayVersion, policy.promptGrayOrgIds);
  }
  return isGrayConfigured(policy.jobGrayEnabled, policy.jobGrayVersion, policy.jobGrayOrgIds);
}

export function isCapabilityGrayHit(params: {
  policy: MenuSdkPolicy;
  capability: SdkCapability;
  orgId: string;
  nowAt: string;
}) {
  const { policy, capability, orgId, nowAt } = params;

  if (!(policy.effectiveStart <= nowAt && nowAt <= policy.effectiveEnd)) {
    return false;
  }

  if (capability === "PROMPT") {
    return (
      policy.promptGrayEnabled &&
      Boolean(normalizeVersion(policy.promptGrayVersion)) &&
      policy.promptGrayOrgIds.includes(orgId)
    );
  }

  return (
    policy.jobGrayEnabled &&
    Boolean(normalizeVersion(policy.jobGrayVersion)) &&
    policy.jobGrayOrgIds.includes(orgId)
  );
}

export function resolveEffectiveVersion(params: {
  policy?: MenuSdkPolicy | null;
  capability: SdkCapability;
  orgId: string;
  nowAt: string;
  platformConfig: Pick<
    PlatformRuntimeConfig,
    "promptStableVersion" | "jobStableVersion"
  >;
}): EffectiveVersionResult {
  const { policy, capability, orgId, nowAt, platformConfig } = params;
  const stableVersion = capability === "PROMPT" ? platformConfig.promptStableVersion : platformConfig.jobStableVersion;

  if (!policy) {
    return {
      capability,
      version: stableVersion,
      source: "PLATFORM_STABLE",
      grayHit: false
    };
  }

  const grayHit = isCapabilityGrayHit({
    policy,
    capability,
    orgId,
    nowAt
  });

  if (grayHit) {
    const grayVersion = capability === "PROMPT" ? policy.promptGrayVersion : policy.jobGrayVersion;
    const normalizedGrayVersion = normalizeVersion(grayVersion);
    if (normalizedGrayVersion) {
      return {
        capability,
        version: normalizedGrayVersion,
        source: "MENU_GRAY",
        grayHit: true
      };
    }
  }

  return {
    capability,
    version: stableVersion,
    source: "PLATFORM_STABLE",
    grayHit: false
  };
}

export function buildPolicyResolutionSummary(
  policy: MenuSdkPolicy,
  platformConfig: Pick<
    PlatformRuntimeConfig,
    "promptStableVersion" | "jobStableVersion"
  >
) {
  const promptSummary = isCapabilityGrayConfigured(policy, "PROMPT")
    ? `提示灰度:${policy.promptGrayOrgIds.join("、")} -> ${policy.promptGrayVersion}`
    : `提示正式:${platformConfig.promptStableVersion}`;
  const jobSummary = isCapabilityGrayConfigured(policy, "JOB")
    ? `作业灰度:${policy.jobGrayOrgIds.join("、")} -> ${policy.jobGrayVersion}`
    : `作业正式:${platformConfig.jobStableVersion}`;
  return `${promptSummary}；${jobSummary}`;
}
