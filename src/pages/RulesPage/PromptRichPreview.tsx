import type { CSSProperties, ReactNode } from "react";
import { parsePromptTemplateSegments, renderPromptTemplate } from "../../promptContent";

type PromptRichPreviewProps = {
  bodyTemplate: string;
  bodyEditorStateJson?: string;
  previewValues: Record<string, string>;
};

type SerializedLexicalNode = {
  type?: string;
  text?: string;
  style?: string;
  rawToken?: string;
  variableKey?: string;
  children?: SerializedLexicalNode[];
};

function parseStyle(styleText: string | undefined): CSSProperties {
  if (!styleText) {
    return {};
  }
  return styleText
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<CSSProperties>((acc, item) => {
      const [rawKey, rawValue] = item.split(":");
      if (!rawKey || !rawValue) {
        return acc;
      }
      const key = rawKey.trim();
      const value = rawValue.trim();
      if (key === "color") {
        acc.color = value;
      }
      return acc;
    }, {});
}

function renderNode(node: SerializedLexicalNode, previewValues: Record<string, string>, key: string): ReactNode {
  if (node.type === "template-variable") {
    return <span key={key}>{previewValues[node.variableKey ?? ""] ?? node.rawToken ?? ""}</span>;
  }

  if (node.type === "linebreak") {
    return <br key={key} />;
  }

  if (node.type === "text") {
    return (
      <span key={key} style={parseStyle(node.style)}>
        {node.text ?? ""}
      </span>
    );
  }

  if (Array.isArray(node.children)) {
    return (
      <span key={key}>
        {node.children.map((child, index) => renderNode(child, previewValues, `${key}-${index}`))}
      </span>
    );
  }

  return null;
}

function renderFallback(bodyTemplate: string, previewValues: Record<string, string>) {
  return parsePromptTemplateSegments(bodyTemplate).map((segment, index) => {
    if (segment.type === "text") {
      return <span key={`fallback-${index}`}>{segment.value}</span>;
    }
    return <span key={`fallback-${index}`}>{previewValues[segment.key] ?? renderPromptTemplate(segment.raw, previewValues)}</span>;
  });
}

export function PromptRichPreview({ bodyTemplate, bodyEditorStateJson, previewValues }: PromptRichPreviewProps) {
  if (!bodyEditorStateJson?.trim()) {
    return <>{renderFallback(bodyTemplate, previewValues)}</>;
  }

  try {
    const parsed = JSON.parse(bodyEditorStateJson) as { root?: { children?: SerializedLexicalNode[] } };
    const lines = parsed.root?.children ?? [];
    if (lines.length === 0) {
      return <>{renderFallback(bodyTemplate, previewValues)}</>;
    }

    return (
      <>
        {lines.map((line, index) => (
          <div key={`line-${index}`}>
            {Array.isArray(line.children) ? line.children.map((child, childIndex) => renderNode(child, previewValues, `${index}-${childIndex}`)) : null}
          </div>
        ))}
      </>
    );
  } catch {
    return <>{renderFallback(bodyTemplate, previewValues)}</>;
  }
}
