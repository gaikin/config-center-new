import { describe, expect, it } from "vitest";
import {
  resolveEffectiveVersion,
  validateMenuSdkPolicy,
  validatePlatformRuntimeConfig
} from "./sdkGovernance";
import type { MenuSdkPolicy, PlatformRuntimeConfig } from "./types";

const platformConfig: PlatformRuntimeConfig = {
  promptStableVersion: "1.3.0",
  promptGrayDefaultVersion: "1.4.0-rc.2",
  jobStableVersion: "2.1.0",
  jobGrayDefaultVersion: "2.2.0-rc.1",
  updatedAt: "2026-03-18T00:00:00.000Z",
  updatedBy: "platform-admin"
};

const basePolicy: MenuSdkPolicy = {
  id: 1,
  siteId: 1,
  regionId: 11,
  menuId: 101,
  menuCode: "loan_apply",
  promptGrayEnabled: true,
  promptGrayVersion: "1.4.0-rc.2",
  promptGrayOrgIds: ["branch-east"],
  jobGrayEnabled: true,
  jobGrayVersion: "2.2.0-rc.1",
  jobGrayOrgIds: ["branch-east"],
  effectiveStart: "2026-03-10 00:00",
  effectiveEnd: "2026-03-31 23:59",
  status: "ACTIVE",
  ownerOrgId: "head-office",
  updatedAt: "2026-03-18T00:00:00.000Z"
};

describe("sdkGovernance resolveEffectiveVersion", () => {
  it("uses prompt gray version when prompt gray is hit", () => {
    const result = resolveEffectiveVersion({
      policy: basePolicy,
      capability: "PROMPT",
      orgId: "branch-east",
      nowAt: "2026-03-18 10:00",
      platformConfig
    });
    expect(result.source).toBe("MENU_GRAY");
    expect(result.version).toBe("1.4.0-rc.2");
    expect(result.grayHit).toBe(true);
  });

  it("falls back to prompt stable version when prompt gray is not hit", () => {
    const result = resolveEffectiveVersion({
      policy: basePolicy,
      capability: "PROMPT",
      orgId: "branch-south",
      nowAt: "2026-03-18 10:00",
      platformConfig
    });
    expect(result.source).toBe("PLATFORM_STABLE");
    expect(result.version).toBe("1.3.0");
    expect(result.grayHit).toBe(false);
  });

  it("uses job gray version when job gray is hit", () => {
    const result = resolveEffectiveVersion({
      policy: basePolicy,
      capability: "JOB",
      orgId: "branch-east",
      nowAt: "2026-03-18 10:00",
      platformConfig
    });
    expect(result.source).toBe("MENU_GRAY");
    expect(result.version).toBe("2.2.0-rc.1");
    expect(result.grayHit).toBe(true);
  });

  it("falls back to job stable version when job gray is out of window", () => {
    const result = resolveEffectiveVersion({
      policy: basePolicy,
      capability: "JOB",
      orgId: "branch-east",
      nowAt: "2026-04-01 00:00",
      platformConfig
    });
    expect(result.source).toBe("PLATFORM_STABLE");
    expect(result.version).toBe("2.1.0");
    expect(result.grayHit).toBe(false);
  });
});

describe("sdkGovernance validation", () => {
  it("rejects empty stable versions", () => {
    const result = validatePlatformRuntimeConfig({
      promptStableVersion: "",
      jobStableVersion: ""
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("智能提示正式版本不能为空");
    expect(result.errors).toContain("智能作业正式版本不能为空");
  });

  it("rejects invalid gray settings", () => {
    const result = validateMenuSdkPolicy({
      policy: {
        ...basePolicy,
        promptGrayVersion: "1.3.0",
        jobGrayEnabled: true,
        jobGrayVersion: "",
        jobGrayOrgIds: [],
        effectiveStart: "2026-04-01 00:00",
        effectiveEnd: "2026-03-01 00:00"
      },
      platformConfig,
      capabilityStatus: {
        promptStatus: "ENABLED",
        jobStatus: "DISABLED"
      }
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("提示灰度版本不能等于提示正式版本");
    expect(result.errors).toContain("开启作业灰度后必须配置灰度版本");
    expect(result.errors).toContain("开启作业灰度后至少选择一个灰度机构");
    expect(result.errors).toContain("菜单未开通智能作业能力，不能配置作业灰度");
    expect(result.errors).toContain("灰度时间窗不合法");
  });
});
