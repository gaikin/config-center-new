export type SdkEnv = "PROD" | "TEST";

export type SdkStatus =
  | "IDLE"
  | "BOOTSTRAPPING"
  | "RESOLVING_PAGE"
  | "READY"
  | "EVALUATING"
  | "PROMPTING"
  | "DEGRADED"
  | "DESTROYED";

export type RuntimeModule = "core" | "prompt" | "job" | "preview";
export type FieldScope = "COMMON" | "PAGE_LOCAL";
export type ElementType = "INPUT" | "SELECT" | "TEXTAREA" | "BUTTON" | "READONLY_TEXT";
export type FieldState = "ABSENT" | "EMPTY" | "VALUE";
export type Normalizer = "trim" | "digitsOnly";
export type PromptMode = "SILENT" | "FLOATING";
export type EvaluationMode = "INIT_ONCE" | "INIT_AND_REACTIVE" | "MANUAL_REFRESH";
export type ConditionOperator =
  | "EQ"
  | "NE"
  | "GT"
  | "GE"
  | "LT"
  | "LE"
  | "CONTAINS"
  | "EXISTS";

export interface PageContextValue {
  regionId?: string;
  menuCode?: string;
  pageCode?: string;
  moduleCode?: string;
  frameCode?: string;
  route?: string;
}

export interface PageContextResolveRequest {
  siteCode: string;
  url: string;
  regionId?: string;
  menuCode?: string;
  pageCode?: string;
  moduleCode?: string;
  frameCode?: string;
  route?: string;
  markers?: Record<string, string>;
}

export interface ResolvedPageContext {
  pageId: string;
  pageCode: string;
  menuCode?: string;
  regionId?: string;
  route?: string;
  matchedBy: "PAGE_CODE" | "MARKER" | "URL" | "UNKNOWN";
  pageIndexUrl?: string;
}

export interface RuntimeManifest {
  sdkVersion: string;
  releaseIndexUrl?: string;
  pageIndexUrl?: string;
  modules?: Partial<Record<RuntimeModule, string>>;
  compatibility?: string;
}

export interface PageIndexEntry {
  pageCode: string;
  routePatterns?: string[];
  enablePrompt: boolean;
  hasJobScenes: boolean;
  needPreviewSupport?: boolean;
  requiredModules: RuntimeModule[];
  pageConfigUrl?: string;
}

export interface FieldLocator {
  selectorType: "CSS";
  selector: string;
  attribute?: string;
}

export interface FieldValue {
  state: FieldState;
  value?: string;
}

export interface RuntimeFieldDefinition {
  fieldKey: string;
  fieldScope: FieldScope;
  elementType: ElementType;
  locator: FieldLocator;
  readable: boolean;
  writable: boolean;
  watchable: boolean;
  extractor?: "value" | "textContent";
  normalizers?: Normalizer[];
}

export interface RuntimeOperand {
  sourceType: "PAGE_FIELD" | "CONST";
  fieldKey?: string;
  value?: string;
}

export interface RuntimeCondition {
  id: string;
  left: RuntimeOperand;
  operator: ConditionOperator;
  right?: RuntimeOperand;
}

export interface RuntimePromptDefinition {
  traceId: string;
  promptMode: PromptMode;
  title: string;
  content: string;
  confirmText?: string;
  closeText?: string;
}

export interface RuntimeRule {
  ruleId: string;
  name: string;
  priority?: number;
  evaluationMode: EvaluationMode;
  logicType: "AND" | "OR";
  watchFields: string[];
  debounceMs?: number;
  maxTriggerPerPageSession?: number;
  conditions: RuntimeCondition[];
  prompt?: RuntimePromptDefinition;
}

export interface PageBundle {
  bundleVersion: string;
  etag?: string;
  pageResourceId: string;
  pageFields: RuntimeFieldDefinition[];
  rules: RuntimeRule[];
  sceneRefs: string[];
  floatingEntryAvailable: boolean;
}

export interface RuleEvaluationResult {
  rule: RuntimeRule;
  matched: boolean;
  failedConditionIds: string[];
}

export type RuntimeEventType =
  | "PAGE_RESOLVED"
  | "PAGE_RESOLVE_FAILED"
  | "BUNDLE_LOADED"
  | "RULE_MATCHED"
  | "PROMPT_SHOWN"
  | "PROMPT_CLOSED"
  | "PROMPT_CONFIRMED"
  | "SDK_DEGRADED";

export interface RuntimeEvent {
  type: RuntimeEventType;
  createdAt: string;
  traceId?: string;
  sdkVersion?: string;
  bundleVersion?: string;
  pageResourceId?: string;
  ruleId?: string;
  reason?: string;
  latencyMs?: number;
}

export interface RuntimeTransport {
  resolvePageContext(request: PageContextResolveRequest): Promise<ResolvedPageContext | null>;
  getPageIndex?(resolvedPage: ResolvedPageContext): Promise<PageIndexEntry | null>;
  getPageBundle(pageId: string, pageIndex?: PageIndexEntry | null): Promise<PageBundle>;
  closePrompt(traceId: string): Promise<void>;
  confirmPrompt(traceId: string): Promise<void>;
  reportEvents(events: RuntimeEvent[]): Promise<void>;
}

export interface ConfigCenterSdkInit {
  baseUrl: string;
  assetBaseUrl?: string;
  siteCode: string;
  env?: SdkEnv;
  autoStart?: boolean;
  authProvider: () => Promise<string> | string;
  userContextProvider?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  pageMetaProvider?: () => Record<string, unknown>;
  pageContextProvider?: () => PageContextValue | undefined;
  debug?: boolean;
  transport?: RuntimeTransport;
}
