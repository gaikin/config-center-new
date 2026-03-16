import type { EditorConfig, LexicalNode, NodeKey, SerializedTextNode, Spread } from "lexical";
import { TextNode } from "lexical";

export type SerializedTemplateVariableNode = Spread<
  {
    type: "template-variable";
    version: 1;
    variableKey: string;
    label: string;
    rawToken: string;
    valid: boolean;
  },
  SerializedTextNode
>;

export class TemplateVariableNode extends TextNode {
  __variableKey: string;
  __label: string;
  __rawToken: string;
  __valid: boolean;

  static getType() {
    return "template-variable";
  }

  static clone(node: TemplateVariableNode) {
    return new TemplateVariableNode(node.__variableKey, node.__label, node.__rawToken, node.__valid, node.__key);
  }

  static importJSON(serializedNode: SerializedTemplateVariableNode) {
    return $createTemplateVariableNode(serializedNode.variableKey, serializedNode.label, serializedNode.rawToken, serializedNode.valid);
  }

  constructor(variableKey: string, label: string, rawToken = `{{${variableKey}}}`, valid = true, key?: NodeKey) {
    super(rawToken, key);
    this.__variableKey = variableKey;
    this.__label = label;
    this.__rawToken = rawToken;
    this.__valid = valid;
  }

  createDOM(_config: EditorConfig) {
    const dom = document.createElement("span");
    dom.dataset.templateToken = this.__rawToken;
    dom.style.display = "inline-flex";
    dom.style.alignItems = "center";
    dom.style.padding = "1px 8px";
    dom.style.margin = "0 2px";
    dom.style.borderRadius = "999px";
    dom.style.fontSize = "12px";
    dom.style.lineHeight = "20px";
    dom.style.border = this.__valid ? "1px solid #91CAFF" : "1px solid #FDA29B";
    dom.style.background = this.__valid ? "#EFF8FF" : "#FEF3F2";
    dom.style.color = this.__valid ? "#175CD3" : "#B42318";
    dom.style.cursor = "text";
    dom.style.userSelect = "none";
    dom.textContent = this.__label;
    return dom;
  }

  updateDOM(prevNode: TemplateVariableNode, dom: HTMLElement) {
    if (prevNode.__label !== this.__label) {
      dom.textContent = this.__label;
    }
    if (prevNode.__rawToken !== this.__rawToken) {
      dom.dataset.templateToken = this.__rawToken;
    }
    if (prevNode.__valid !== this.__valid) {
      dom.style.border = this.__valid ? "1px solid #91CAFF" : "1px solid #FDA29B";
      dom.style.background = this.__valid ? "#EFF8FF" : "#FEF3F2";
      dom.style.color = this.__valid ? "#175CD3" : "#B42318";
    }
    return false;
  }

  exportJSON(): SerializedTemplateVariableNode {
    return {
      ...super.exportJSON(),
      type: "template-variable",
      version: 1,
      variableKey: this.__variableKey,
      label: this.__label,
      rawToken: this.__rawToken,
      valid: this.__valid
    };
  }

  getTextContent() {
    return this.__rawToken;
  }

  isTextEntity() {
    return true;
  }

  canInsertTextBefore() {
    return false;
  }

  canInsertTextAfter() {
    return false;
  }
}

export function $createTemplateVariableNode(variableKey: string, label: string, rawToken = `{{${variableKey}}}`, valid = true) {
  const node = new TemplateVariableNode(variableKey, label, rawToken, valid);
  node.setMode("token");
  node.toggleDirectionless();
  return node;
}

export function $isTemplateVariableNode(node: LexicalNode | null | undefined): node is TemplateVariableNode {
  return node instanceof TemplateVariableNode;
}
