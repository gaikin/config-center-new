import { Form, Grid, Modal, message } from "antd";
import { addEdge, type Connection, MarkerType, useEdgesState, useNodesState } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { configCenterService } from "../../services/configCenterService";
import { workflowService } from "../../services/workflowService";
import { getRightOverlayDrawerWidth } from "../../utils";
import type {
  ExecutionMode,
  JobNodeDefinition,
  JobSceneDefinition,
  JobScenePreviewField,
  LifecycleState,
  PageResource,
  RuleDefinition
} from "../../types";
import {
  buildFormValuesFromNode,
  buildFlowFromNodeRows,
  buildNodeConfigFromForm,
  deriveOrderedNodeIds,
  executionLabel,
  FlowEdge,
  FlowNode,
  NodeDetailForm,
  getDefaultNodeConfig,
  getFlowPosition,
  mergeFlowPosition,
  nodeLibrary,
  nodeTypeLabel,
  SceneForm,
  StatusFilter,
  statusColor
} from "./jobScenesPageShared";
import type { ReactFlowInstance } from "@xyflow/react";

export function useJobScenesPageModel() {
  const screens = Grid.useBreakpoint();
  const drawerWidth = getRightOverlayDrawerWidth(Boolean(screens.lg));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<JobSceneDefinition[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobSceneDefinition | null>(null);
  const [form] = Form.useForm<SceneForm>();
  const [sceneSnapshot, setSceneSnapshot] = useState("");

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderScene, setBuilderScene] = useState<JobSceneDefinition | null>(null);
  const [nodeRows, setNodeRows] = useState<JobNodeDefinition[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [savingFlow, setSavingFlow] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);

  const [flowNodes, setFlowNodes, onFlowNodesChange] = useNodesState<FlowNode>([]);
  const [flowEdges, setFlowEdges, onFlowEdgesChange] = useEdgesState<FlowEdge>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewScene, setPreviewScene] = useState<JobSceneDefinition | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewExecuting, setPreviewExecuting] = useState(false);
  const [previewRows, setPreviewRows] = useState<JobScenePreviewField[]>([]);
  const [previewSelectedKeys, setPreviewSelectedKeys] = useState<string[]>([]);
  const autoOpenCreateRef = useRef(false);

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
      const [sceneData, resourceData, ruleData] = await Promise.all([
        configCenterService.listJobScenes(),
        configCenterService.listPageResources(),
        configCenterService.listRules()
      ]);
      setRows(sceneData);
      setResources(resourceData);
      setRules(ruleData);
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

  const linkedRulesByScene = useMemo(() => {
    const grouped = new Map<number, RuleDefinition[]>();
    for (const rule of rules) {
      if (!rule.sceneId) {
        continue;
      }
      const existing = grouped.get(rule.sceneId) ?? [];
      existing.push(rule);
      grouped.set(rule.sceneId, existing);
    }
    return grouped;
  }, [rules]);

  function buildSceneSnapshot(values: Partial<SceneForm>) {
    return JSON.stringify({
      name: values.name ?? "",
      pageResourceId: values.pageResourceId ?? null,
      executionMode: values.executionMode ?? "PREVIEW_THEN_EXECUTE",
      status: values.status ?? "DRAFT",
      currentVersion: values.currentVersion ?? 1,
      nodeCount: values.nodeCount ?? 1,
      manualDurationSec: values.manualDurationSec ?? 1
    });
  }

  function closeSceneModalDirectly() {
    setOpen(false);
    setEditing(null);
    setSceneSnapshot("");
  }

  function closeSceneModal() {
    const current = buildSceneSnapshot(form.getFieldsValue() as Partial<SceneForm>);
    if (sceneSnapshot && current !== sceneSnapshot) {
      Modal.confirm({
        title: "存在未保存修改",
        content: "关闭后将丢失当前场景编辑内容，是否继续？",
        okText: "仍然关闭",
        cancelText: "继续编辑",
        onOk: closeSceneModalDirectly
      });
      return;
    }
    closeSceneModalDirectly();
  }

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

  function openCreate(preset?: { pageResourceId?: number; executionMode?: ExecutionMode; name?: string }) {
    const pickedExecutionMode: ExecutionMode =
      preset?.executionMode && ["AUTO_WITHOUT_PROMPT", "AUTO_AFTER_PROMPT", "PREVIEW_THEN_EXECUTE", "FLOATING_BUTTON"].includes(preset.executionMode)
        ? preset.executionMode
        : "PREVIEW_THEN_EXECUTE";
    const pickedPageId =
      typeof preset?.pageResourceId === "number" && resources.some((item) => item.id === preset.pageResourceId)
        ? preset.pageResourceId
        : resources[0]?.id ?? 0;
    const values: SceneForm = {
      name: preset?.name ?? "",
      pageResourceId: pickedPageId,
      executionMode: pickedExecutionMode,
      status: "DRAFT",
      currentVersion: 1,
      nodeCount: 3,
      manualDurationSec: 30
    };
    setEditing(null);
    form.setFieldsValue(values);
    setSceneSnapshot(buildSceneSnapshot(values));
    setOpen(true);
  }

  function openEdit(row: JobSceneDefinition) {
    const values: SceneForm = {
      name: row.name,
      pageResourceId: row.pageResourceId,
      executionMode: row.executionMode,
      status: row.status,
      currentVersion: row.currentVersion,
      nodeCount: row.nodeCount,
      manualDurationSec: row.manualDurationSec
    };
    setEditing(row);
    form.setFieldsValue(values);
    setSceneSnapshot(buildSceneSnapshot(values));
    setOpen(true);
  }

  async function submitScene() {
    const values = await form.validateFields();
    const resource = resources.find((item) => item.id === values.pageResourceId);
    if (!resource) {
      msgApi.error("页面资源不存在");
      return;
    }
    await configCenterService.upsertJobScene({
      ...values,
      id: editing?.id ?? Date.now() + Math.floor(Math.random() * 1000),
      pageResourceName: resource.name,
      riskConfirmed: editing?.riskConfirmed ?? false
    });
    msgApi.success(editing ? "场景已更新" : "场景已创建");
    closeSceneModalDirectly();
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

  async function openPreview(scene: JobSceneDefinition) {
    setPreviewScene(scene);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const fields = await configCenterService.previewJobScene(scene.id);
      setPreviewRows(fields);
      setPreviewSelectedKeys(fields.filter((item) => !item.abnormal).map((item) => item.key));
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "预览确认加载失败");
      setPreviewRows([]);
      setPreviewSelectedKeys([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function executePreview() {
    if (!previewScene) {
      return;
    }
    setPreviewExecuting(true);
    try {
      const result = await configCenterService.executeJobScenePreview(previewScene.id, previewSelectedKeys);
      msgApi.success(`执行完成：${result.detail}`);
      setPreviewOpen(false);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "执行失败");
    } finally {
      setPreviewExecuting(false);
    }
  }

  async function triggerFloating(scene: JobSceneDefinition) {
    try {
      const execution = await workflowService.executeJobScene(scene.id, scene.name, "FLOATING_BUTTON");
      msgApi.success(`已创建新执行实例 #${execution.id}（悬浮按钮触发）`);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "悬浮触发失败");
    }
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

  function closeBuilderDirectly() {
    setBuilderOpen(false);
    setSelectedNodeId(null);
  }

  function closeBuilder() {
    if (selectedNode && nodeDetailForm.isFieldsTouched()) {
      Modal.confirm({
        title: "节点属性尚未保存",
        content: "关闭后将丢失节点属性改动，是否继续？",
        okText: "仍然关闭",
        cancelText: "继续编辑",
        onOk: closeBuilderDirectly
      });
      return;
    }
    closeBuilderDirectly();
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

  return {
    drawerWidth, loading, statusFilter, setStatusFilter, filteredRows, openCreate, openEdit, switchStatus,
    openBuilder, openPreview, triggerFloating, confirmRisk, rows, linkedRulesByScene, open, closeSceneModal,
    submitScene, form, resources, executionLabel, editing, builderOpen, closeBuilder, savingFlow, saveFlowLayout,
    autoLayoutNodes, builderScene, nodeRows, selectedNodeId, setSelectedNodeId, flowNodes, flowEdges,
    onFlowNodesChange, onFlowEdgesChange, onConnect, setReactFlowInstance, nodeLibrary, nodeTypeLabel,
    addNodeFromLibrary, selectedNode, nodeDetailForm, watchedNodeType, saveSelectedNode, removeSelectedNode,
    previewOpen, setPreviewOpen, previewScene, previewRows, previewSelectedKeys, setPreviewSelectedKeys,
    previewLoading, previewExecuting, executePreview, holder, statusColor, autoOpenCreateRef
  };
}
