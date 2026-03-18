import { Form, Grid, Modal, message } from "antd";
import { addEdge, type Connection, MarkerType, useEdgesState, useNodesState } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrgLabel } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import { workflowService } from "../../services/workflowService";
import { getRightOverlayDrawerWidth } from "../../utils";
import { createFieldIssue, validateJobSceneDraftPayload } from "../../validation/formRules";
import type {
  ExecutionMode,
  FieldValidationIssue,
  JobNodeDefinition,
  JobSceneDefinition,
  JobScenePreviewField,
  LifecycleState,
  ListDataDefinition,
  PageResource,
  RuleDefinition,
  SaveValidationReport
} from "../../types";
import {
  buildExecutionMode,
  buildFormValuesFromNode,
  buildFlowFromNodeRows,
  buildNodeConfigFromForm,
  derivePreviewBeforeExecute,
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

const DEFAULT_FLOATING_BUTTON_LABEL = "重新执行";
const DEFAULT_FLOATING_BUTTON_X = 86;
const DEFAULT_FLOATING_BUTTON_Y = 78;

function toSceneDraftPayload(row: JobSceneDefinition): Omit<JobSceneDefinition, "updatedAt"> & { updatedAt?: string } {
  return {
    ...row,
    status: "DRAFT"
  };
}

export function useJobScenesPageModel() {
  const screens = Grid.useBreakpoint();
  const drawerWidth = getRightOverlayDrawerWidth(Boolean(screens.lg));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<JobSceneDefinition[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [listDatas, setListDatas] = useState<ListDataDefinition[]>([]);
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
  const [sceneSaveValidationReport, setSceneSaveValidationReport] = useState<SaveValidationReport | null>(null);
  const [nodeValidationIssues, setNodeValidationIssues] = useState<FieldValidationIssue[]>([]);
  const [previewValidationIssues, setPreviewValidationIssues] = useState<FieldValidationIssue[]>([]);
  const [publishNotice, setPublishNotice] = useState<{ objectName: string; warningCount: number; resourceId: number } | null>(null);
  const autoOpenCreateRef = useRef(false);

  const [nodeDetailForm] = Form.useForm<NodeDetailForm>();
  const watchedNodeType = Form.useWatch("nodeType", nodeDetailForm);
  const watchedNodeListDataId = Form.useWatch("listDataId", nodeDetailForm);
  const watchedSceneValues = Form.useWatch([], form) as Partial<SceneForm> | undefined;
  const watchedNodeValues = Form.useWatch([], nodeDetailForm) as Partial<NodeDetailForm> | undefined;
  const [msgApi, holder] = message.useMessage();

  const selectedNode = useMemo(
    () => nodeRows.find((item) => String(item.id) === selectedNodeId) ?? null,
    [nodeRows, selectedNodeId]
  );
  const selectedNodeListData = useMemo(
    () => listDatas.find((item) => item.id === watchedNodeListDataId) ?? null,
    [listDatas, watchedNodeListDataId]
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
      const [sceneData, resourceData, ruleData, listDataRows] = await Promise.all([
        configCenterService.listJobScenes(),
        configCenterService.listPageResources(),
        configCenterService.listRules(),
        configCenterService.listListDatas()
      ]);
      const sceneNodeCounts = await Promise.all(
        sceneData.map(async (scene) => ({
          sceneId: scene.id,
          count: (await workflowService.listJobNodes(scene.id)).length
        }))
      );
      setRows(
        sceneData.map((scene) => ({
          ...scene,
          nodeCount: sceneNodeCounts.find((item) => item.sceneId === scene.id)?.count ?? 0
        }))
      );
      setResources(resourceData);
      setRules(ruleData);
      setListDatas(listDataRows);
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
      executionMode: values.executionMode ?? "AUTO_AFTER_PROMPT",
      previewBeforeExecute: values.previewBeforeExecute ?? false,
      floatingButtonEnabled: values.floatingButtonEnabled ?? false,
      floatingButtonLabel: values.floatingButtonLabel ?? "",
      floatingButtonX: values.floatingButtonX ?? null,
      floatingButtonY: values.floatingButtonY ?? null,
      status: values.status ?? "DRAFT",
      manualDurationSec: values.manualDurationSec ?? 1
    });
  }

  function updateSceneNodeCount(sceneId: number, nextCount: number) {
    setRows((previous) => previous.map((item) => (item.id === sceneId ? { ...item, nodeCount: nextCount } : item)));
    setBuilderScene((previous) => (previous && previous.id === sceneId ? { ...previous, nodeCount: nextCount } : previous));
    setEditing((previous) => (previous && previous.id === sceneId ? { ...previous, nodeCount: nextCount } : previous));
  }

  function closeSceneModalDirectly() {
    setOpen(false);
    setEditing(null);
    setSceneSnapshot("");
    setSceneSaveValidationReport(null);
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
    updateSceneNodeCount(sceneId, nodes.length);

    if (selectedNodeId && !nodes.some((item) => String(item.id) === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }

  function openCreate(preset?: { pageResourceId?: number; executionMode?: ExecutionMode; name?: string }) {
    const pickedExecutionMode: ExecutionMode =
      preset?.executionMode && ["AUTO_WITHOUT_PROMPT", "AUTO_AFTER_PROMPT", "PREVIEW_THEN_EXECUTE", "FLOATING_BUTTON"].includes(preset.executionMode)
        ? preset.executionMode
        : "AUTO_AFTER_PROMPT";
    const pickedPageId =
      typeof preset?.pageResourceId === "number" && resources.some((item) => item.id === preset.pageResourceId)
        ? preset.pageResourceId
        : resources[0]?.id ?? 0;
    const values: SceneForm = {
      name: preset?.name ?? "",
      pageResourceId: pickedPageId,
      executionMode: pickedExecutionMode,
      previewBeforeExecute: derivePreviewBeforeExecute({
        executionMode: pickedExecutionMode
      }),
      floatingButtonEnabled: pickedExecutionMode === "FLOATING_BUTTON",
      floatingButtonLabel: DEFAULT_FLOATING_BUTTON_LABEL,
      floatingButtonX: DEFAULT_FLOATING_BUTTON_X,
      floatingButtonY: DEFAULT_FLOATING_BUTTON_Y,
      status: "DRAFT",
      manualDurationSec: 30
    };
    setEditing(null);
    setPublishNotice(null);
    form.setFieldsValue(values);
    setSceneSnapshot(buildSceneSnapshot(values));
    setSceneSaveValidationReport(null);
    setOpen(true);
  }

  function openEdit(row: JobSceneDefinition) {
    const values: SceneForm = {
      name: row.name,
      pageResourceId: row.pageResourceId,
      executionMode: row.executionMode,
      previewBeforeExecute: derivePreviewBeforeExecute(row),
      floatingButtonEnabled: row.floatingButtonEnabled ?? row.executionMode === "FLOATING_BUTTON",
      floatingButtonLabel: row.floatingButtonLabel ?? DEFAULT_FLOATING_BUTTON_LABEL,
      floatingButtonX: row.floatingButtonX ?? DEFAULT_FLOATING_BUTTON_X,
      floatingButtonY: row.floatingButtonY ?? DEFAULT_FLOATING_BUTTON_Y,
      status: row.status,
      manualDurationSec: row.manualDurationSec
    };
    setEditing(row);
    setPublishNotice(null);
    form.setFieldsValue(values);
    setSceneSnapshot(buildSceneSnapshot(values));
    setSceneSaveValidationReport(null);
    setOpen(true);
  }

  const liveSceneSaveValidationReport = useMemo(() => {
    if (!open) {
      return null;
    }
    const values = watchedSceneValues ?? {};
    return validateJobSceneDraftPayload(
      {
        id: editing?.id ?? -1,
        name: values.name ?? "",
        pageResourceId: values.pageResourceId ?? 0,
        executionMode: values.executionMode ?? "AUTO_AFTER_PROMPT",
        floatingButtonEnabled:
          values.floatingButtonEnabled ??
          editing?.floatingButtonEnabled ??
          (values.executionMode === "FLOATING_BUTTON"),
        floatingButtonLabel: values.floatingButtonLabel ?? editing?.floatingButtonLabel ?? DEFAULT_FLOATING_BUTTON_LABEL,
        floatingButtonX: values.floatingButtonX ?? editing?.floatingButtonX ?? DEFAULT_FLOATING_BUTTON_X,
        floatingButtonY: values.floatingButtonY ?? editing?.floatingButtonY ?? DEFAULT_FLOATING_BUTTON_Y,
        nodeCount: editing?.nodeCount ?? 0,
        manualDurationSec: values.manualDurationSec ?? 0,
        riskConfirmed: editing?.riskConfirmed ?? false
      },
      rows,
      {
        linkedRules: editing?.id ? linkedRulesByScene.get(editing.id) ?? [] : []
      }
    );
  }, [editing?.id, editing?.riskConfirmed, linkedRulesByScene, open, rows, watchedSceneValues]);

  const activeSceneSaveValidationReport = liveSceneSaveValidationReport ?? sceneSaveValidationReport;

  async function submitScene() {
    const values = await form.validateFields();
    const resource = resources.find((item) => item.id === values.pageResourceId);
    if (!resource) {
      msgApi.error("页面资源不存在");
      return;
    }
    const sceneId = editing?.id ?? Date.now() + Math.floor(Math.random() * 1000);
    const persistedNodeCount = rows.find((item) => item.id === sceneId)?.nodeCount ?? editing?.nodeCount ?? 0;
    const nextExecutionMode = buildExecutionMode(
      values.executionMode === "FLOATING_BUTTON" ? "BUTTON" : "AUTO",
      Boolean(values.previewBeforeExecute)
    );
    const result = await configCenterService.saveJobSceneDraft({
      id: sceneId,
      ...values,
      status: "DRAFT",
      executionMode: nextExecutionMode,
      previewBeforeExecute: Boolean(values.previewBeforeExecute),
      floatingButtonEnabled:
        values.floatingButtonEnabled === undefined
          ? nextExecutionMode === "FLOATING_BUTTON"
          : Boolean(values.floatingButtonEnabled),
      nodeCount: persistedNodeCount,
      currentVersion: editing?.currentVersion ?? 1,
      pageResourceName: resource.name,
      floatingButtonLabel: values.floatingButtonLabel?.trim() || DEFAULT_FLOATING_BUTTON_LABEL,
      floatingButtonX: typeof values.floatingButtonX === "number" ? values.floatingButtonX : DEFAULT_FLOATING_BUTTON_X,
      floatingButtonY: typeof values.floatingButtonY === "number" ? values.floatingButtonY : DEFAULT_FLOATING_BUTTON_Y,
      riskConfirmed: editing?.riskConfirmed ?? false
    });
    setSceneSaveValidationReport(result.report);
    if (!result.success) {
      msgApi.error(result.report.summary);
      return;
    }
    msgApi.success(
      result.report.warningCount > 0
        ? `场景已保存草稿，另有 ${result.report.warningCount} 个待处理项`
        : editing
          ? "场景已更新，并已进入待发布列表"
          : "场景已创建，并已进入待发布列表"
    );
    setPublishNotice({
      objectName: result.data?.name ?? values.name,
      warningCount: result.report.warningCount,
      resourceId: result.data?.id ?? sceneId
    });
    closeSceneModalDirectly();
    await loadData();
  }

  async function publishSceneNow(sceneId: number, sceneName: string, effectiveOrgIds: string[] = []): Promise<boolean> {
    const pendingRows = await configCenterService.listPendingItems();
    const pending = pendingRows.find((item) => item.resourceType === "JOB_SCENE" && item.resourceId === sceneId);
    if (!pending) {
      msgApi.warning("当前作业场景没有可生效版本，请先保存草稿。");
      return false;
    }
    const result = await configCenterService.publishPendingItem(pending.id, "person-business-manager", effectiveOrgIds);
    if (!result.success) {
      msgApi.error("生效未通过，请先处理阻断项后再试。");
      return false;
    }
    msgApi.success(`已生效：${sceneName}（${effectiveOrgIds.length > 0 ? effectiveOrgIds.map((orgId) => getOrgLabel(orgId)).join("、") : "全部机构"}）`);
    await loadData();
    return true;
  }

  async function restoreSceneNow(
    row: JobSceneDefinition,
    effectiveOrgIds: string[] = []
  ): Promise<boolean> {
    const draftResult = await configCenterService.saveJobSceneDraft(toSceneDraftPayload(row));
    if (!draftResult.success || !draftResult.data) {
      msgApi.error(draftResult.report.summary);
      return false;
    }
    return publishSceneNow(draftResult.data.id, draftResult.data.name, effectiveOrgIds);
  }

  async function publishNoticeNow() {
    if (!publishNotice) {
      return;
    }
    const success = await publishSceneNow(publishNotice.resourceId, publishNotice.objectName);
    if (success) {
      setPublishNotice(null);
    }
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
    setPreviewValidationIssues([]);
    try {
      const fields = await configCenterService.previewJobScene(scene.id);
      setPreviewRows(fields);
      setPreviewSelectedKeys(fields.filter((item) => !item.abnormal).map((item) => item.key));
      setPreviewValidationIssues(
        fields
          .filter((item) => item.abnormal)
          .map((item) =>
            createFieldIssue({
              section: "preview",
              field: item.key,
              label: item.fieldName,
              message: `预览发现异常来源：${item.source}`,
              level: "warning",
              action: "请先取消勾选异常字段，再执行写入。"
            })
          )
      );
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "预览确认加载失败");
      setPreviewRows([]);
      setPreviewSelectedKeys([]);
      setPreviewValidationIssues([]);
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
    setNodeValidationIssues([]);
    try {
      await loadBuilderData(scene.id);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "加载作业编排失败");
    }
  }

  function closeBuilderDirectly() {
    setBuilderOpen(false);
    setSelectedNodeId(null);
    setNodeValidationIssues([]);
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
    const defaultListData = listDatas[0];
    const configJson = mergeFlowPosition(
      JSON.stringify(
        getDefaultNodeConfig(nodeType, {
          listDataId: defaultListData?.id,
          matchColumn: defaultListData?.importColumns[0],
          inputSource: defaultListData?.importColumns[0]
        })
      ),
      position
    );

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

  function validateNodeDetail(values: Partial<NodeDetailForm>) {
    const nextIssues: FieldValidationIssue[] = [];
    if (values.nodeType === "page_get" && !values.field?.trim()) {
      nextIssues.push(createFieldIssue({ section: "node", field: "field", label: "读取字段", message: "请输入读取字段" }));
    }
    if (values.nodeType === "api_call" && !values.interfaceId) {
      nextIssues.push(createFieldIssue({ section: "node", field: "interfaceId", label: "接口", message: "请选择接口" }));
    }
    if (values.nodeType === "list_lookup") {
      if (!values.listDataId) {
        nextIssues.push(createFieldIssue({ section: "node", field: "listDataId", label: "名单数据", message: "请选择名单数据" }));
      } else if (!listDatas.some((item) => item.id === values.listDataId)) {
        nextIssues.push(createFieldIssue({ section: "node", field: "listDataId", label: "名单数据", message: "所选名单不存在" }));
      }
      if (!values.matchColumn?.trim()) {
        nextIssues.push(createFieldIssue({ section: "node", field: "matchColumn", label: "匹配字段", message: "请选择匹配字段" }));
      }
      if (!values.inputSource?.trim()) {
        nextIssues.push(createFieldIssue({ section: "node", field: "inputSource", label: "输入来源", message: "请输入输入来源" }));
      }
      if (!values.resultKey?.trim()) {
        nextIssues.push(createFieldIssue({ section: "node", field: "resultKey", label: "结果键名", message: "请输入结果键名" }));
      }
    }
    if (values.nodeType === "js_script" && !values.script?.trim()) {
      nextIssues.push(createFieldIssue({ section: "node", field: "script", label: "脚本标识", message: "请输入脚本标识" }));
    }
    if (values.nodeType === "page_set" && !values.target?.trim()) {
      nextIssues.push(createFieldIssue({ section: "node", field: "target", label: "写入目标字段", message: "请输入写入目标字段" }));
    }
    return nextIssues;
  }

  async function saveSelectedNode() {
    if (!selectedNode || !builderScene) {
      return;
    }

    const values = await nodeDetailForm.validateFields();
    const nextIssues = validateNodeDetail(values);
    setNodeValidationIssues(nextIssues);
    if (nextIssues.length > 0) {
      msgApi.error("节点属性还有待处理问题，请先修复");
      return;
    }
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
    setNodeValidationIssues([]);
    await loadBuilderData(builderScene.id);
    setSelectedNodeId(String(selectedNode.id));
  }

  const liveNodeValidationIssues = useMemo(() => {
    if (!selectedNode) {
      return [] as FieldValidationIssue[];
    }
    return validateNodeDetail(watchedNodeValues ?? {});
  }, [listDatas, selectedNode, watchedNodeValues]);

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
    addNodeFromLibrary, selectedNode, selectedNodeListData, listDatas, nodeDetailForm, watchedNodeType, saveSelectedNode, removeSelectedNode,
    previewOpen, setPreviewOpen, previewScene, previewRows, previewSelectedKeys, setPreviewSelectedKeys,
    previewLoading, previewExecuting, executePreview, holder, statusColor, autoOpenCreateRef,
    sceneSaveValidationReport: activeSceneSaveValidationReport,
    nodeValidationIssues: liveNodeValidationIssues.length > 0 ? liveNodeValidationIssues : nodeValidationIssues,
    previewValidationIssues,
    publishNotice,
    dismissPublishNotice: () => setPublishNotice(null),
    publishNoticeNow,
    publishSceneNow,
    restoreSceneNow
  };
}
