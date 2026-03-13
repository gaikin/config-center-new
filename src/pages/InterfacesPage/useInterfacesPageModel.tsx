import { Button, Form, Grid, Input, Select, Switch, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../../services/configCenterService";
import { getRightOverlayDrawerWidth } from "../../utils";
import type {
  ApiInputParam,
  ApiOutputParam,
  ApiValueSourceType,
  ApiValueType,
  InterfaceDefinition,
  LifecycleState
} from "../../types";
import {
  buildInputSummary,
  buildMockResponseBody,
  DebugEnv,
  DebugResult,
  defaultInputParam,
  defaultOutputParam,
  emptyInputConfig,
  flattenBodyParams,
  getResponsePath,
  InputConfigDraft,
  InputTabKey,
  normalizeInputConfig,
  normalizeOutputConfig,
  parseOutputFromSampleObject,
  statusColor,
  StatusFilter,
  tabLabels,
  valueTypeOptions,
  sourceTypeOptions,
  ApiRegisterForm
} from "./interfacesPageShared";

export function useInterfacesPageModel() {
  const screens = Grid.useBreakpoint();
  const drawerWidth = getRightOverlayDrawerWidth(Boolean(screens.lg));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InterfaceDefinition[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<InterfaceDefinition | null>(null);
  const [inputTab, setInputTab] = useState<InputTabKey>("headers");
  const [inputConfig, setInputConfig] = useState<InputConfigDraft>(emptyInputConfig());
  const [outputConfig, setOutputConfig] = useState<ApiOutputParam[]>([]);
  const [outputSampleJson, setOutputSampleJson] = useState("{\n  \"data\": {\n    \"score\": 90\n  }\n}");

  const [debugOpen, setDebugOpen] = useState(false);
  const [debugTarget, setDebugTarget] = useState<InterfaceDefinition | null>(null);
  const [debugEnv, setDebugEnv] = useState<DebugEnv>("TEST");
  const [debugPayload, setDebugPayload] = useState("{}");
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);

  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertyTargetId, setPropertyTargetId] = useState<string | null>(null);
  const [propertyRows, setPropertyRows] = useState<ApiOutputParam[]>([]);

  const [form] = Form.useForm<ApiRegisterForm>();
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const data = await configCenterService.listInterfaces();
      setRows(data);
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

  function resetFormState() {
    setInputTab("headers");
    setInputConfig(emptyInputConfig());
    setOutputConfig([]);
    setOutputSampleJson("{\n  \"data\": {\n    \"score\": 90\n  }\n}");
  }

  function openCreate() {
    setEditing(null);
    resetFormState();
    form.setFieldsValue({
      id: Date.now(),
      name: "",
      description: "",
      method: "POST",
      testPath: "",
      prodPath: "",
      status: "DRAFT",
      ownerOrgId: "branch-east",
      currentVersion: 1,
      timeoutMs: 3000,
      retryTimes: 1,
      maskSensitive: true,
      bodyTemplateJson: ""
    });
    setDrawerOpen(true);
  }

  function openEdit(row: InterfaceDefinition) {
    setEditing(row);
    setInputConfig(normalizeInputConfig(row.inputConfigJson));
    setOutputConfig(normalizeOutputConfig(row.outputConfigJson));
    setOutputSampleJson("{\n  \"data\": {}\n}");

    form.setFieldsValue({
      id: row.id,
      name: row.name,
      description: row.description,
      method: row.method,
      testPath: row.testPath,
      prodPath: row.prodPath,
      status: row.status,
      ownerOrgId: row.ownerOrgId,
      currentVersion: row.currentVersion,
      timeoutMs: row.timeoutMs,
      retryTimes: row.retryTimes,
      maskSensitive: row.maskSensitive,
      bodyTemplateJson: row.bodyTemplateJson
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
  }

  function addInputRow(tab: InputTabKey) {
    setInputConfig((prev) => ({
      ...prev,
      [tab]: [...prev[tab], defaultInputParam()]
    }));
  }

  function updateInputRow(tab: InputTabKey, rowId: string, patch: Partial<ApiInputParam>) {
    setInputConfig((prev) => ({
      ...prev,
      [tab]: prev[tab].map((item) => (item.id === rowId ? { ...item, ...patch } : item))
    }));
  }

  function removeInputRow(tab: InputTabKey, rowId: string) {
    setInputConfig((prev) => ({
      ...prev,
      [tab]: prev[tab].filter((item) => item.id !== rowId)
    }));
  }

  function parseBodyTemplate() {
    const raw = form.getFieldValue("bodyTemplateJson")?.trim();
    if (!raw) {
      msgApi.warning("请先输入 Body JSON");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const generated = flattenBodyParams(parsed);

      setInputConfig((prev) => {
        const merged = new Map(prev.body.map((item) => [item.name, item]));
        for (const item of generated) {
          merged.set(item.name, item);
        }
        return {
          ...prev,
          body: Array.from(merged.values())
        };
      });

      msgApi.success("Body JSON 解析成功（同名字段已按后者覆盖）");
    } catch {
      msgApi.error("Body JSON 解析失败，请检查格式");
    }
  }

  function addOutputRow() {
    setOutputConfig((prev) => [...prev, defaultOutputParam()]);
  }

  function updateOutputRow(rowId: string, patch: Partial<ApiOutputParam>) {
    setOutputConfig((prev) => prev.map((item) => (item.id === rowId ? { ...item, ...patch } : item)));
  }

  function removeOutputRow(rowId: string) {
    setOutputConfig((prev) => prev.filter((item) => item.id !== rowId));
  }

  function openOutputProperty(row: ApiOutputParam) {
    if (row.valueType !== "OBJECT" && row.valueType !== "ARRAY") {
      msgApi.warning("只有对象或数组类型支持细化属性");
      return;
    }
    setPropertyTargetId(row.id);
    setPropertyRows((row.children ?? []).map((item) => defaultOutputParam(item)));
    setPropertyOpen(true);
  }

  function saveOutputProperty() {
    if (!propertyTargetId) {
      setPropertyOpen(false);
      return;
    }

    setOutputConfig((prev) =>
      prev.map((item) => (item.id === propertyTargetId ? { ...item, children: propertyRows } : item))
    );
    setPropertyOpen(false);
    msgApi.success("出参属性已更新");
  }

  function parseOutputSample() {
    const raw = outputSampleJson.trim();
    if (!raw) {
      msgApi.warning("请先输入返回 JSON 示例");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const base =
        parsed && typeof parsed === "object" && !Array.isArray(parsed) && "data" in (parsed as Record<string, unknown>)
          ? (parsed as Record<string, unknown>).data
          : parsed;
      const generated = parseOutputFromSampleObject(base, "$.data");
      setOutputConfig(generated);
      msgApi.success("出参 JSON 解析成功");
    } catch {
      msgApi.error("出参 JSON 解析失败，请检查格式");
    }
  }
  async function submit() {
    const values = await form.validateFields();

    if (values.bodyTemplateJson?.trim()) {
      try {
        JSON.parse(values.bodyTemplateJson);
      } catch {
        msgApi.error("Body JSON 格式错误，请先修正");
        return;
      }
    }

    const payload: Omit<InterfaceDefinition, "updatedAt"> = {
      id: values.id,
      name: values.name.trim(),
      description: values.description.trim(),
      method: values.method,
      testPath: values.testPath.trim(),
      prodPath: values.prodPath.trim(),
      url: values.prodPath.trim() || values.testPath.trim(),
      status: values.status,
      ownerOrgId: values.ownerOrgId,
      currentVersion: values.currentVersion,
      timeoutMs: values.timeoutMs,
      retryTimes: values.retryTimes,
      bodyTemplateJson: values.bodyTemplateJson?.trim() ?? "",
      inputConfigJson: JSON.stringify(inputConfig),
      outputConfigJson: JSON.stringify(outputConfig),
      paramSourceSummary: buildInputSummary(inputConfig),
      responsePath: getResponsePath(outputConfig),
      maskSensitive: values.maskSensitive
    };

    await configCenterService.upsertInterface(payload);
    msgApi.success(editing ? "API注册已更新" : "API注册已创建");
    closeDrawer();
    await loadData();
  }

  async function switchStatus(item: InterfaceDefinition) {
    const next: LifecycleState = item.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await configCenterService.updateInterfaceStatus(item.id, next);
    msgApi.success(`API状态已切换为 ${next}`);
    await loadData();
  }

  function openDebug(row: InterfaceDefinition) {
    setDebugTarget(row);
    setDebugEnv("TEST");
    setDebugPayload(row.bodyTemplateJson || "{}");
    setDebugResult(null);
    setDebugOpen(true);
  }

  function runDebug() {
    if (!debugTarget) {
      return;
    }

    let requestBody: Record<string, unknown> = {};
    const payload = debugPayload.trim();
    if (payload) {
      try {
        requestBody = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        msgApi.error("调试入参 JSON 格式错误");
        return;
      }
    }

    const outputs = normalizeOutputConfig(debugTarget.outputConfigJson);
    const requestPath = debugEnv === "TEST" ? debugTarget.testPath : debugTarget.prodPath;
    const latencyMs = 180 + Math.floor(Math.random() * 320);
    const responseBody = buildMockResponseBody(outputs);

    setDebugResult({
      requestPath,
      requestBody,
      responseBody,
      latencyMs
    });
    msgApi.success("调试执行完成");
  }

  const inputColumns = (tab: InputTabKey) => [
    {
      title: "参数名",
      width: 180,
      render: (_: unknown, row: ApiInputParam) => (
        <Input value={row.name} onChange={(event) => updateInputRow(tab, row.id, { name: event.target.value })} />
      )
    },
    {
      title: "描述",
      width: 160,
      render: (_: unknown, row: ApiInputParam) => (
        <Input
          value={row.description}
          onChange={(event) => updateInputRow(tab, row.id, { description: event.target.value })}
        />
      )
    },
    {
      title: "类型",
      width: 120,
      render: (_: unknown, row: ApiInputParam) => (
        <Select
          value={row.valueType}
          options={valueTypeOptions}
          onChange={(value) => updateInputRow(tab, row.id, { valueType: value as ApiValueType })}
        />
      )
    },
    {
      title: "来源",
      width: 130,
      render: (_: unknown, row: ApiInputParam) => (
        <Select
          value={row.sourceType}
          options={sourceTypeOptions}
          onChange={(value) => updateInputRow(tab, row.id, { sourceType: value as ApiValueSourceType })}
        />
      )
    },
    {
      title: "值/映射",
      width: 220,
      render: (_: unknown, row: ApiInputParam) => (
        <Input
          value={row.sourceValue}
          onChange={(event) => updateInputRow(tab, row.id, { sourceValue: event.target.value })}
          placeholder="如 customer_id / $.data.score"
        />
      )
    },
    {
      title: "必填",
      width: 80,
      render: (_: unknown, row: ApiInputParam) => (
        <Switch checked={row.required} onChange={(checked) => updateInputRow(tab, row.id, { required: checked })} />
      )
    },
    {
      title: "操作",
      width: 80,
      render: (_: unknown, row: ApiInputParam) => (
        <Button danger size="small" onClick={() => removeInputRow(tab, row.id)}>
          删除
        </Button>
      )
    }
  ];

  return {
    drawerWidth, loading, rows, statusFilter, setStatusFilter, drawerOpen, setDrawerOpen, editing, inputTab, setInputTab,
    inputConfig, outputConfig, outputSampleJson, setOutputSampleJson, debugOpen, setDebugOpen, debugTarget, debugEnv, setDebugEnv,
    debugPayload, setDebugPayload, debugResult, propertyOpen, setPropertyOpen, propertyRows, setPropertyRows, form, holder,
    filteredRows, openCreate, openEdit, closeDrawer, addInputRow, updateInputRow, removeInputRow, parseBodyTemplate, addOutputRow,
    updateOutputRow, removeOutputRow, openOutputProperty, saveOutputProperty, parseOutputSample, submit, switchStatus, openDebug,
    runDebug, inputColumns, defaultOutputParam, valueTypeOptions, tabLabels, statusColor
  };
}
