import type {
  ConfigCenterSdkInit,
  PageBundle,
  PageContextResolveRequest,
  PageIndexEntry,
  ResolvedPageContext,
  RuntimeEvent,
  RuntimeTransport
} from "../types/runtime";

interface ApiEnvelope<T> {
  code: string;
  message: string;
  traceId?: string;
  data: T;
}

function buildUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T> | T;
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return payload.data;
  }
  return payload as T;
}

export function createFetchRuntimeTransport(config: Pick<ConfigCenterSdkInit, "authProvider" | "baseUrl">): RuntimeTransport {
  async function request<T>(path: string, init: RequestInit): Promise<T> {
    const token = await Promise.resolve(config.authProvider());
    const response = await fetch(buildUrl(config.baseUrl, path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      throw new Error(`Runtime request failed: ${response.status}`);
    }
    return readJson<T>(response);
  }

  return {
    resolvePageContext(requestBody: PageContextResolveRequest) {
      return request<ResolvedPageContext | null>("/api/runtime/page-context/resolve", {
        method: "POST",
        body: JSON.stringify(requestBody)
      });
    },
    async getPageIndex(resolvedPage: ResolvedPageContext) {
      if (!resolvedPage.pageIndexUrl) {
        return null;
      }
      const response = await fetch(buildUrl(config.baseUrl, resolvedPage.pageIndexUrl));
      if (!response.ok) {
        throw new Error(`Page index request failed: ${response.status}`);
      }
      return readJson<PageIndexEntry>(response);
    },
    getPageBundle(pageId: string) {
      return request<PageBundle>(`/api/runtime/pages/${pageId}/bundle`, {
        method: "GET"
      });
    },
    closePrompt(traceId: string) {
      return request<void>(`/api/runtime/prompts/${traceId}/close`, {
        method: "POST"
      });
    },
    confirmPrompt(traceId: string) {
      return request<void>(`/api/runtime/prompts/${traceId}/confirm`, {
        method: "POST"
      });
    },
    reportEvents(events: RuntimeEvent[]) {
      return request<void>("/api/runtime/events", {
        method: "POST",
        body: JSON.stringify({ events })
      });
    }
  };
}
