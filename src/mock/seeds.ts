import type {
  ConfigTemplate,
  HintRule,
  InterfaceDefinition,
  MenuScope,
  OperationDefinition,
  OrchestrationDefinition
} from "../types";

const now = () => new Date().toISOString();

export const seedMenus: MenuScope[] = [
  { id: "menu-open-account", zone: "对公业务", menu: "开户办理", enabledHint: true, enabledOperation: true },
  { id: "menu-loan-review", zone: "贷款业务", menu: "贷款审核", enabledHint: true, enabledOperation: true },
  { id: "menu-payment-audit", zone: "支付业务", menu: "支付复核", enabledHint: true, enabledOperation: false }
];

export const seedInterfaces: InterfaceDefinition[] = [
  {
    interface_id: "if-customer-core",
    interface_name: "客户核心信息查询",
    domain: "internal-core",
    path: "/customer/core",
    method: "POST",
    auth_type: "TOKEN",
    owner: "运营管理员",
    response_path: "data",
    status: "PUBLISHED",
    updated_at: now(),
    query_mapping: [],
    body_mapping: []
  },
  {
    interface_id: "if-risk-score",
    interface_name: "风险评分查询",
    domain: "internal-risk",
    path: "/risk/score",
    method: "POST",
    auth_type: "TOKEN",
    owner: "风控管理员",
    response_path: "data.score",
    status: "DRAFT",
    updated_at: now(),
    query_mapping: [],
    body_mapping: []
  }
];

export const seedOrchestrations: OrchestrationDefinition[] = [
  {
    orchestration_id: "orc-open-account-auto-fill",
    orchestration_name: "开户自动回填编排",
    status: "ENABLED",
    updated_at: now(),
    nodes: [
      {
        node_id: "node-1",
        node_type: "page_get",
        order: 1,
        enabled: true,
        output_key: "vars.customerNo",
        config: { xpath: "/form/customerNo" }
      },
      {
        node_id: "node-2",
        node_type: "api_call",
        order: 2,
        enabled: true,
        output_key: "vars.customerData",
        config: { interface_id: "if-customer-core" }
      },
      {
        node_id: "node-3",
        node_type: "js_script",
        order: 3,
        enabled: true,
        output_key: "vars.customerName",
        config: { mode: "template", template: "{{vars.customerData.data.customerName}}" }
      },
      {
        node_id: "node-4",
        node_type: "page_set",
        order: 4,
        enabled: true,
        config: { xpath: "/form/customerName", value_source_type: "context", value_path: "vars.customerName" }
      }
    ]
  }
];

export const seedOperations: OperationDefinition[] = [
  {
    operation_id: "op-open-account-fill",
    operation_name: "开户信息回填作业",
    preview_mode: true,
    floating_button: true,
    orchestration_id: "orc-open-account-auto-fill",
    status: "PUBLISHED",
    updated_at: now()
  }
];

export const seedHints: HintRule[] = [
  {
    id: "hint-ky-001",
    title: "开户合规校验提醒",
    content: "提交前请核对客户号与证件号是否完整准确。",
    risk_level: "HIGH",
    relation: "AND",
    operation_id: "op-open-account-fill",
    menu_scope_ids: ["menu-open-account"],
    status: "PUBLISHED",
    strategy: { ips: [], persons: [], orgs: [] },
    updated_at: now(),
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

export const seedTemplates: ConfigTemplate[] = [
  {
    template_id: "tpl-open-account",
    template_name: "开户合规提醒模板",
    category: "REGULATION",
    description: "适用于开户场景的合规提醒与自动回填组合模板。",
    hint_seed: {
      title: "开户信息校验提醒",
      content: "提交前请完成必填合规字段核验。",
      risk_level: "HIGH",
      relation: "AND",
      conditions: [
        {
          id: "tpl-c1",
          left: { type: "page", xpath: "/form/customerNo" },
          operator: "not_empty",
          right: { type: "fixed", value: "" }
        }
      ]
    },
    operation_seed: {
      operation_name: "开户回填作业",
      preview_mode: true,
      floating_button: true
    },
    orchestration_seed: {
      orchestration_name: "开户模板编排",
      nodes: [
        {
          node_type: "page_get",
          order: 1,
          enabled: true,
          output_key: "vars.customerNo",
          config: { xpath: "/form/customerNo" }
        },
        {
          node_type: "api_call",
          order: 2,
          enabled: true,
          output_key: "vars.customerData",
          config: { interface_id: "if-customer-core" }
        },
        {
          node_type: "page_set",
          order: 3,
          enabled: true,
          config: { xpath: "/form/customerName", value_source_type: "context", value_path: "vars.customerData.data.customerName" }
        }
      ]
    }
  },
  {
    template_id: "tpl-risk-review",
    template_name: "贷款风险提醒模板",
    category: "RISK",
    description: "适用于贷款审核页面的风险等级提醒模板。",
    hint_seed: {
      title: "贷款风险提示",
      content: "当风险评分较高时，请完成升级复核清单。",
      risk_level: "MEDIUM",
      relation: "OR",
      conditions: [
        {
          id: "tpl-c2",
          left: { type: "page", xpath: "/form/loanAmount" },
          operator: "gt",
          right: { type: "fixed", value: 1000000 }
        }
      ]
    },
    operation_seed: {
      operation_name: "贷款审核辅助作业",
      preview_mode: true,
      floating_button: false
    },
    orchestration_seed: {
      orchestration_name: "贷款审核模板编排",
      nodes: [
        {
          node_type: "js_script",
          order: 1,
          enabled: true,
          output_key: "vars.notice",
          config: { mode: "template", template: "大额贷款需补充复核，请确认后继续处理。" }
        },
        {
          node_type: "page_set",
          order: 2,
          enabled: true,
          config: { xpath: "/form/reviewNote", value_source_type: "context", value_path: "vars.notice" }
        }
      ]
    }
  }
];
