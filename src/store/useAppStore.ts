import { create } from "zustand";
import type {
  HintRule,
  InterfaceDefinition,
  MenuScope,
  OperationDefinition,
  OrchestrationDefinition
} from "../types";

interface AppState {
  menus: MenuScope[];
  interfaces: InterfaceDefinition[];
  hints: HintRule[];
  operations: OperationDefinition[];
  orchestrations: OrchestrationDefinition[];
  upsertMenu: (menu: MenuScope) => void;
  upsertInterface: (def: InterfaceDefinition) => void;
  publishInterface: (id: string) => void;
  offlineInterface: (id: string) => void;
  upsertHint: (hint: HintRule) => void;
  upsertOperation: (op: OperationDefinition) => void;
  upsertOrchestration: (orchestration: OrchestrationDefinition) => void;
  exportPluginBundle: () => {
    interfaces: InterfaceDefinition[];
    hints: HintRule[];
    operations: OperationDefinition[];
    orchestrations: OrchestrationDefinition[];
  };
}

const seedMenus: MenuScope[] = [
  { id: "menu-open-account", zone: "zone-open", menu: "menu-open-account", enabledHint: true, enabledOperation: true },
  { id: "menu-loan-review", zone: "zone-loan", menu: "menu-loan-review", enabledHint: true, enabledOperation: true }
];

const seedInterfaces: InterfaceDefinition[] = [
  {
    interface_id: "if-customer-core",
    interface_name: "customer-core",
    domain: "internal-core",
    path: "/customer/core",
    method: "POST",
    auth_type: "TOKEN",
    owner: "admin",
    response_path: "data.customerNo",
    status: "PUBLISHED",
    query_mapping: [],
    body_mapping: []
  }
];

const seedOrchestrations: OrchestrationDefinition[] = [
  {
    orchestration_id: "orc-open-account-auto-fill",
    orchestration_name: "open-account-auto-fill",
    status: "ENABLED",
    nodes: [
      {
        node_id: "node-get-customer-no",
        node_type: "page_get",
        order: 1,
        enabled: true,
        output_key: "vars.customerNo",
        config: { xpath: "/form/customerNo" }
      },
      {
        node_id: "node-api",
        node_type: "api_call",
        order: 2,
        enabled: true,
        output_key: "vars.api",
        config: { interface_id: "if-customer-core" }
      },
      {
        node_id: "node-template-name",
        node_type: "js_script",
        order: 3,
        enabled: true,
        output_key: "vars.customerName",
        config: { mode: "template", template: "{{vars.api.data.customerName}}" }
      },
      {
        node_id: "node-set-name",
        node_type: "page_set",
        order: 4,
        enabled: true,
        config: { xpath: "/form/customerName", value_source_type: "context", value_path: "vars.customerName" }
      }
    ]
  }
];

const seedOperations: OperationDefinition[] = [
  {
    operation_id: "op-open-account-fill",
    operation_name: "open-account-auto-fill",
    preview_mode: true,
    floating_button: true,
    orchestration_id: "orc-open-account-auto-fill"
  }
];

const seedHints: HintRule[] = [
  {
    id: "hint-ky-001",
    title: "Regulatory reminder",
    content: "Validate customerNo and idCard before submit.",
    risk_level: "HIGH",
    relation: "AND",
    operation_id: "op-open-account-fill",
    menu_scope_ids: ["menu-open-account"],
    strategy: { ips: [], persons: [], orgs: [] },
    conditions: [
      {
        id: "c-1",
        left: { type: "page", xpath: "/form/customerNo" },
        operator: "not_empty",
        right: { type: "fixed", value: "" }
      },
      {
        id: "c-2",
        left: { type: "page", xpath: "/form/idCard" },
        left_preprocessors: [{ id: "prefix_extract", options: { length: 4 } }],
        operator: "eq",
        right: { type: "fixed", value: "6222" }
      }
    ]
  }
];

function mapUpdate<T, K extends keyof T>(list: T[], key: K, next: T) {
  const idx = list.findIndex((x) => x[key] === next[key]);
  if (idx === -1) return [next, ...list];
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
  upsertMenu: (menu) => set((state) => ({ menus: mapUpdate(state.menus, "id", menu) })),
  upsertInterface: (def) =>
    set((state) => {
      const next = { ...def, status: def.status ?? "DRAFT" };
      return { interfaces: mapUpdate(state.interfaces, "interface_id", next) };
    }),
  publishInterface: (id) =>
    set((state) => ({
      interfaces: state.interfaces.map((it) => (it.interface_id === id ? { ...it, status: "PUBLISHED" } : it))
    })),
  offlineInterface: (id) =>
    set((state) => {
      const isReferenced = state.hints.some((hint) =>
        hint.conditions.some(
          (c) => (c.left.type === "interface" && c.left.interface_id === id) || (c.right.type === "interface" && c.right.interface_id === id)
        )
      );
      if (isReferenced) {
        throw new Error("Interface is referenced by published hint rules.");
      }
      return {
        interfaces: state.interfaces.map((it) => (it.interface_id === id ? { ...it, status: "OFFLINE" } : it))
      };
    }),
  upsertHint: (hint) => set((state) => ({ hints: mapUpdate(state.hints, "id", hint) })),
  upsertOperation: (op) => set((state) => ({ operations: mapUpdate(state.operations, "operation_id", op) })),
  upsertOrchestration: (orchestration) =>
    set((state) => ({
      orchestrations: mapUpdate(state.orchestrations, "orchestration_id", orchestration)
    })),
  exportPluginBundle: () => {
    const state = get();
    return {
      interfaces: state.interfaces,
      hints: state.hints,
      operations: state.operations,
      orchestrations: state.orchestrations
    };
  }
}));
