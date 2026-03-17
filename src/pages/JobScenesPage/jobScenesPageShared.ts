import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { JobNodeDefinition, JobSceneDefinition, LifecycleState } from "../../types";

export type TriggerMode = "AUTO" | "BUTTON";

export type SceneForm = {
  name: string;
  pageResourceId: number;
  executionMode: JobSceneDefinition["executionMode"];
  previewBeforeExecute: boolean;
  floatingButtonEnabled?: boolean;
  floatingButtonLabel?: string;
  floatingButtonX?: number;
  floatingButtonY?: number;
  status: LifecycleState;
  manualDurationSec: number;
};
export type StatusFilter = "ALL" | LifecycleState;

export type FlowNodeData = {
  label: string;
  nodeType: JobNodeDefinition["nodeType"];
  enabled: boolean;
};

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

export type NodeConfig = Record<string, unknown>;

export type NodeDetailForm = {
  name: string;
  nodeType: JobNodeDefinition["nodeType"];
  enabled: boolean;
  field?: string;
  interfaceId?: number;
  forceFail?: boolean;
  listDataId?: number;
  matchColumn?: string;
  inputSource?: string;
  resultKey?: string;
  script?: string;
  target?: string;
  value?: string;
};

export type NodeLibraryItem = {
  label: string;
  nodeType: JobNodeDefinition["nodeType"];
  description: string;
};

export const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

export const executionLabel: Record<JobSceneDefinition["executionMode"], string> = {
  AUTO_WITHOUT_PROMPT: "自动执行(静默)",
  AUTO_AFTER_PROMPT: "自动执行",
  PREVIEW_THEN_EXECUTE: "自动执行 + 预览确认",
  FLOATING_BUTTON: "按钮触发"
};

export function deriveTriggerMode(executionMode: JobSceneDefinition["executionMode"]): TriggerMode {
  return executionMode === "FLOATING_BUTTON" ? "BUTTON" : "AUTO";
}

export function derivePreviewBeforeExecute(scene: Pick<JobSceneDefinition, "executionMode" | "previewBeforeExecute">) {
  if (typeof scene.previewBeforeExecute === "boolean") {
    return scene.previewBeforeExecute;
  }
  return scene.executionMode === "PREVIEW_THEN_EXECUTE";
}

export function buildExecutionMode(triggerMode: TriggerMode, previewBeforeExecute: boolean): JobSceneDefinition["executionMode"] {
  if (triggerMode === "BUTTON") {
    return "FLOATING_BUTTON";
  }
  return previewBeforeExecute ? "PREVIEW_THEN_EXECUTE" : "AUTO_AFTER_PROMPT";
}

export function getTriggerModeLabel(triggerMode: TriggerMode) {
  return triggerMode === "BUTTON" ? "按钮触发" : "自动执行";
}

export function getRunModeLabel(previewBeforeExecute: boolean) {
  return previewBeforeExecute ? "预览确认" : "直接执行";
}

export const nodeTypeLabel: Record<JobNodeDefinition["nodeType"], string> = {
  page_get: "页面取值",
  api_call: "接口调用",
  list_lookup: "名单检索",
  js_script: "脚本处理",
  page_set: "页面写值"
};

export const nodeLibrary: NodeLibraryItem[] = [
  { label: "页面取值", nodeType: "page_get", description: "从页面字段读取值" },
  { label: "接口调用", nodeType: "api_call", description: "调用外部接口获取数据" },
  { label: "名单检索", nodeType: "list_lookup", description: "到名单中心检索匹配结果" },
  { label: "脚本处理", nodeType: "js_script", description: "执行脚本进行加工" },
  { label: "页面写值", nodeType: "page_set", description: "将结果写回页面字段" }
];

export function parseConfig(configJson: string): NodeConfig {
  try {
    const parsed = JSON.parse(configJson) as NodeConfig;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export function getFlowPosition(configJson: string, fallbackX: number, fallbackY: number) {
  const config = parseConfig(configJson);
  const raw = config.__flowPosition;
  if (
    raw &&
    typeof raw === "object" &&
    typeof (raw as { x?: unknown }).x === "number" &&
    typeof (raw as { y?: unknown }).y === "number"
  ) {
    return { x: (raw as { x: number; y: number }).x, y: (raw as { x: number; y: number }).y };
  }
  return { x: fallbackX, y: fallbackY };
}

export function mergeFlowPosition(configJson: string, position: { x: number; y: number }) {
  const config = parseConfig(configJson);
  config.__flowPosition = { x: Math.round(position.x), y: Math.round(position.y) };
  return JSON.stringify(config);
}

export function buildFlowFromNodeRows(nodeRows: JobNodeDefinition[]) {
  const sorted = [...nodeRows].sort((a, b) => a.orderNo - b.orderNo);

  const nodes: FlowNode[] = sorted.map((item, index) => ({
    id: String(item.id),
    data: {
      label: `${item.orderNo}. ${item.name}`,
      nodeType: item.nodeType,
      enabled: item.enabled
    },
    position: getFlowPosition(item.configJson, 80 + index * 260, 120),
    style: {
      width: 220,
      borderRadius: 8,
      border: item.enabled ? "1px solid #91caff" : "1px solid #d9d9d9",
      background: item.enabled ? "#f0f5ff" : "#fafafa"
    }
  }));

  const edges: FlowEdge[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    edges.push({
      id: `e-${sorted[i].id}-${sorted[i + 1].id}`,
      source: String(sorted[i].id),
      target: String(sorted[i + 1].id),
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed }
    });
  }

  return { nodes, edges };
}

export function deriveOrderedNodeIds(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const ids = nodes.map((item) => item.id);
  const idSet = new Set(ids);
  const xMap = new Map(nodes.map((item) => [item.id, item.position.x]));

  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  ids.forEach((id) => {
    adjacency.set(id, []);
    indegree.set(id, 0);
  });

  const pairSet = new Set<string>();
  for (const edge of edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target) || edge.source === edge.target) {
      continue;
    }
    const pair = `${edge.source}->${edge.target}`;
    if (pairSet.has(pair)) {
      continue;
    }
    pairSet.add(pair);
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue = ids
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort((a, b) => (xMap.get(a) ?? 0) - (xMap.get(b) ?? 0));
  const ordered: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      break;
    }
    ordered.push(id);
    const nextIds = adjacency.get(id) ?? [];
    for (const nextId of nextIds) {
      indegree.set(nextId, (indegree.get(nextId) ?? 0) - 1);
      if ((indegree.get(nextId) ?? 0) === 0) {
        queue.push(nextId);
      }
    }
    queue.sort((a, b) => (xMap.get(a) ?? 0) - (xMap.get(b) ?? 0));
  }

  if (ordered.length !== ids.length) {
    return [...ids].sort((a, b) => (xMap.get(a) ?? 0) - (xMap.get(b) ?? 0));
  }

  return ordered;
}

export function getDefaultNodeConfig(
  nodeType: JobNodeDefinition["nodeType"],
  options: { listDataId?: number; matchColumn?: string; inputSource?: string } = {}
): NodeConfig {
  if (nodeType === "page_get") {
    return { field: "field_key" };
  }
  if (nodeType === "api_call") {
    return { interfaceId: 3001, forceFail: false };
  }
  if (nodeType === "list_lookup") {
    return {
      listDataId: options.listDataId,
      matchColumn: options.matchColumn ?? "",
      inputSource: options.inputSource ?? "",
      resultKey: "list_lookup_result"
    };
  }
  if (nodeType === "js_script") {
    return { script: "transform" };
  }
  return { target: "target_field", value: "" };
}

export function buildNodeConfigFromForm(values: NodeDetailForm): NodeConfig {
  if (values.nodeType === "page_get") {
    return {
      field: values.field?.trim() ?? ""
    };
  }
  if (values.nodeType === "api_call") {
    return {
      interfaceId: values.interfaceId ?? 3001,
      forceFail: Boolean(values.forceFail)
    };
  }
  if (values.nodeType === "list_lookup") {
    return {
      listDataId: values.listDataId,
      matchColumn: values.matchColumn?.trim() ?? "",
      inputSource: values.inputSource?.trim() ?? "",
      resultKey: values.resultKey?.trim() ?? ""
    };
  }
  if (values.nodeType === "js_script") {
    return {
      script: values.script?.trim() ?? ""
    };
  }
  return {
    target: values.target?.trim() ?? "",
    value: values.value ?? ""
  };
}

export function buildFormValuesFromNode(node: JobNodeDefinition): NodeDetailForm {
  const config = parseConfig(node.configJson);
  return {
    name: node.name,
    nodeType: node.nodeType,
    enabled: node.enabled,
    field: typeof config.field === "string" ? config.field : "",
    interfaceId: typeof config.interfaceId === "number" ? config.interfaceId : 3001,
    forceFail: Boolean(config.forceFail),
    listDataId: typeof config.listDataId === "number" ? config.listDataId : undefined,
    matchColumn: typeof config.matchColumn === "string" ? config.matchColumn : "",
    inputSource: typeof config.inputSource === "string" ? config.inputSource : "",
    resultKey: typeof config.resultKey === "string" ? config.resultKey : "",
    script: typeof config.script === "string" ? config.script : "",
    target: typeof config.target === "string" ? config.target : "",
    value: typeof config.value === "string" ? config.value : ""
  };
}

