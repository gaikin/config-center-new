import { ClearOutlined, FontColorsOutlined } from "@ant-design/icons";
import { $patchStyleText } from "@lexical/selection";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isTextNode,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  type EditorState,
  type LexicalEditor,
  type LexicalNode
} from "lexical";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type CSSProperties } from "react";
import { parsePromptTemplateSegments } from "../../promptContent";
import type { PromptVariableOption } from "./rulesPageShared";
import { $createTemplateVariableNode, $isTemplateVariableNode, TemplateVariableNode } from "./TemplateVariableNode";

export type PromptTemplateEditorHandle = {
  focus: () => void;
  insertVariable: (variableKey: string) => void;
};

type PromptTemplateEditorProps = {
  value: string;
  editorStateJson?: string;
  onChange: (nextValue: string, nextEditorStateJson: string) => void;
  variableOptions: PromptVariableOption[];
  placeholder?: string;
};

const COLOR_OPTIONS = [
  { label: "默认", value: "" },
  { label: "红", value: "#cf1322" },
  { label: "橙", value: "#d46b08" },
  { label: "蓝", value: "#175cd3" },
  { label: "绿", value: "#027a48" }
];
const VARIABLE_CURSOR_GUARD = "\u200B";

function serializeLexicalNode(node: LexicalNode): string {
  if ($isTemplateVariableNode(node)) {
    return node.getTextContent();
  }
  if ("getChildren" in node && typeof node.getChildren === "function") {
    return node.getChildren().map(serializeLexicalNode).join(node.getType() === "root" ? "\n" : "");
  }
  return node.getTextContent().replaceAll(VARIABLE_CURSOR_GUARD, "");
}

function serializeEditorTemplate() {
  const root = $getRoot();
  return root.getChildren().map(serializeLexicalNode).join("\n");
}

function appendTextSegment(target: ReturnType<typeof $createParagraphNode>, text: string) {
  const pieces = text.split("\n");
  pieces.forEach((piece, index) => {
    if (piece) {
      target.append($createTextNode(piece));
    }
    if (index < pieces.length - 1) {
      target.append($createLineBreakNode());
    }
  });
}

function buildEditorFromTemplate(value: string, variableMap: Map<string, PromptVariableOption>) {
  const root = $getRoot();
  root.clear();
  const lines = value.split("\n");

  if (lines.length === 0) {
    root.append($createParagraphNode());
    return;
  }

  for (const line of lines) {
    const paragraph = $createParagraphNode();
    for (const segment of parsePromptTemplateSegments(line)) {
      if (segment.type === "text") {
        appendTextSegment(paragraph, segment.value);
      } else {
        const variable = variableMap.get(segment.key);
        paragraph.append($createTemplateVariableNode(segment.key, variable?.label ?? segment.key, segment.raw));
        paragraph.append($createTextNode(VARIABLE_CURSOR_GUARD));
      }
    }
    root.append(paragraph);
  }
}

function normalizeVariableCursorGuards() {
  const root = $getRoot();
  for (const paragraph of root.getChildren()) {
    if (!("getChildren" in paragraph) || typeof paragraph.getChildren !== "function") {
      continue;
    }
    const children = paragraph.getChildren();
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (!$isTemplateVariableNode(child)) {
        continue;
      }
      const nextSibling = children[index + 1];
      if (!nextSibling || nextSibling.getTextContent() !== VARIABLE_CURSOR_GUARD) {
        child.insertAfter($createTextNode(VARIABLE_CURSOR_GUARD));
      }
    }
  }
}

function isPureGuardNode(node: LexicalNode | null | undefined) {
  return $isTextNode(node) && node.getTextContent() === VARIABLE_CURSOR_GUARD;
}

function moveSelectionToNodeBoundary(
  selection: ReturnType<typeof $getSelection>,
  node: LexicalNode | null | undefined,
  placement: "start" | "end"
) {
  if (!$isRangeSelection(selection) || !node) {
    return false;
  }
  if ($isTextNode(node)) {
    const offset = placement === "start" ? 0 : node.getTextContentSize();
    selection.anchor.set(node.getKey(), offset, "text");
    selection.focus.set(node.getKey(), offset, "text");
    return true;
  }
  const childSize = "getChildrenSize" in node && typeof node.getChildrenSize === "function" ? node.getChildrenSize() : 0;
  selection.anchor.set(node.getKey(), placement === "start" ? 0 : childSize, "element");
  selection.focus.set(node.getKey(), placement === "start" ? 0 : childSize, "element");
  return true;
}

function removeVariableNodeWithGuard(node: LexicalNode | null | undefined) {
  if (!$isTemplateVariableNode(node)) {
    return false;
  }
  const nextSibling = node.getNextSibling();
  if (nextSibling && isPureGuardNode(nextSibling)) {
    nextSibling.remove();
  }
  node.remove();
  return true;
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

function ToolbarPlugin({
  onApplyColor
}: {
  onApplyColor?: (color: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const buttonStyle: CSSProperties = {
    border: "1px solid #d9d9d9",
    background: "#fff",
    borderRadius: 6,
    width: 30,
    height: 30,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative"
  };

  function applyColor(color: string) {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color });
      }
    });
    onApplyColor?.(color);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        paddingBottom: 8,
        marginBottom: 8,
        borderBottom: "1px solid #f0f0f0"
      }}
    >
      <span style={{ fontSize: 12, color: "#8c8c8c", marginRight: 4 }}>文字颜色</span>
      {COLOR_OPTIONS.filter((item) => item.value).map((item) => (
        <button
          key={item.label}
          type="button"
          title={item.label}
          style={{ ...buttonStyle, color: "#595959" }}
          onMouseDown={(event) => {
            event.preventDefault();
            applyColor(item.value);
          }}
        >
          <FontColorsOutlined />
          <span
            style={{
              position: "absolute",
              left: 7,
              right: 7,
              bottom: 5,
              height: 3,
              borderRadius: 999,
              background: item.value
            }}
          />
        </button>
      ))}
      <button
        type="button"
        title="清除颜色"
        style={{ ...buttonStyle, color: "#595959" }}
        onMouseDown={(event) => {
          event.preventDefault();
          applyColor("");
        }}
      >
        <ClearOutlined />
      </button>
    </div>
  );
}

function VariableInsertPanel({
  variableOptions,
  onInsertVariable
}: {
  variableOptions: PromptVariableOption[];
  onInsertVariable: (variableKey: string) => void;
}) {
  const draggingRef = useRef(false);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        paddingTop: 8,
        marginTop: 8,
        borderTop: "1px solid #f0f0f0"
      }}
    >
      <span style={{ fontSize: 12, color: "#8c8c8c" }}>可用变量</span>
      {variableOptions.map((item) => (
        <button
          key={item.key}
          type="button"
          draggable
          style={{
            border: "1px solid #91CAFF",
            background: "#EFF8FF",
            borderRadius: 999,
            padding: "2px 8px",
            cursor: "grab",
            color: "#175CD3"
          }}
          onClick={() => {
            if (draggingRef.current) {
              return;
            }
            onInsertVariable(item.key);
          }}
          onDragStart={(event) => {
            draggingRef.current = true;
            event.dataTransfer.setData("text/plain", `{{${item.key}}}`);
            event.dataTransfer.effectAllowed = "copy";
          }}
          onDragEnd={() => {
            window.setTimeout(() => {
              draggingRef.current = false;
            }, 0);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function PromptTemplateEditorPlugin({
  value,
  editorStateJson,
  onChange,
  variableOptions,
  editorRef,
  rootElementRef
}: {
  value: string;
  editorStateJson?: string;
  onChange: (nextValue: string, nextEditorStateJson: string) => void;
  variableOptions: PromptVariableOption[];
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  rootElementRef: React.MutableRefObject<HTMLElement | null>;
}) {
  const [editor] = useLexicalComposerContext();
  const valueRef = useRef(value);
  const editorStateRef = useRef(editorStateJson ?? "");
  const lastLocalCommitRef = useRef<{ value: string; editorStateJson: string }>({
    value,
    editorStateJson: editorStateJson ?? ""
  });
  const variableMap = useMemo(() => new Map(variableOptions.map((item) => [item.key, item])), [variableOptions]);

  valueRef.current = value;
  editorStateRef.current = editorStateJson ?? "";

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  useEffect(() => {
    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        event?.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertLineBreak();
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
    const unregisterBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const handled = editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          const anchorNode = selection.anchor.getNode();
          if ($isTemplateVariableNode(anchorNode)) {
            return true;
          }
          if (isPureGuardNode(anchorNode) && selection.anchor.offset >= 0) {
            return $isTemplateVariableNode(anchorNode.getPreviousSibling());
          }
          return false;
        });
        if (!handled) {
          return false;
        }
        event?.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return;
          }
          const anchorNode = selection.anchor.getNode();
          const targetNode = $isTemplateVariableNode(anchorNode)
            ? anchorNode
            : isPureGuardNode(anchorNode)
              ? anchorNode.getPreviousSibling()
              : null;
          if (!removeVariableNodeWithGuard(targetNode)) {
            return;
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
    const unregisterDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event) => {
        const handled = editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          const anchorNode = selection.anchor.getNode();
          if ($isTemplateVariableNode(anchorNode)) {
            return true;
          }
          if ($isTextNode(anchorNode) && selection.anchor.offset === anchorNode.getTextContentSize()) {
            return $isTemplateVariableNode(anchorNode.getNextSibling());
          }
          return false;
        });
        if (!handled) {
          return false;
        }
        event?.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return;
          }
          const anchorNode = selection.anchor.getNode();
          const targetNode = $isTemplateVariableNode(anchorNode)
            ? anchorNode
            : $isTextNode(anchorNode) && selection.anchor.offset === anchorNode.getTextContentSize()
              ? anchorNode.getNextSibling()
              : null;
          removeVariableNodeWithGuard(targetNode);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
    const unregisterArrowLeft = editor.registerCommand(
      KEY_ARROW_LEFT_COMMAND,
      (event) => {
        const handled = editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          return $isTemplateVariableNode(selection.anchor.getNode());
        });
        if (!handled) {
          return false;
        }
        event?.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return;
          }
          const anchorNode = selection.anchor.getNode();
          if (!$isTemplateVariableNode(anchorNode)) {
            return;
          }
          const previousSibling = anchorNode.getPreviousSibling();
          moveSelectionToNodeBoundary(selection, previousSibling ?? anchorNode.getParent(), "end");
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
    const unregisterArrowRight = editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      (event) => {
        const handled = editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          return $isTemplateVariableNode(selection.anchor.getNode());
        });
        if (!handled) {
          return false;
        }
        event?.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return;
          }
          const anchorNode = selection.anchor.getNode();
          if (!$isTemplateVariableNode(anchorNode)) {
            return;
          }
          const nextSibling = anchorNode.getNextSibling();
          if (isPureGuardNode(nextSibling)) {
            moveSelectionToNodeBoundary(selection, nextSibling, "end");
            return;
          }
          moveSelectionToNodeBoundary(selection, nextSibling ?? anchorNode.getParent(), "start");
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
    return () => {
      unregisterEnter();
      unregisterBackspace();
      unregisterDelete();
      unregisterArrowLeft();
      unregisterArrowRight();
    };
  }, [editor]);

  useEffect(() => {
    return editor.registerRootListener((rootElement) => {
      rootElementRef.current = rootElement;
    });
  }, [editor, rootElementRef]);

  useEffect(() => {
    const currentTemplate = editor.getEditorState().read(() => serializeEditorTemplate());
    if (currentTemplate === value) {
      return;
    }
    if (value === lastLocalCommitRef.current.value) {
      return;
    }

    if (editorStateJson?.trim()) {
      const nextState = editor.parseEditorState(editorStateJson);
      editor.setEditorState(nextState);
      editor.update(() => {
        normalizeVariableCursorGuards();
      });
      return;
    }

    editor.update(() => {
      buildEditorFromTemplate(value, variableMap);
    });
  }, [editor, editorStateJson, value, variableMap]);

  return (
    <OnChangePlugin
      onChange={(editorState: EditorState) => {
        const nextValue = editorState.read(() => serializeEditorTemplate());
        const nextEditorStateJson = JSON.stringify(editorState.toJSON());
        if (nextValue !== valueRef.current || nextEditorStateJson !== editorStateRef.current) {
          lastLocalCommitRef.current = {
            value: nextValue,
            editorStateJson: nextEditorStateJson
          };
          onChange(nextValue, nextEditorStateJson);
        }
      }}
    />
  );
}

export const PromptTemplateEditor = forwardRef<PromptTemplateEditorHandle, PromptTemplateEditorProps>(function PromptTemplateEditor(
  { value, editorStateJson, onChange, variableOptions, placeholder },
  ref
) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const rootElementRef = useRef<HTMLElement | null>(null);
  const variableMap = useMemo(() => new Map(variableOptions.map((item) => [item.key, item])), [variableOptions]);

  function insertVariable(variableKey: string) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }
      const activeStyle = selection.style;
      const variable = variableMap.get(variableKey);
      selection.insertNodes([
        $createTemplateVariableNode(variableKey, variable?.label ?? variableKey),
        $createTextNode(VARIABLE_CURSOR_GUARD)
      ]);
      const nextSelection = $getSelection();
      if ($isRangeSelection(nextSelection)) {
        nextSelection.setStyle(activeStyle ?? "");
      }
    });
  }

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        editorRef.current?.focus();
      },
      insertVariable
    }),
    [variableMap]
  );

  const initialConfig = useMemo(
    () => ({
      namespace: "prompt-template-editor",
      onError(error: Error) {
        throw error;
      },
      nodes: [TemplateVariableNode]
    }),
    []
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        style={{
          border: "1px solid #d9d9d9",
          borderRadius: 8,
          padding: "8px 12px"
        }}
      >
        <ToolbarPlugin />
        <div style={{ position: "relative", minHeight: 106 }}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                style={{
                  minHeight: 106,
                  outline: "none",
                  whiteSpace: "pre-wrap",
                  lineHeight: "22px"
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  const rootElement = rootElementRef.current;
                  if (!rootElement) {
                    return;
                  }
                  const range = getRangeFromPoint(event.clientX, event.clientY);
                  if (!range || (!rootElement.contains(range.startContainer) && range.startContainer !== rootElement)) {
                    return;
                  }
                  const selection = window.getSelection();
                  if (!selection) {
                    return;
                  }
                  selection.removeAllRanges();
                  selection.addRange(range);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const token = event.dataTransfer.getData("text/plain");
                  if (!token) {
                    return;
                  }
                  const matched = token.match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}$/);
                  if (!matched) {
                    return;
                  }

                  const rootElement = rootElementRef.current;
                  const range = rootElement ? getRangeFromPoint(event.clientX, event.clientY) : null;
                  if (range) {
                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                  }

                  insertVariable(matched[1]);
                }}
              />
            }
            placeholder={
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  color: "#bfbfbf",
                  pointerEvents: "none"
                }}
              >
                {placeholder ?? ""}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <VariableInsertPanel variableOptions={variableOptions} onInsertVariable={insertVariable} />
        <HistoryPlugin />
        <PromptTemplateEditorPlugin
          value={value}
          editorStateJson={editorStateJson}
          onChange={onChange}
          variableOptions={variableOptions}
          editorRef={editorRef}
          rootElementRef={rootElementRef}
        />
      </div>
    </LexicalComposer>
  );
});
