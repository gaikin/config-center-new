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
      bodyTemplate: "",
      bodyEditorStateJson: ""
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PromptContentConfig>;
    return {
      version: 1,
      titleSuffix: typeof parsed.titleSuffix === "string" ? parsed.titleSuffix : "",
      bodyTemplate: typeof parsed.bodyTemplate === "string" ? parsed.bodyTemplate : "",
      bodyEditorStateJson: typeof parsed.bodyEditorStateJson === "string" ? parsed.bodyEditorStateJson : ""
    };
  } catch {
    return {
      version: 1,
      titleSuffix: "",
      bodyTemplate: "",
      bodyEditorStateJson: ""
    };
  }
}

export function stringifyPromptContentConfig(config: {
  titleSuffix?: string;
  bodyTemplate?: string;
  bodyEditorStateJson?: string;
}): string {
  return JSON.stringify({
    version: 1,
    titleSuffix: config.titleSuffix?.trim() ?? "",
    bodyTemplate: config.bodyTemplate ?? "",
    bodyEditorStateJson: config.bodyEditorStateJson ?? ""
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

type SerializedPromptNode = {
  type?: string;
  text?: string;
  rawToken?: string;
  variableKey?: string;
  children?: SerializedPromptNode[];
};

function serializePromptEditorNode(node: SerializedPromptNode): string {
  if (node.type === "template-variable") {
    return node.rawToken || (node.variableKey ? `{{${node.variableKey}}}` : "");
  }
  if (node.type === "linebreak") {
    return "\n";
  }
  if (node.type === "text") {
    return (node.text ?? "").replaceAll("\u200B", "");
  }
  if (Array.isArray(node.children)) {
    const joiner = node.type === "root" ? "\n" : "";
    return node.children.map(serializePromptEditorNode).join(joiner);
  }
  return "";
}

function collectPromptEditorVariableIssues(node: SerializedPromptNode, availableKeys: string[], collector: string[]) {
  if (node.type === "template-variable") {
    const variableKey = node.variableKey ?? "";
    const expectedRawToken = variableKey ? `{{${variableKey}}}` : "";
    if (!variableKey || !availableKeys.includes(variableKey)) {
      collector.push(`存在未注册变量节点：${variableKey || "unknown"}`);
    }
    if ((node.rawToken ?? "") !== expectedRawToken) {
      collector.push(`变量节点已损坏：${variableKey || "unknown"}`);
    }
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => collectPromptEditorVariableIssues(child, availableKeys, collector));
  }
}

export function validatePromptEditorState(params: {
  bodyTemplate: string;
  bodyEditorStateJson?: string;
  availableVariableKeys?: string[];
}) {
  const issues: string[] = [];
  if (!params.bodyEditorStateJson?.trim()) {
    return issues;
  }

  try {
    const parsed = JSON.parse(params.bodyEditorStateJson) as { root?: SerializedPromptNode };
    const serializedTemplate = serializePromptEditorNode(parsed.root ?? { type: "root", children: [] });
    if (serializedTemplate !== params.bodyTemplate) {
      issues.push("编辑器内容与正文模板不一致，请重新整理标签后再保存");
    }
    if (params.availableVariableKeys && params.availableVariableKeys.length > 0) {
      collectPromptEditorVariableIssues(parsed.root ?? { type: "root", children: [] }, params.availableVariableKeys, issues);
    }
  } catch {
    issues.push("提示正文编辑状态已损坏，请重新编辑后再保存");
  }

  return Array.from(new Set(issues));
}
