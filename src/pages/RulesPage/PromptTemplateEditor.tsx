import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { parsePromptTemplateSegments } from "../../promptContent";
import type { PromptVariableOption } from "./rulesPageShared";

export type PromptTemplateEditorHandle = {
  focus: () => void;
  insertVariable: (variableKey: string) => void;
};

type PromptTemplateEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  variableOptions: PromptVariableOption[];
  placeholder?: string;
};

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const token = element.dataset.templateToken;
  if (token) {
    return token;
  }

  if (element.tagName === "BR") {
    return "\n";
  }

  return Array.from(element.childNodes).map(serializeNode).join("");
}

function serializeEditor(editor: HTMLElement) {
  return Array.from(editor.childNodes).map(serializeNode).join("");
}

function buildRangePrefixLength(editor: HTMLElement, range: Range) {
  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(editor);
  prefixRange.setEnd(range.startContainer, range.startOffset);
  const fragment = prefixRange.cloneContents();
  return Array.from(fragment.childNodes).map(serializeNode).join("").length;
}

function getSelectionIndex(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) && range.startContainer !== editor) {
    return null;
  }
  return buildRangePrefixLength(editor, range);
}

function getRangeFromPoint(x: number, y: number) {
  const documentWithCaret = document as Document & {
    caretPositionFromPoint?: (clientX: number, clientY: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (clientX: number, clientY: number) => Range | null;
  };

  if (documentWithCaret.caretPositionFromPoint) {
    const position = documentWithCaret.caretPositionFromPoint(x, y);
    if (!position) {
      return null;
    }
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  return documentWithCaret.caretRangeFromPoint?.(x, y) ?? null;
}

function restoreSelectionByIndex(editor: HTMLElement, index: number) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  let remaining = index;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const length = currentNode.textContent?.length ?? 0;
      if (remaining <= length) {
        const range = document.createRange();
        range.setStart(currentNode, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= length;
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const element = currentNode as HTMLElement;
      const token = element.dataset.templateToken;
      if (token) {
        if (remaining <= token.length) {
          const range = document.createRange();
          range.setStartAfter(element);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        remaining -= token.length;
      }
    }
    currentNode = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function renderTemplate(
  editor: HTMLElement,
  value: string,
  variableMap: Map<string, PromptVariableOption>
) {
  const fragment = document.createDocumentFragment();
  const segments = parsePromptTemplateSegments(value);

  if (segments.length === 0) {
    fragment.appendChild(document.createTextNode(""));
  }

  for (const segment of segments) {
    if (segment.type === "text") {
      fragment.appendChild(document.createTextNode(segment.value));
      continue;
    }

    const variable = variableMap.get(segment.key);
    const badge = document.createElement("span");
    badge.contentEditable = "false";
    badge.dataset.templateToken = segment.raw;
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.padding = "1px 8px";
    badge.style.margin = "0 2px";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = "12px";
    badge.style.lineHeight = "20px";
    badge.style.border = variable ? "1px solid #91CAFF" : "1px solid #FDA29B";
    badge.style.background = variable ? "#EFF8FF" : "#FEF3F2";
    badge.style.color = variable ? "#175CD3" : "#B42318";
    badge.style.cursor = "grab";
    badge.textContent = variable?.label ?? segment.key;
    fragment.appendChild(badge);
  }

  editor.replaceChildren(fragment);
}

export const PromptTemplateEditor = forwardRef<PromptTemplateEditorHandle, PromptTemplateEditorProps>(function PromptTemplateEditor(
  { value, onChange, variableOptions, placeholder },
  ref
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const pendingSelectionIndexRef = useRef<number | null>(null);
  const variableMap = useMemo(() => new Map(variableOptions.map((item) => [item.key, item])), [variableOptions]);

  function syncSelectionIndex() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    pendingSelectionIndexRef.current = getSelectionIndex(editor);
  }

  function updateValue(nextValue: string, nextSelectionIndex?: number) {
    if (typeof nextSelectionIndex === "number") {
      pendingSelectionIndexRef.current = nextSelectionIndex;
    }
    onChange(nextValue);
  }

  function insertTokenAtIndex(token: string, index?: number) {
    const currentValue = value ?? "";
    const safeIndex = Math.max(0, Math.min(index ?? currentValue.length, currentValue.length));
    updateValue(`${currentValue.slice(0, safeIndex)}${token}${currentValue.slice(safeIndex)}`, safeIndex + token.length);
  }

  useImperativeHandle(ref, () => ({
    focus() {
      editorRef.current?.focus();
    },
    insertVariable(variableKey: string) {
      const editor = editorRef.current;
      const token = `{{${variableKey}}}`;
      const selectionIndex = editor ? getSelectionIndex(editor) : null;
      insertTokenAtIndex(token, selectionIndex ?? value.length);
    }
  }), [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const current = serializeEditor(editor);
    if (current !== value) {
      renderTemplate(editor, value, variableMap);
    }
    if (typeof pendingSelectionIndexRef.current === "number") {
      restoreSelectionByIndex(editor, pendingSelectionIndexRef.current);
    }
  }, [value, variableMap]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      style={{
        minHeight: 132,
        padding: "8px 12px",
        border: "1px solid #d9d9d9",
        borderRadius: 8,
        whiteSpace: "pre-wrap",
        lineHeight: "22px",
        outline: "none"
      }}
      data-placeholder={placeholder ?? ""}
      onFocus={syncSelectionIndex}
      onKeyUp={syncSelectionIndex}
      onMouseUp={syncSelectionIndex}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        const editor = editorRef.current;
        const selectionIndex = editor ? getSelectionIndex(editor) : value.length;
        insertTokenAtIndex(text, selectionIndex ?? value.length);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const editor = editorRef.current;
          const selectionIndex = editor ? getSelectionIndex(editor) : value.length;
          insertTokenAtIndex("\n", selectionIndex ?? value.length);
        }
      }}
      onInput={() => {
        const editor = editorRef.current;
        if (!editor) {
          return;
        }
        pendingSelectionIndexRef.current = getSelectionIndex(editor);
        onChange(serializeEditor(editor));
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        const editor = editorRef.current;
        if (!editor) {
          return;
        }
        const range = getRangeFromPoint(event.clientX, event.clientY);
        if (!range || (!editor.contains(range.startContainer) && range.startContainer !== editor)) {
          return;
        }
        const selection = window.getSelection();
        if (!selection) {
          return;
        }
        selection.removeAllRanges();
        selection.addRange(range);
        pendingSelectionIndexRef.current = buildRangePrefixLength(editor, range);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const editor = editorRef.current;
        if (!editor) {
          return;
        }
        const token = event.dataTransfer.getData("text/plain");
        if (!token) {
          return;
        }
        const range = getRangeFromPoint(event.clientX, event.clientY);
        const index =
          range && (editor.contains(range.startContainer) || range.startContainer === editor)
            ? buildRangePrefixLength(editor, range)
            : (getSelectionIndex(editor) ?? value.length);
        insertTokenAtIndex(token, index);
      }}
    />
  );
});
