import type { RuntimePromptDefinition } from "../types/runtime";

export interface PromptHandlers {
  onClose: () => void;
  onConfirm?: () => void;
}

const CONTAINER_ID = "cc-sdk-prompt-container";

function applyBaseStyles(element: HTMLDivElement, promptMode: RuntimePromptDefinition["promptMode"]) {
  element.style.position = "fixed";
  element.style.zIndex = "2147483000";
  element.style.maxWidth = "360px";
  element.style.padding = "16px";
  element.style.borderRadius = "12px";
  element.style.background = "#ffffff";
  element.style.boxShadow = "0 16px 40px rgba(15, 23, 42, 0.18)";
  element.style.border = "1px solid rgba(15, 23, 42, 0.08)";
  element.style.fontFamily = 'Arial, "Microsoft YaHei", sans-serif';
  element.style.color = "#111827";
  if (promptMode === "SILENT") {
    element.style.right = "24px";
    element.style.bottom = "24px";
  } else {
    element.style.right = "24px";
    element.style.top = "24px";
  }
}

export class PromptController {
  private container: HTMLDivElement | null = null;

  show(prompt: RuntimePromptDefinition, handlers: PromptHandlers) {
    this.destroy();

    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    applyBaseStyles(container, prompt.promptMode);

    const title = document.createElement("div");
    title.textContent = prompt.title;
    title.style.fontSize = "16px";
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";

    const content = document.createElement("div");
    content.textContent = prompt.content;
    content.style.fontSize = "14px";
    content.style.lineHeight = "1.6";
    content.style.marginBottom = "16px";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";

    const closeButton = document.createElement("button");
    closeButton.textContent = prompt.closeText ?? "关闭";
    closeButton.type = "button";
    closeButton.style.border = "1px solid #d1d5db";
    closeButton.style.background = "#ffffff";
    closeButton.style.color = "#111827";
    closeButton.style.borderRadius = "8px";
    closeButton.style.padding = "8px 12px";
    closeButton.style.cursor = "pointer";
    closeButton.addEventListener("click", () => {
      handlers.onClose();
    });
    actions.appendChild(closeButton);

    if (prompt.confirmText && handlers.onConfirm) {
      const confirmButton = document.createElement("button");
      confirmButton.textContent = prompt.confirmText;
      confirmButton.type = "button";
      confirmButton.style.border = "none";
      confirmButton.style.background = "#1677ff";
      confirmButton.style.color = "#ffffff";
      confirmButton.style.borderRadius = "8px";
      confirmButton.style.padding = "8px 12px";
      confirmButton.style.cursor = "pointer";
      confirmButton.addEventListener("click", () => {
        handlers.onConfirm?.();
      });
      actions.appendChild(confirmButton);
    }

    container.append(title, content, actions);
    document.body.appendChild(container);
    this.container = container;
  }

  destroy() {
    this.container?.remove();
    this.container = null;
  }
}
