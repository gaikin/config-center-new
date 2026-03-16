import type { PromptContentConfig } from "./types";

export const DEFAULT_PROMPT_TITLE = "智能提示";

export type PromptTemplateSegment =
  | { type: "text"; value: string }
  | { type: "variable"; key: string; raw: string };

export function parsePromptContentConfig(raw: string | undefined | null): PromptContentConfig {
  if (!raw || !raw.trim()) {
    return {
      version: 1,
      titleSuffix: "",
      bodyTemplate: ""
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PromptContentConfig>;
    return {
      version: 1,
      titleSuffix: typeof parsed.titleSuffix === "string" ? parsed.titleSuffix : "",
      bodyTemplate: typeof parsed.bodyTemplate === "string" ? parsed.bodyTemplate : ""
    };
  } catch {
    return {
      version: 1,
      titleSuffix: "",
      bodyTemplate: ""
    };
  }
}

export function stringifyPromptContentConfig(config: {
  titleSuffix?: string;
  bodyTemplate?: string;
}): string {
  return JSON.stringify({
    version: 1,
    titleSuffix: config.titleSuffix?.trim() ?? "",
    bodyTemplate: config.bodyTemplate ?? ""
  } satisfies PromptContentConfig);
}

export function extractPromptTemplateKeys(template: string): string[] {
  const matched = template.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g);
  return Array.from(new Set(Array.from(matched, (item) => item[1])));
}

export function parsePromptTemplateSegments(template: string): PromptTemplateSegment[] {
  const segments: PromptTemplateSegment[] = [];
  const pattern = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let lastIndex = 0;

  for (const match of template.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: template.slice(lastIndex, index) });
    }
    segments.push({
      type: "variable",
      key: match[1],
      raw: match[0]
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < template.length) {
    segments.push({ type: "text", value: template.slice(lastIndex) });
  }

  return segments;
}

export function renderPromptTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`);
}
