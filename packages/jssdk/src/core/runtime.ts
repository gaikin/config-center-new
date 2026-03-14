import { createFetchRuntimeTransport } from "../client/runtimeApi";
import { collectFieldSnapshot, evaluateRules } from "../engine/ruleEngine";
import { PromptController } from "../prompt/promptController";
import { TelemetryClient } from "../telemetry/telemetry";
import type {
  ConfigCenterSdkInit,
  PageBundle,
  PageContextResolveRequest,
  PageIndexEntry,
  RuntimeRule,
  RuntimeTransport,
  SdkStatus
} from "../types/runtime";

function getCurrentUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.href;
}

function collectMarkers() {
  if (typeof document === "undefined") {
    return {};
  }

  const markers: Record<string, string> = {};
  const pageRoot = document.querySelector<HTMLElement>("[data-page-code], [data-menu-code]");
  const pageCode = pageRoot?.dataset.pageCode;
  const menuCode = pageRoot?.dataset.menuCode;

  if (pageCode) {
    markers["data-page-code"] = pageCode;
  }
  if (menuCode) {
    markers["data-menu-code"] = menuCode;
  }

  return markers;
}

export class ConfigCenterSdkRuntime {
  private status: SdkStatus = "IDLE";
  private config: ConfigCenterSdkInit | null = null;
  private transport: RuntimeTransport | null = null;
  private pageIndex: PageIndexEntry | null = null;
  private bundle: PageBundle | null = null;
  private readonly promptController = new PromptController();
  private telemetry: TelemetryClient | null = null;
  private shownRuleIds = new Set<string>();

  getStatus() {
    return this.status;
  }

  async bootstrap(config: ConfigCenterSdkInit) {
    this.config = config;
    this.transport = config.transport ?? createFetchRuntimeTransport(config);
    this.telemetry = new TelemetryClient(
      this.transport,
      () => ({
        bundleVersion: this.bundle?.bundleVersion,
        pageResourceId: this.bundle?.pageResourceId,
        sdkVersion: "0.1.0"
      }),
      config.debug ?? false
    );

    this.shownRuleIds.clear();
    await this.start();
  }

  async refresh() {
    if (!this.config || !this.transport) {
      return;
    }
    this.promptController.destroy();
    await this.start();
  }

  destroy() {
    this.promptController.destroy();
    this.bundle = null;
    this.pageIndex = null;
    this.shownRuleIds.clear();
    this.status = "DESTROYED";
  }

  private async start() {
    const transport = this.transport;
    const config = this.config;
    const telemetry = this.telemetry;

    if (!transport || !config || !telemetry) {
      return;
    }

    try {
      this.status = "BOOTSTRAPPING";
      this.status = "RESOLVING_PAGE";
      const request = this.buildResolveRequest(config);
      const resolvedPage = await transport.resolvePageContext(request);

      if (!resolvedPage) {
        this.status = "DEGRADED";
        await telemetry.track("PAGE_RESOLVE_FAILED", { reason: "Page context not resolved" });
        return;
      }

      await telemetry.track("PAGE_RESOLVED", {
        pageResourceId: resolvedPage.pageId
      });

      this.pageIndex = transport.getPageIndex ? await transport.getPageIndex(resolvedPage) : null;
      if (this.pageIndex && !this.pageIndex.enablePrompt && !this.pageIndex.hasJobScenes) {
        this.status = "READY";
        return;
      }

      this.bundle = await transport.getPageBundle(resolvedPage.pageId, this.pageIndex);
      await telemetry.track("BUNDLE_LOADED", {
        bundleVersion: this.bundle.bundleVersion,
        pageResourceId: this.bundle.pageResourceId
      });

      await this.evaluateBundle();
    } catch (error) {
      this.status = "DEGRADED";
      await telemetry.track("SDK_DEGRADED", {
        reason: error instanceof Error ? error.message : "Unknown runtime error"
      });
    }
  }

  private buildResolveRequest(config: ConfigCenterSdkInit): PageContextResolveRequest {
    const pageContext = config.pageContextProvider?.();
    return {
      siteCode: config.siteCode,
      url: getCurrentUrl(),
      regionId: pageContext?.regionId,
      menuCode: pageContext?.menuCode,
      pageCode: pageContext?.pageCode,
      moduleCode: pageContext?.moduleCode,
      frameCode: pageContext?.frameCode,
      route: pageContext?.route ?? (typeof window === "undefined" ? undefined : window.location.pathname),
      markers: collectMarkers()
    };
  }

  private async evaluateBundle() {
    if (!this.bundle || !this.telemetry) {
      this.status = "READY";
      return;
    }

    this.status = "EVALUATING";
    const snapshot = collectFieldSnapshot(this.bundle.pageFields);
    const matchedResult = evaluateRules(this.bundle.rules, snapshot).find(
      (result) => result.matched && result.rule.prompt && !this.shownRuleIds.has(result.rule.ruleId)
    );

    if (!matchedResult) {
      this.status = "READY";
      return;
    }

    const rule = matchedResult.rule;
    this.shownRuleIds.add(rule.ruleId);
    await this.telemetry.track("RULE_MATCHED", {
      ruleId: rule.ruleId
    });

    await this.showPrompt(rule);
  }

  private async showPrompt(rule: RuntimeRule) {
    if (!rule.prompt || !this.telemetry || !this.transport) {
      this.status = "READY";
      return;
    }

    this.status = "PROMPTING";
    await this.telemetry.track("PROMPT_SHOWN", {
      ruleId: rule.ruleId,
      traceId: rule.prompt.traceId
    });

    this.promptController.show(rule.prompt, {
      onClose: () => {
        void this.handlePromptClose(rule);
      },
      onConfirm: rule.prompt.confirmText
        ? () => {
            void this.handlePromptConfirm(rule);
          }
        : undefined
    });
  }

  private async handlePromptClose(rule: RuntimeRule) {
    if (!rule.prompt || !this.transport || !this.telemetry) {
      return;
    }

    this.promptController.destroy();
    await this.transport.closePrompt(rule.prompt.traceId);
    await this.telemetry.track("PROMPT_CLOSED", {
      ruleId: rule.ruleId,
      traceId: rule.prompt.traceId
    });
    this.status = "READY";
  }

  private async handlePromptConfirm(rule: RuntimeRule) {
    if (!rule.prompt || !this.transport || !this.telemetry) {
      return;
    }

    this.promptController.destroy();
    await this.transport.confirmPrompt(rule.prompt.traceId);
    await this.telemetry.track("PROMPT_CONFIRMED", {
      ruleId: rule.ruleId,
      traceId: rule.prompt.traceId
    });
    this.status = "READY";
  }
}
