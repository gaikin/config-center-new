import type {
  PageBundle,
  PageContextResolveRequest,
  PageIndexEntry,
  ResolvedPageContext,
  RuntimeEvent,
  RuntimeTransport
} from "../src/types/runtime";

interface ResolveFixtureMatchers {
  pageCodes?: string[];
  routes?: string[];
  markers?: Record<string, string>;
}

interface ResolveFixtureItem extends ResolvedPageContext {
  pageIndexUrl: string;
  matchers: ResolveFixtureMatchers;
}

interface ResolveFixtureDocument {
  pages: ResolveFixtureItem[];
}

export interface FixtureTransportOptions {
  basePath?: string;
  onEvents?: (events: RuntimeEvent[]) => void;
}

export interface RuleDebugArtifacts {
  resolveMap: ResolveFixtureDocument;
  resolvedPage: ResolvedPageContext | null;
  pageIndex: PageIndexEntry | null;
  pageBundle: PageBundle | null;
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Fixture request failed: ${response.status} ${path}`);
  }

  return (await response.json()) as T;
}

function matchPage(request: PageContextResolveRequest, page: ResolveFixtureItem) {
  if (request.pageCode && page.matchers.pageCodes?.includes(request.pageCode)) {
    return true;
  }

  if (request.route && page.matchers.routes?.includes(request.route)) {
    return true;
  }

  if (page.matchers.markers) {
    for (const [key, value] of Object.entries(page.matchers.markers)) {
      if (request.markers?.[key] === value) {
        return true;
      }
    }
  }

  return false;
}

async function loadResolveMap(basePath: string) {
  return readJson<ResolveFixtureDocument>(`${basePath}/resolve-map.json`);
}

export async function loadRuleDebugArtifacts(
  request: PageContextResolveRequest,
  basePath = "/demo/fixtures/runtime"
): Promise<RuleDebugArtifacts> {
  const resolveMap = await loadResolveMap(basePath);
  const resolvedPage = resolveMap.pages.find((page) => matchPage(request, page)) ?? null;
  const pageIndex = resolvedPage?.pageIndexUrl ? await readJson<PageIndexEntry>(resolvedPage.pageIndexUrl) : null;
  const pageBundle = resolvedPage
    ? await readJson<PageBundle>(pageIndex?.pageConfigUrl ?? `${basePath}/pages/${resolvedPage.pageId}.bundle.json`)
    : null;

  return {
    resolveMap,
    resolvedPage,
    pageIndex,
    pageBundle
  };
}

export function createMockRuntimeTransport(options: FixtureTransportOptions = {}): RuntimeTransport {
  const basePath = options.basePath ?? "/demo/fixtures/runtime";

  return {
    async resolvePageContext(request: PageContextResolveRequest) {
      const artifacts = await loadRuleDebugArtifacts(request, basePath);
      return artifacts.resolvedPage;
    },
    async getPageIndex(resolvedPage: ResolvedPageContext) {
      if (!resolvedPage.pageIndexUrl) {
        return null;
      }
      return readJson<PageIndexEntry>(resolvedPage.pageIndexUrl);
    },
    async getPageBundle(pageId: string, pageIndex?: PageIndexEntry | null) {
      return readJson<PageBundle>(pageIndex?.pageConfigUrl ?? `${basePath}/pages/${pageId}.bundle.json`);
    },
    async closePrompt() {},
    async confirmPrompt() {},
    async reportEvents(events: RuntimeEvent[]) {
      options.onEvents?.(events);
    }
  };
}
