import ConfigCenterSDK from "../src/index";
import { collectFieldSnapshot, evaluateRules } from "../src/engine/ruleEngine";
import type { PageContextResolveRequest } from "../src/types/runtime";
import { createMockRuntimeTransport, loadRuleDebugArtifacts } from "./mockRuntimeTransport";

const statusElement = document.querySelector<HTMLDivElement>("#status");
const eventsElement = document.querySelector<HTMLPreElement>("#events");
const matchSummaryElement = document.querySelector<HTMLDivElement>("#matchSummary");
const resolvedPageElement = document.querySelector<HTMLPreElement>("#resolvedPage");
const pageIndexElement = document.querySelector<HTMLPreElement>("#pageIndex");
const bundleElement = document.querySelector<HTMLPreElement>("#bundle");
const snapshotElement = document.querySelector<HTMLPreElement>("#snapshot");
const evaluationElement = document.querySelector<HTMLPreElement>("#evaluation");
const bootstrapButton = document.querySelector<HTMLButtonElement>("#bootstrap");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh");
const evaluateButton = document.querySelector<HTMLButtonElement>("#evaluate");
const destroyButton = document.querySelector<HTMLButtonElement>("#destroy");
const fieldInputs = Array.from(document.querySelectorAll<HTMLInputElement>("#customerName, #loanAmount"));

const eventLog: string[] = [];
const fixtureBasePath = "/demo/fixtures/runtime";

function renderStatus() {
  if (statusElement) {
    statusElement.textContent = ConfigCenterSDK.getStatus();
  }
}

function renderJson(target: HTMLPreElement | null, value: unknown) {
  if (target) {
    target.textContent = JSON.stringify(value, null, 2);
  }
}

function appendEvents(entries: string[]) {
  eventLog.unshift(...entries);
  if (eventsElement) {
    eventsElement.textContent = eventLog.slice(0, 12).join("\n\n");
  }
}

function buildResolveRequest(): PageContextResolveRequest {
  return {
    siteCode: "kaiyang",
    url: window.location.href,
    regionId: "retail",
    menuCode: "loan_apply",
    pageCode: "loan_apply",
    route: "/loan/apply",
    markers: {
      "data-page-code": "loan_apply",
      "data-menu-code": "loan_apply"
    }
  };
}

async function renderRuleDebugState() {
  const artifacts = await loadRuleDebugArtifacts(buildResolveRequest(), fixtureBasePath);
  renderJson(resolvedPageElement, artifacts.resolvedPage);
  renderJson(pageIndexElement, artifacts.pageIndex);
  renderJson(bundleElement, artifacts.pageBundle);

  if (!artifacts.pageBundle) {
    renderJson(snapshotElement, null);
    renderJson(evaluationElement, null);
    if (matchSummaryElement) {
      matchSummaryElement.textContent = "当前页面未命中任何 runtime fixture。";
    }
    return;
  }

  const snapshot = collectFieldSnapshot(artifacts.pageBundle.pageFields);
  const evaluation = evaluateRules(artifacts.pageBundle.rules, snapshot);
  const firstMatched = evaluation.find((item) => item.matched);

  renderJson(snapshotElement, snapshot);
  renderJson(evaluationElement, evaluation);

  if (matchSummaryElement) {
    matchSummaryElement.textContent = firstMatched
      ? `命中规则：${firstMatched.rule.name} (${firstMatched.rule.ruleId})`
      : "当前字段值未命中任何规则。";
  }
}

window.__CC_SDK_CONFIG__ = {
  baseUrl: "",
  siteCode: "kaiyang",
  env: "TEST",
  autoStart: false,
  authProvider: () => "Bearer demo-token",
  pageContextProvider: () => ({
    pageCode: "loan_apply",
    menuCode: "loan_apply",
    regionId: "retail",
    route: "/loan/apply"
  }),
  debug: true,
  transport: createMockRuntimeTransport({
    basePath: fixtureBasePath,
    onEvents: (events) => {
      appendEvents(events.map((event) => JSON.stringify(event, null, 2)));
      renderStatus();
      void renderRuleDebugState();
    }
  })
};

bootstrapButton?.addEventListener("click", () => {
  void ConfigCenterSDK.bootstrap(window.__CC_SDK_CONFIG__!).then(() => {
    renderStatus();
    return renderRuleDebugState();
  });
});

refreshButton?.addEventListener("click", () => {
  void ConfigCenterSDK.refresh().then(() => {
    renderStatus();
    return renderRuleDebugState();
  });
});

evaluateButton?.addEventListener("click", () => {
  void renderRuleDebugState();
});

destroyButton?.addEventListener("click", () => {
  ConfigCenterSDK.destroy();
  renderStatus();
  void renderRuleDebugState();
});

for (const input of fieldInputs) {
  input.addEventListener("input", () => {
    void renderRuleDebugState();
  });
}

renderStatus();
void renderRuleDebugState();
