import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  ReactFlow,
  ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { configCenterService } from "../services/configCenterService";
import { workflowService } from "../services/workflowService";
import type { JobNodeDefinition, JobSceneDefinition, LifecycleState, PageResource } from "../types";

type SceneForm = Omit<JobSceneDefinition, "updatedAt" | "pageResourceName">;
type StatusFilter = "ALL" | LifecycleState;

type FlowNodeData = {
  label: string;
  nodeType: JobNodeDefinition["nodeType"];
  enabled: boolean;
};

type FlowNode = Node<FlowNodeData>;
type FlowEdge = Edge;

type NodeConfig = Record<string, unknown>;

type NodeDetailForm = {
  name: string;
  nodeType: JobNodeDefinition["nodeType"];
  enabled: boolean;
  field?: string;
  interfaceId?: number;
  forceFail?: boolean;
  script?: string;
  target?: string;
  value?: string;
};

type NodeLibraryItem = {
  label: string;
  nodeType: JobNodeDefinition["nodeType"];
  description: string;
};

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

const executionLabel: Record<JobSceneDefinition["executionMode"], string> = {
  AUTO_WITHOUT_PROMPT: "自动执行(无提示)",
  AUTO_AFTER_PROMPT: "提示后自动",
  PREVIEW_THEN_EXECUTE: "预览后执行",
  FLOATING_BUTTON: "悬浮按钮"
};

const nodeTypeLabel: Record<JobNodeDefinition["nodeType"], string> = {
  page_get: "页面取值",
  api_call: "接口调用",
  js_script: "脚本处理",
  page_set: "页面写值"
};

const nodeLibrary: NodeLibraryItem[] = [
  { label: "页面取值", nodeType: "page_get", description: "从页面字段读取值" },
  { label: "接口调用", nodeType: "api_call", description: "调用外部接口获取数据" },
  { label: "脚本处理", nodeType: "js_script", description: "执行脚本进行加工" },
  { label: "页面写值", nodeType: "page_set", description: "将结果写回页面字段" }
];

function parseConfig(configJson: string): NodeConfig {
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

function getFlowPosition(configJson: string, fallbackX: number, fallbackY: number) {
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

function mergeFlowPosition(configJson: string, position: { x: number; y: number }) {
  const config = parseConfig(configJson);
  config.__flowPosition = { x: Math.round(position.x), y: Math.round(position.y) };
  return JSON.stringify(config);
}

function buildFlowFromNodeRows(nodeRows: JobNodeDefinition[]) {
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

function deriveOrderedNodeIds(nodes: FlowNode[], edges: FlowEdge[]): string[] {
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

function getDefaultNodeConfig(nodeType: JobNodeDefinition["nodeType"]): NodeConfig {
  if (nodeType === "page_get") {
    return { field: "field_key" };
  }
  if (nodeType === "api_call") {
    return { interfaceId: 3001, forceFail: false };
  }
  if (nodeType === "js_script") {
    return { script: "transform" };
  }
  return { target: "target_field", value: "" };
}

function buildNodeConfigFromForm(values: NodeDetailForm): NodeConfig {
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

function buildFormValuesFromNode(node: JobNodeDefinition): NodeDetailForm {
  const config = parseConfig(node.configJson);
  return {
    name: node.name,
    nodeType: node.nodeType,
    enabled: node.enabled,
    field: typeof config.field === "string" ? config.field : "",
    interfaceId: typeof config.interfaceId === "number" ? config.interfaceId : 3001,
    forceFail: Boolean(config.forceFail),
    script: typeof config.script === "string" ? config.script : "",
    target: typeof config.target === "string" ? config.target : "",
    value: typeof config.value === "string" ? config.value : ""
  };
}

export function JobScenesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<JobSceneDefinition[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobSceneDefinition | null>(null);
  const [form] = Form.useForm<SceneForm>();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderScene, setBuilderScene] = useState<JobSceneDefinition | null>(null);
  const [nodeRows, setNodeRows] = useState<JobNodeDefinition[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [savingFlow, setSavingFlow] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);

  const [flowNodes, setFlowNodes, onFlowNodesChange] = useNodesState<FlowNode>([]);
  const [flowEdges, setFlowEdges, onFlowEdgesChange] = useEdgesState<FlowEdge>([]);

  const [nodeDetailForm] = Form.useForm<NodeDetailForm>();
  const watchedNodeType = Form.useWatch("nodeType", nodeDetailForm);
  const [msgApi, holder] = message.useMessage();

  const selectedNode = useMemo(
    () => nodeRows.find((item) => String(item.id) === selectedNodeId) ?? null,
    [nodeRows, selectedNodeId]
  );

  useEffect(() => {
    if (!selectedNode) {
      nodeDetailForm.resetFields();
      return;
    }
    nodeDetailForm.setFieldsValue(buildFormValuesFromNode(selectedNode));
  }, [selectedNode, nodeDetailForm]);

  async function loadData() {
    setLoading(true);
    try {
      const [sceneData, resourceData] = await Promise.all([
        configCenterService.listJobScenes(),
        configCenterService.listPageResources()
      ]);
      setRows(sceneData);
      setResources(resourceData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRows = useMemo(() => {
    if (statusFilter === "ALL") {
      return rows;
    }
    return rows.filter((item) => item.status === statusFilter);
  }, [rows, statusFilter]);

  async function loadBuilderData(sceneId: number) {
    const nodes = await workflowService.listJobNodes(sceneId);
    setNodeRows(nodes);
    const flow = buildFlowFromNodeRows(nodes);
    setFlowNodes(flow.nodes);
    setFlowEdges(flow.edges);

    if (selectedNodeId && !nodes.some((item) => String(item.id) === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      id: Date.now(),
      name: "",
      pageResourceId: resources[0]?.id,
      executionMode: "PREVIEW_THEN_EXECUTE",
      status: "DRAFT",
      currentVersion: 1,
      nodeCount: 3,
      manualDurationSec: 30,
      riskConfirmed: false
    });
    setOpen(true);
  }

  function openEdit(row: JobSceneDefinition) {
    setEditing(row);
    form.setFieldsValue({
      id: row.id,
      name: row.name,
      pageResourceId: row.pageResourceId,
      executionMode: row.executionMode,
      status: row.status,
      currentVersion: row.currentVersion,
      nodeCount: row.nodeCount,
      manualDurationSec: row.manualDurationSec,
      riskConfirmed: row.riskConfirmed
    });
    setOpen(true);
  }

  async function submitScene() {
    const values = await form.validateFields();
    const resource = resources.find((item) => item.id === values.pageResourceId);
    if (!resource) {
      msgApi.error("页面资源不存在");
      return;
    }
    await configCenterService.upsertJobScene({ ...values, pageResourceName: resource.name });
    msgApi.success(editing ? "场景已更新" : "场景已创建");
    setOpen(false);
    await loadData();
  }

  async function switchStatus(item: JobSceneDefinition) {
    const next: LifecycleState = item.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await configCenterService.updateJobSceneStatus(item.id, next);
    msgApi.success(`场景状态已切换为 ${next}`);
    await loadData();
  }

  async function confirmRisk(item: JobSceneDefinition) {
    await configCenterService.confirmJobSceneRisk(item.id);
    msgApi.success(`风险已确认: ${item.name}`);
    await loadData();
  }

  async function openBuilder(scene: JobSceneDefinition) {
    setBuilderScene(scene);
    setBuilderOpen(true);
    setSelectedNodeId(null);
    try {
      await loadBuilderData(scene.id);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "加载作业编排失败");
    }
  }

  async function addNodeFromLibrary(nodeType: JobNodeDefinition["nodeType"]) {
    if (!builderScene) {
      return;
    }

    const nextOrder = (nodeRows[nodeRows.length - 1]?.orderNo ?? 0) + 1;
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const maxX = flowNodes.length > 0 ? Math.max(...flowNodes.map((item) => item.position.x)) : 0;
    const position = { x: Math.max(80, maxX + 260), y: 120 + ((nextOrder - 1) % 3) * 120 };
    const configJson = mergeFlowPosition(JSON.stringify(getDefaultNodeConfig(nodeType)), position);

    await workflowService.upsertJobNode({
      id,
      sceneId: builderScene.id,
      nodeType,
      name: `${nodeTypeLabel[nodeType]}${nextOrder}`,
      orderNo: nextOrder,
      enabled: true,
      configJson
    });

    msgApi.success(`${nodeTypeLabel[nodeType]}节点已添加`);
    await loadBuilderData(builderScene.id);
    setSelectedNodeId(String(id));
  }

  async function saveSelectedNode() {
    if (!selectedNode || !builderScene) {
      return;
    }

    const values = await nodeDetailForm.validateFields();
    const flowNode = flowNodes.find((item) => item.id === String(selectedNode.id));
    const fallbackPosition = getFlowPosition(selectedNode.configJson, 80, 120);
    const configJson = mergeFlowPosition(
      JSON.stringify(buildNodeConfigFromForm(values)),
      flowNode?.position ?? fallbackPosition
    );

    await workflowService.upsertJobNode({
      ...selectedNode,
      name: values.name,
      nodeType: values.nodeType,
      enabled: values.enabled,
      configJson
    });

    msgApi.success("节点属性已保存");
    await loadBuilderData(builderScene.id);
    setSelectedNodeId(String(selectedNode.id));
  }

  async function removeSelectedNode() {
    if (!selectedNode || !builderScene) {
      return;
    }

    await workflowService.deleteJobNode(selectedNode.id);
    msgApi.success("节点已删除");
    setSelectedNodeId(null);
    await loadBuilderData(builderScene.id);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      setFlowEdges((oldEdges) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed }
          },
          oldEdges
        )
      );
    },
    [setFlowEdges]
  );

  function autoLayoutNodes() {
    if (flowNodes.length === 0) {
      return;
    }

    const orderedIds = deriveOrderedNodeIds(flowNodes, flowEdges);
    const columnCount = Math.max(2, Math.ceil(Math.sqrt(orderedIds.length)));
    const startX = 40;
    const startY = 50;
    const gapX = 250;
    const gapY = 140;

    const positionMap = new Map<string, { x: number; y: number }>();
    orderedIds.forEach((id, index) => {
      const col = index % columnCount;
      const row = Math.floor(index / columnCount);
      positionMap.set(id, { x: startX + col * gapX, y: startY + row * gapY });
    });

    setFlowNodes((items) =>
      items.map((item) => ({
        ...item,
        position: positionMap.get(item.id) ?? item.position
      }))
    );

    window.setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.1, duration: 240, minZoom: 0.15, maxZoom: 1.2 });
    }, 60);
  }
  async function saveFlowLayout() {
    if (!builderScene) {
      return;
    }

    setSavingFlow(true);
    try {
      const nodeMap = new Map(nodeRows.map((item) => [String(item.id), item]));
      const orderedIds = deriveOrderedNodeIds(flowNodes, flowEdges);

      for (let i = 0; i < orderedIds.length; i += 1) {
        const id = orderedIds[i];
        const rawNode = nodeMap.get(id);
        const flowNode = flowNodes.find((item) => item.id === id);
        if (!rawNode || !flowNode) {
          continue;
        }
        await workflowService.upsertJobNode({
          ...rawNode,
          orderNo: i + 1,
          configJson: mergeFlowPosition(rawNode.configJson, flowNode.position)
        });
      }

      msgApi.success("编排已保存");
      await loadBuilderData(builderScene.id);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "编排保存失败");
    } finally {
      setSavingFlow(false);
    }
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>作业场景中心</Typography.Title>
      <Typography.Paragraph type="secondary">
        支持场景配置、风险确认与基于 React Flow 的节点编排。已移除执行实例与手工预览模块。
      </Typography.Paragraph>

      <Card
        extra={
          <Space>
            <Segmented
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { label: "全部", value: "ALL" },
                { label: "草稿", value: "DRAFT" },
                { label: "启用", value: "ACTIVE" },
                { label: "停用", value: "DISABLED" },
                { label: "过期", value: "EXPIRED" }
              ]}
            />
            <Button type="primary" onClick={openCreate}>新建场景</Button>
          </Space>
        }
      >
        <Table<JobSceneDefinition>
          rowKey="id"
          loading={loading}
          dataSource={filteredRows}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "场景名称", dataIndex: "name", width: 220 },
            { title: "页面资源", dataIndex: "pageResourceName", width: 160 },
            { title: "执行模式", width: 170, render: (_, row) => <Tag color="blue">{executionLabel[row.executionMode]}</Tag> },
            { title: "节点数", dataIndex: "nodeCount", width: 80 },
            { title: "人工基准(秒)", dataIndex: "manualDurationSec", width: 120 },
            { title: "风险确认", width: 100, render: (_, row) => row.riskConfirmed ? <Tag color="green">已确认</Tag> : <Tag color="orange">待确认</Tag> },
            { title: "状态", width: 100, render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag> },
            {
              title: "操作",
              width: 360,
              render: (_, row) => (
                <Space wrap>
                  <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
                  <Button size="small" onClick={() => void openBuilder(row)}>作业编排</Button>
                  {!row.riskConfirmed ? <Button size="small" onClick={() => void confirmRisk(row)}>确认风险</Button> : null}
                  <Button size="small" onClick={() => void switchStatus(row)}>{row.status === "ACTIVE" ? "停用" : "启用"}</Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal title={editing ? "编辑场景" : "新建场景"} open={open} onCancel={() => setOpen(false)} onOk={() => void submitScene()} width={680}>
        <Form form={form} layout="vertical">
          <Form.Item name="id" label="ID" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="name" label="场景名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="pageResourceId" label="页面资源" rules={[{ required: true }]}><Select options={resources.map((r) => ({ label: r.name, value: r.id }))} /></Form.Item>
          <Form.Item name="executionMode" label="执行模式" rules={[{ required: true }]}><Select options={Object.entries(executionLabel).map(([value, label]) => ({ label, value }))} /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={["DRAFT", "ACTIVE", "DISABLED", "EXPIRED"].map((v) => ({ label: v, value: v }))} /></Form.Item>
          <Form.Item name="currentVersion" label="版本" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="nodeCount" label="节点数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="manualDurationSec" label="人工基准(秒)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="riskConfirmed" label="风险确认"><Select options={[{ label: "是", value: true }, { label: "否", value: false }]} /></Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={builderScene ? `作业编排: ${builderScene.name}` : "作业编排"}
        width={1340}
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        extra={
          <Space>
            <Button onClick={autoLayoutNodes}>自动排版</Button>
            <Button loading={savingFlow} onClick={() => void saveFlowLayout()}>保存编排</Button>
          </Space>
        }
      >
        <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
          <Card title="节点库" style={{ flex: "0 0 220px" }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              {nodeLibrary.map((item) => (
                <Button key={item.nodeType} block onClick={() => void addNodeFromLibrary(item.nodeType)}>
                  {item.label}
                </Button>
              ))}
            </Space>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
              点击节点类型即可加入画布。
            </Typography.Paragraph>
          </Card>

          <Card title="编排画布" style={{ flex: "1 1 680px", minWidth: 540 }}>
            {flowNodes.length === 0 ? <Alert type="warning" showIcon message="当前场景暂无节点，请先从左侧节点库添加。" style={{ marginBottom: 12 }} /> : null}
            <div style={{ width: "100%", height: 520, border: "1px solid #f0f0f0", borderRadius: 8 }}>
              <ReactFlowProvider>
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  onNodesChange={onFlowNodesChange}
                  onEdgesChange={onFlowEdgesChange}
                  onConnect={onConnect}
                  onInit={(instance) => setReactFlowInstance(instance)}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  onPaneClick={() => setSelectedNodeId(null)}
                  minZoom={0.15}
                  fitView={flowNodes.length > 0}
                  fitViewOptions={{ padding: 0.1, minZoom: 0.15, maxZoom: 1.2 }}
                >
                  <MiniMap zoomable pannable />
                  <Controls />
                  <Background />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              拖拽节点调整布局，连线定义执行顺序，点击节点后在右侧编辑属性。
            </Typography.Paragraph>
          </Card>

          <Card title="节点属性" style={{ flex: "0 0 320px" }}>
            {!selectedNode ? (
              <Alert type="info" showIcon message="请选择一个节点" description="在画布中点击节点后，可在这里编辑节点属性。" />
            ) : (
              <>
                <Form form={nodeDetailForm} layout="vertical">
                  <Form.Item name="name" label="节点名称" rules={[{ required: true, message: "请输入节点名称" }]}>
                    <Input placeholder="请输入节点名称" />
                  </Form.Item>
                  <Form.Item name="nodeType" label="节点类型" rules={[{ required: true }]}>
                    <Select options={Object.entries(nodeTypeLabel).map(([value, label]) => ({ label, value }))} />
                  </Form.Item>
                  <Form.Item name="enabled" label="启用状态" rules={[{ required: true }]}>
                    <Select options={[{ label: "启用", value: true }, { label: "停用", value: false }]} />
                  </Form.Item>

                  {watchedNodeType === "page_get" ? (
                    <Form.Item name="field" label="读取字段" rules={[{ required: true, message: "请输入字段名" }]}>
                      <Input placeholder="如: customer_id" />
                    </Form.Item>
                  ) : null}

                  {watchedNodeType === "api_call" ? (
                    <>
                      <Form.Item name="interfaceId" label="接口ID" rules={[{ required: true, message: "请输入接口ID" }]}>
                        <InputNumber min={1} style={{ width: "100%" }} />
                      </Form.Item>
                      <Form.Item name="forceFail" label="模拟失败">
                        <Select options={[{ label: "否", value: false }, { label: "是", value: true }]} />
                      </Form.Item>
                    </>
                  ) : null}

                  {watchedNodeType === "js_script" ? (
                    <Form.Item name="script" label="脚本标识" rules={[{ required: true, message: "请输入脚本标识" }]}>
                      <Input placeholder="如: maskMobile" />
                    </Form.Item>
                  ) : null}

                  {watchedNodeType === "page_set" ? (
                    <>
                      <Form.Item name="target" label="写入目标字段" rules={[{ required: true, message: "请输入目标字段" }]}>
                        <Input placeholder="如: risk_score" />
                      </Form.Item>
                      <Form.Item name="value" label="写入值(可选)">
                        <Input placeholder="可留空，使用上游结果" />
                      </Form.Item>
                    </>
                  ) : null}
                </Form>

                <Space>
                  <Button type="primary" onClick={() => void saveSelectedNode()}>保存属性</Button>
                  <Popconfirm title="确认删除当前节点?" onConfirm={() => void removeSelectedNode()}>
                    <Button danger>删除节点</Button>
                  </Popconfirm>
                </Space>
              </>
            )}
          </Card>
        </div>
      </Drawer>
    </div>
  );
}






