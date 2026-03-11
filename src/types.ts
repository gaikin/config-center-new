export type InterfaceStatus = "DRAFT" | "PUBLISHED" | "OFFLINE";
export type ValueType = "string" | "number" | "boolean" | "array" | "object";
export type ConditionRelation = "AND" | "OR";
export type Operator =
  | "eq"
  | "ne"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "regex_match"
  | "is_empty"
  | "not_empty";

export type PreprocessorConfig = {
  id: "prefix_extract" | "to_number" | string;
  options?: Record<string, unknown>;
};

export type MappingSourceType = "fixed" | "page" | "context";
export type NodeType = "page_get" | "page_set" | "api_call" | "js_script" | "custom";

export interface MenuScope {
  id: string;
  zone: string;
  menu: string;
  enabledHint: boolean;
  enabledOperation: boolean;
}

export interface InterfaceParamMapping {
  param_name: string;
  source_type: MappingSourceType;
  source_value: string;
  required: boolean;
  value_type?: ValueType;
  default_value?: string;
  test_value?: string;
}

export interface InterfaceDefinition {
  interface_id: string;
  interface_name: string;
  domain: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  auth_type: "NONE" | "TOKEN" | "AKSK" | "CUSTOM";
  owner: string;
  response_path: string;
  status: InterfaceStatus;
  version?: number;
  query_mapping: InterfaceParamMapping[];
  body_mapping: InterfaceParamMapping[];
}

export type ValueSource =
  | { type: "fixed"; value: unknown }
  | { type: "page"; xpath: string }
  | { type: "interface"; interface_id: string; response_path: string };

export interface ConditionExpression {
  id: string;
  left: ValueSource;
  operator: Operator;
  right: ValueSource;
  left_preprocessors?: PreprocessorConfig[];
  right_preprocessors?: PreprocessorConfig[];
}

export interface HintRule {
  id: string;
  title: string;
  content: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  relation: ConditionRelation;
  conditions: ConditionExpression[];
  operation_id?: string;
  menu_scope_ids: string[];
  strategy: {
    ips: string[];
    persons: string[];
    orgs: string[];
  };
}

export interface OrchestrationNode {
  node_id: string;
  node_type: NodeType;
  order: number;
  enabled: boolean;
  output_key?: string;
  config: Record<string, unknown>;
}

export interface OperationDefinition {
  operation_id: string;
  operation_name: string;
  preview_mode: boolean;
  floating_button: boolean;
  orchestration_id: string;
}

export interface OrchestrationDefinition {
  orchestration_id: string;
  orchestration_name: string;
  status: "ENABLED" | "DISABLED";
  nodes: OrchestrationNode[];
}

export interface RuntimeContext {
  ip: string;
  person_id: string;
  org_id: string;
  is_new_employee: boolean;
  menu_scope_id: string;
}

export interface RuntimeInput {
  context: RuntimeContext;
  pageValues: Record<string, string>;
}

export interface RuntimeLog {
  id: string;
  timestamp: string;
  event: string;
  detail: string;
}

export interface RuntimeResult {
  mergedHints: Array<{ id: string; title: string; content: string; risk_level: string }>;
  operationResults: Array<{
    operation_id: string;
    status: "SUCCESS" | "FAILED" | "CANCELLED";
    message: string;
  }>;
  finalPageValues: Record<string, string>;
}
