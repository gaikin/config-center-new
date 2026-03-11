import { create } from "zustand";
import {
  seedHints,
  seedInterfaces,
  seedMenus,
  seedOperations,
  seedOrchestrations,
  seedTemplates
} from "../mock/seeds";
import type {
  ConfigTemplate,
  HintRule,
  InterfaceDefinition,
  MenuScope,
  OperationDefinition,
  OrchestrationDefinition
} from "../types";
import { createId } from "../utils";

interface TemplateCreateInput {
  templateId: string;
  menuScopeIds: string[];
  customTitle?: string;
  customContent?: string;
  riskLevel?: HintRule["risk_level"];
  relation?: HintRule["relation"];
  previewMode?: boolean;
  floatingButton?: boolean;
  publishStatus?: HintRule["status"];
}

interface AppState {
  menus: MenuScope[];
  interfaces: InterfaceDefinition[];
  hints: HintRule[];
  operations: OperationDefinition[];
  orchestrations: OrchestrationDefinition[];
  templates: ConfigTemplate[];
  upsertMenu: (menu: MenuScope) => void;
  upsertInterface: (def: InterfaceDefinition) => void;
  publishInterface: (id: string) => void;
  offlineInterface: (id: string) => void;
  upsertHint: (hint: HintRule) => void;
  publishHint: (id: string) => void;
  upsertOperation: (op: OperationDefinition) => void;
  publishOperation: (id: string) => void;
  upsertOrchestration: (orchestration: OrchestrationDefinition) => void;
  createFromTemplate: (input: TemplateCreateInput) => { hintId: string; operationId: string; orchestrationId: string };
  exportPluginBundle: () => {
    interfaces: InterfaceDefinition[];
    hints: HintRule[];
    operations: OperationDefinition[];
    orchestrations: OrchestrationDefinition[];
  };
}

function nowIso() {
  return new Date().toISOString();
}

function mapUpdate<T, K extends keyof T>(list: T[], key: K, next: T) {
  const idx = list.findIndex((x) => x[key] === next[key]);
  if (idx === -1) {
    return [next, ...list];
  }
  const clone = [...list];
  clone[idx] = next;
  return clone;
}

export const useAppStore = create<AppState>((set, get) => ({
  menus: seedMenus,
  interfaces: seedInterfaces,
  hints: seedHints,
  operations: seedOperations,
  orchestrations: seedOrchestrations,
  templates: seedTemplates,
  upsertMenu: (menu) => set((state) => ({ menus: mapUpdate(state.menus, "id", menu) })),
  upsertInterface: (def) =>
    set((state) => {
      const next = { ...def, status: def.status ?? "DRAFT", updated_at: nowIso() };
      return { interfaces: mapUpdate(state.interfaces, "interface_id", next) };
    }),
  publishInterface: (id) =>
    set((state) => ({
      interfaces: state.interfaces.map((it) =>
        it.interface_id === id ? { ...it, status: "PUBLISHED", updated_at: nowIso() } : it
      )
    })),
  offlineInterface: (id) =>
    set((state) => {
      const isReferenced = state.hints.some((hint) =>
        hint.conditions.some(
          (condition) =>
            (condition.left.type === "interface" && condition.left.interface_id === id) ||
            (condition.right.type === "interface" && condition.right.interface_id === id)
        )
      );
      if (isReferenced) {
        throw new Error("接口已被规则引用，请先解除引用后再下线。");
      }
      return {
        interfaces: state.interfaces.map((it) =>
          it.interface_id === id ? { ...it, status: "OFFLINE", updated_at: nowIso() } : it
        )
      };
    }),
  upsertHint: (hint) =>
    set((state) => {
      const next = { ...hint, status: hint.status ?? "DRAFT", updated_at: nowIso() };
      return { hints: mapUpdate(state.hints, "id", next) };
    }),
  publishHint: (id) =>
    set((state) => ({
      hints: state.hints.map((it) => (it.id === id ? { ...it, status: "PUBLISHED", updated_at: nowIso() } : it))
    })),
  upsertOperation: (op) =>
    set((state) => {
      const next = { ...op, status: op.status ?? "DRAFT", updated_at: nowIso() };
      return { operations: mapUpdate(state.operations, "operation_id", next) };
    }),
  publishOperation: (id) =>
    set((state) => ({
      operations: state.operations.map((it) =>
        it.operation_id === id ? { ...it, status: "PUBLISHED", updated_at: nowIso() } : it
      )
    })),
  upsertOrchestration: (orchestration) =>
    set((state) => {
      const next = { ...orchestration, updated_at: nowIso() };
      return { orchestrations: mapUpdate(state.orchestrations, "orchestration_id", next) };
    }),
  createFromTemplate: (input) => {
    const { templateId, menuScopeIds, customTitle, customContent } = input;
    const state = get();
    const template = state.templates.find((item) => item.template_id === templateId);
    if (!template) {
      throw new Error(`未找到模板：${templateId}`);
    }

    const orchestrationId = createId("orc");
    const operationId = createId("op");
    const hintId = createId("hint");

    const orchestration: OrchestrationDefinition = {
      orchestration_id: orchestrationId,
      orchestration_name: template.orchestration_seed.orchestration_name,
      status: "ENABLED",
      updated_at: nowIso(),
      nodes: template.orchestration_seed.nodes.map((node, index) => ({
        ...node,
        node_id: createId(`node-${index + 1}`)
      }))
    };

    const operation: OperationDefinition = {
      operation_id: operationId,
      orchestration_id: orchestrationId,
      status: input.publishStatus ?? "PUBLISHED",
      updated_at: nowIso(),
      ...template.operation_seed
    };
    operation.preview_mode = input.previewMode ?? operation.preview_mode;
    operation.floating_button = input.floatingButton ?? operation.floating_button;

    const hint: HintRule = {
      id: hintId,
      title: customTitle ?? template.hint_seed.title,
      content: customContent ?? template.hint_seed.content,
      risk_level: input.riskLevel ?? template.hint_seed.risk_level,
      relation: input.relation ?? template.hint_seed.relation,
      conditions: template.hint_seed.conditions.map((condition) => ({ ...condition, id: createId("cond") })),
      operation_id: operationId,
      menu_scope_ids: menuScopeIds,
      status: input.publishStatus ?? "PUBLISHED",
      strategy: { ips: [], persons: [], orgs: [] },
      updated_at: nowIso()
    };

    set((current) => ({
      orchestrations: [orchestration, ...current.orchestrations],
      operations: [operation, ...current.operations],
      hints: [hint, ...current.hints]
    }));

    return { hintId, operationId, orchestrationId };
  },
  exportPluginBundle: () => {
    const state = get();
    return {
      interfaces: state.interfaces.filter((it) => it.status === "PUBLISHED"),
      hints: state.hints.filter((it) => it.status === "PUBLISHED"),
      operations: state.operations.filter((it) => it.status === "PUBLISHED"),
      orchestrations: state.orchestrations.filter((it) => it.status === "ENABLED")
    };
  }
}));
