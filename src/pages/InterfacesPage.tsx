import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import type {
  ApiInputParam,
  ApiOutputParam,
  ApiValueSourceType,
  ApiValueType,
  InterfaceDefinition,
  LifecycleState
} from "../types";

type StatusFilter = "ALL" | LifecycleState;
type InputTabKey = "headers" | "query" | "path" | "body";
type DebugEnv = "TEST" | "PROD";

type ApiRegisterForm = {
  id: number;
  name: string;
  description: string;
  method: InterfaceDefinition["method"];
  testPath: string;
  prodPath: string;
  timeoutMs: number;
  retryTimes: number;
  status: LifecycleState;
  ownerOrgId: string;
  currentVersion: number;
  maskSensitive: boolean;
  bodyTemplateJson: string;
};

type InputConfigDraft = Record<InputTabKey, ApiInputParam[]>;

type DebugResult = {
  requestPath: string;
  requestBody: Record<string, unknown>;
  responseBody: Record<string, unknown>;
  latencyMs: number;
};

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

const valueTypeOptions: Array<{ label: string; value: ApiValueType }> = [
  { label: "字符串", value: "STRING" },
  { label: "数字", value: "NUMBER" },
  { label: "布尔", value: "BOOLEAN" },
  { label: "对象", value: "OBJECT" },
  { label: "数组", value: "ARRAY" }
];

const sourceTypeOptions: Array<{ label: string; value: ApiValueSourceType }> = [
  { label: "固定值", value: "CONST" },
  { label: "页面元素", value: "PAGE_ELEMENT" },
  { label: "API输出", value: "API_OUTPUT" },
  { label: "上下文", value: "CONTEXT" }
];

const tabLabels: Record<InputTabKey, string> = {
  headers: "Header",
  query: "Query",
  path: "Path",
  body: "Body"
};

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function defaultInputParam(patch?: Partial<ApiInputParam>): ApiInputParam {
  return {
    id: patch?.id ?? buildId("param"),
    name: patch?.name ?? "",
    description: patch?.description ?? "",
    valueType: patch?.valueType ?? "STRING",
    required: patch?.required ?? false,
    sourceType: patch?.sourceType ?? "CONST",
    sourceValue: patch?.sourceValue ?? ""
  };
}

function defaultOutputParam(patch?: Partial<ApiOutputParam>): ApiOutputParam {
  return {
    id: patch?.id ?? buildId("output"),
    name: patch?.name ?? "",
    path: patch?.path ?? "",
    description: patch?.description ?? "",
    valueType: patch?.valueType ?? "STRING",
    children: patch?.children ?? []
  };
}

const emptyInputConfig = (): InputConfigDraft => ({
  headers: [],
  query: [],
  path: [],
  body: []
});

function parseJsonSafe<T>(jsonText: string, fallback: T): T {
  try {
    const parsed = JSON.parse(jsonText) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function normalizeInputConfig(jsonText: string): InputConfigDraft {
  const parsed = parseJsonSafe<Record<string, unknown>>(jsonText, {});

  const normalizeArray = (key: InputTabKey) => {
    const row = parsed[key];
    if (!Array.isArray(row)) {
      return [];
    }

    return row.map((item) => {
      const next = typeof item === "object" && item ? (item as Partial<ApiInputParam>) : {};
      return defaultInputParam(next);
    });
  };

  return {
    headers: normalizeArray("headers"),
    query: normalizeArray("query"),
    path: normalizeArray("path"),
    body: normalizeArray("body")
  };
}

function normalizeOutputConfig(jsonText: string): ApiOutputParam[] {
  const parsed = parseJsonSafe<unknown[]>(jsonText, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const normalize = (item: unknown): ApiOutputParam => {
    const raw = typeof item === "object" && item ? (item as Partial<ApiOutputParam>) : {};
    const children = Array.isArray(raw.children) ? raw.children.map((child) => normalize(child)) : [];
    return defaultOutputParam({
      ...raw,
      children
    });
  };

  return parsed.map((item) => normalize(item));
}
function inferValueType(value: unknown): ApiValueType {
  if (Array.isArray(value)) {
    return "ARRAY";
  }
  if (value !== null && typeof value === "object") {
    return "OBJECT";
  }
  if (typeof value === "number") {
    return "NUMBER";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  return "STRING";
}

function flattenBodyParams(value: unknown, prefix = ""): ApiInputParam[] {
  if (Array.isArray(value)) {
    return [
      defaultInputParam({
        name: prefix || "array_field",
        valueType: "ARRAY",
        sourceType: "CONST",
        sourceValue: JSON.stringify(value),
        description: "由 Body JSON 解析"
      })
    ];
  }

  if (value !== null && typeof value === "object") {
    const rows: ApiInputParam[] = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const name = prefix ? `${prefix}.${key}` : key;
      const childType = inferValueType(child);
      if (childType === "OBJECT") {
        rows.push(...flattenBodyParams(child, name));
      } else {
        rows.push(
          defaultInputParam({
            name,
            valueType: childType,
            sourceType: "CONST",
            sourceValue: typeof child === "string" ? child : JSON.stringify(child),
            description: "由 Body JSON 解析"
          })
        );
      }
    }
    return rows;
  }

  return [
    defaultInputParam({
      name: prefix || "value",
      valueType: inferValueType(value),
      sourceType: "CONST",
      sourceValue: typeof value === "string" ? value : JSON.stringify(value),
      description: "由 Body JSON 解析"
    })
  ];
}

function parseOutputFromSampleObject(value: unknown, basePath = "$.data"): ApiOutputParam[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rows: ApiOutputParam[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = `${basePath}.${key}`;
    const childType = inferValueType(child);

    if (childType === "OBJECT") {
      rows.push(
        defaultOutputParam({
          name: key,
          path,
          valueType: "OBJECT",
          description: "由返回 JSON 解析",
          children: parseOutputFromSampleObject(child, path)
        })
      );
      continue;
    }

    if (childType === "ARRAY") {
      const arrayValue = child as unknown[];
      const first = arrayValue[0];
      rows.push(
        defaultOutputParam({
          name: key,
          path,
          valueType: "ARRAY",
          description: "由返回 JSON 解析",
          children:
            first && typeof first === "object" && !Array.isArray(first)
              ? parseOutputFromSampleObject(first, `${path}[0]`)
              : []
        })
      );
      continue;
    }

    rows.push(
      defaultOutputParam({
        name: key,
        path,
        valueType: childType,
        description: "由返回 JSON 解析"
      })
    );
  }

  return rows;
}

function buildInputSummary(config: InputConfigDraft) {
  return `Header ${config.headers.length} / Query ${config.query.length} / Path ${config.path.length} / Body ${config.body.length}`;
}

function getResponsePath(outputs: ApiOutputParam[]) {
  if (outputs.length === 0) {
    return "$.data";
  }
  return outputs[0].path || "$.data";
}

function updateByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const normalized = path.startsWith("$.") ? path.slice(2) : path;
  const parts = normalized.replace(/\[\d+\]/g, "").split(".").filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (typeof cursor[key] !== "object" || cursor[key] === null || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function buildMockFieldValue(field: ApiOutputParam): unknown {
  if (field.valueType === "OBJECT") {
    const obj: Record<string, unknown> = {};
    for (const child of field.children ?? []) {
      obj[child.name] = buildMockFieldValue(child);
    }
    return obj;
  }

  if (field.valueType === "ARRAY") {
    if ((field.children ?? []).length > 0) {
      const row: Record<string, unknown> = {};
      for (const child of field.children ?? []) {
        row[child.name] = buildMockFieldValue(child);
      }
      return [row];
    }
    return [`sample_${field.name || "item"}`];
  }

  if (field.valueType === "NUMBER") {
    return 88;
  }

  if (field.valueType === "BOOLEAN") {
    return true;
  }

  return `${field.name || "field"}_value`;
}

function buildMockResponseBody(outputs: ApiOutputParam[]) {
  const root: Record<string, unknown> = { data: {} };
  for (const field of outputs) {
    updateByPath(root, field.path || `$.data.${field.name}`, buildMockFieldValue(field));
  }
  return root;
}
export function InterfacesPage() {
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

  return (
    <div>
      {holder}
      <Typography.Title level={4}>API注册</Typography.Title>
      <Typography.Paragraph type="secondary">
        API注册统一复用于智能提示与智能作业。支持测试/生产路径分离、入参四分栏配置、Body/出参 JSON 解析及列表调试。
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
                { label: "生效", value: "ACTIVE" },
                { label: "停用", value: "DISABLED" },
                { label: "失效", value: "EXPIRED" }
              ]}
            />
            <Button type="primary" onClick={openCreate}>
              新建API注册
            </Button>
          </Space>
        }
      >
        <Table<InterfaceDefinition>
          rowKey="id"
          loading={loading}
          dataSource={filteredRows}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "API名称", dataIndex: "name", width: 180 },
            {
              title: "方法与路径",
              width: 320,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Space>
                    <Tag color="geekblue">{row.method}</Tag>
                    <Typography.Text>{row.testPath || "-"}</Typography.Text>
                    <Tag>测试</Tag>
                  </Space>
                  <Space>
                    <Tag color="cyan">{row.method}</Tag>
                    <Typography.Text>{row.prodPath || "-"}</Typography.Text>
                    <Tag color="green">生产</Tag>
                  </Space>
                </Space>
              )
            },
            { title: "入参概览", dataIndex: "paramSourceSummary", width: 230 },
            { title: "出参路径", dataIndex: "responsePath", width: 180 },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag>
            },
            {
              title: "操作",
              width: 260,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button size="small" onClick={() => openDebug(row)}>
                    调试
                  </Button>
                  <Button size="small" onClick={() => void switchStatus(row)}>
                    {row.status === "ACTIVE" ? "停用" : "启用"}
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Drawer
        title={editing ? `编辑API注册：${editing.name}` : "新建API注册"}
        width={1280}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeDrawer}>取消</Button>
            <Button type="primary" onClick={() => void submit()}>
              保存接口
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} lg={9}>
              <Card title="基本信息" style={{ marginBottom: 12 }}>
                <Form.Item name="id" label="ID" rules={[{ required: true, message: "请输入 ID" }]}>
                  <InputNumber style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                  <Input maxLength={128} />
                </Form.Item>
                <Form.Item name="description" label="描述" rules={[{ required: true, message: "请输入描述" }]}>
                  <Input.TextArea rows={3} maxLength={300} />
                </Form.Item>
                <Form.Item name="method" label="方法" rules={[{ required: true, message: "请选择方法" }]}>
                  <Select options={["GET", "POST", "PUT", "DELETE"].map((v) => ({ label: v, value: v }))} />
                </Form.Item>
                <Form.Item name="testPath" label="测试环境路径" rules={[{ required: true, message: "请输入测试环境路径" }]}>
                  <Input placeholder="如 /test/risk/score/query" />
                </Form.Item>
                <Form.Item name="prodPath" label="生产环境路径" rules={[{ required: true, message: "请输入生产环境路径" }]}>
                  <Input placeholder="如 /risk/score/query" />
                </Form.Item>
                <Form.Item name="timeoutMs" label="超时(ms)" rules={[{ required: true, message: "请输入超时" }]}>
                  <InputNumber min={1} max={5000} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="retryTimes" label="重试次数" rules={[{ required: true, message: "请输入重试次数" }]}>
                  <InputNumber min={0} max={3} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="maskSensitive" label="敏感字段脱敏" valuePropName="checked">
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
                <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                  <Select
                    options={[
                      { label: "DRAFT", value: "DRAFT" },
                      { label: "ACTIVE", value: "ACTIVE" },
                      { label: "DISABLED", value: "DISABLED" },
                      { label: "EXPIRED", value: "EXPIRED" }
                    ]}
                  />
                </Form.Item>
                <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true, message: "请输入组织范围" }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="currentVersion" label="当前版本" rules={[{ required: true, message: "请输入版本" }]}>
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Card>
            </Col>

            <Col xs={24} lg={15}>
              <Card title="输入参数配置" style={{ marginBottom: 12 }}>
                <Tabs
                  activeKey={inputTab}
                  onChange={(key) => setInputTab(key as InputTabKey)}
                  items={(Object.keys(tabLabels) as InputTabKey[]).map((tab) => ({
                    key: tab,
                    label: tabLabels[tab],
                    children: (
                      <div>
                        {tab === "body" ? (
                          <>
                            <Form.Item name="bodyTemplateJson" label="Body JSON 模板">
                              <Input.TextArea rows={6} placeholder="支持 JSON 解析为 Body 参数" />
                            </Form.Item>
                            <Space style={{ marginBottom: 12 }}>
                              <Button onClick={parseBodyTemplate}>解析 Body JSON</Button>
                              <Button onClick={() => addInputRow("body")}>手动新增 Body 参数</Button>
                            </Space>
                          </>
                        ) : (
                          <Button style={{ marginBottom: 12 }} onClick={() => addInputRow(tab)}>
                            新增{tabLabels[tab]}参数
                          </Button>
                        )}

                        <Table<ApiInputParam>
                          rowKey="id"
                          pagination={false}
                          size="small"
                          columns={inputColumns(tab)}
                          dataSource={inputConfig[tab]}
                          scroll={{ x: 960 }}
                          locale={{ emptyText: "暂无参数，点击上方按钮添加" }}
                        />
                      </div>
                    )
                  }))}
                />
              </Card>

              <Card
                title="输出参数配置"
                extra={
                  <Space>
                    <Button onClick={addOutputRow}>新增出参</Button>
                  </Space>
                }
              >
                <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  支持直接解析返回 JSON，也支持手动补充。对象/数组类型可继续细化属性。
                </Typography.Paragraph>
                <Input.TextArea
                  rows={5}
                  value={outputSampleJson}
                  onChange={(event) => setOutputSampleJson(event.target.value)}
                  placeholder="粘贴返回 JSON 示例"
                />
                <Space style={{ marginTop: 8, marginBottom: 12 }}>
                  <Button onClick={parseOutputSample}>解析返回 JSON</Button>
                </Space>

                <Table<ApiOutputParam>
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 980 }}
                  dataSource={outputConfig}
                  locale={{ emptyText: "暂无出参，点击新增或解析 JSON" }}
                  columns={[
                    {
                      title: "字段名",
                      width: 170,
                      render: (_, row) => (
                        <Input value={row.name} onChange={(event) => updateOutputRow(row.id, { name: event.target.value })} />
                      )
                    },
                    {
                      title: "路径",
                      width: 260,
                      render: (_, row) => (
                        <Input value={row.path} onChange={(event) => updateOutputRow(row.id, { path: event.target.value })} />
                      )
                    },
                    {
                      title: "描述",
                      width: 160,
                      render: (_, row) => (
                        <Input
                          value={row.description}
                          onChange={(event) => updateOutputRow(row.id, { description: event.target.value })}
                        />
                      )
                    },
                    {
                      title: "类型",
                      width: 120,
                      render: (_, row) => (
                        <Select
                          value={row.valueType}
                          options={valueTypeOptions}
                          onChange={(value) =>
                            updateOutputRow(row.id, {
                              valueType: value as ApiValueType,
                              children: value === "OBJECT" || value === "ARRAY" ? row.children ?? [] : []
                            })
                          }
                        />
                      )
                    },
                    {
                      title: "属性",
                      width: 120,
                      render: (_, row) => (
                        <Button size="small" onClick={() => openOutputProperty(row)}>
                          细化属性
                        </Button>
                      )
                    },
                    {
                      title: "操作",
                      width: 80,
                      render: (_, row) => (
                        <Button danger size="small" onClick={() => removeOutputRow(row.id)}>
                          删除
                        </Button>
                      )
                    }
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </Form>
      </Drawer>

      <Modal
        title="细化对象属性"
        open={propertyOpen}
        width={900}
        onCancel={() => setPropertyOpen(false)}
        onOk={saveOutputProperty}
      >
        <Alert type="info" showIcon message="当前面板用于编辑对象/数组的子属性。" style={{ marginBottom: 12 }} />
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={() => setPropertyRows((prev) => [...prev, defaultOutputParam()])}>新增属性</Button>
        </Space>
        <Table<ApiOutputParam>
          rowKey="id"
          pagination={false}
          size="small"
          dataSource={propertyRows}
          scroll={{ x: 860 }}
          columns={[
            {
              title: "字段名",
              width: 180,
              render: (_, row) => (
                <Input
                  value={row.name}
                  onChange={(event) =>
                    setPropertyRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: "路径",
              width: 260,
              render: (_, row) => (
                <Input
                  value={row.path}
                  onChange={(event) =>
                    setPropertyRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, path: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: "描述",
              width: 150,
              render: (_, row) => (
                <Input
                  value={row.description}
                  onChange={(event) =>
                    setPropertyRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, description: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: "类型",
              width: 120,
              render: (_, row) => (
                <Select
                  value={row.valueType}
                  options={valueTypeOptions}
                  onChange={(value) =>
                    setPropertyRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? {
                              ...item,
                              valueType: value as ApiValueType,
                              children: value === "OBJECT" || value === "ARRAY" ? item.children ?? [] : []
                            }
                          : item
                      )
                    )
                  }
                />
              )
            },
            {
              title: "操作",
              width: 80,
              render: (_, row) => (
                <Button danger size="small" onClick={() => setPropertyRows((prev) => prev.filter((item) => item.id !== row.id))}>
                  删除
                </Button>
              )
            }
          ]}
        />
      </Modal>

      <Modal
        title={debugTarget ? `API调试：${debugTarget.name}` : "API调试"}
        open={debugOpen}
        width={980}
        onCancel={() => setDebugOpen(false)}
        onOk={runDebug}
        okText="执行调试"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Card size="small" title="调试环境">
            <Space>
              <Segmented
                value={debugEnv}
                onChange={(value) => setDebugEnv(value as DebugEnv)}
                options={[
                  { label: "测试环境", value: "TEST" },
                  { label: "生产环境", value: "PROD" }
                ]}
              />
              <Typography.Text type="secondary">
                请求路径：
                {debugTarget ? (debugEnv === "TEST" ? debugTarget.testPath : debugTarget.prodPath) : "-"}
              </Typography.Text>
            </Space>
          </Card>

          <Card size="small" title="请求入参(JSON)">
            <Input.TextArea
              rows={8}
              value={debugPayload}
              onChange={(event) => setDebugPayload(event.target.value)}
              placeholder="输入调试请求 JSON"
            />
          </Card>

          {debugResult ? (
            <Row gutter={12}>
              <Col span={12}>
                <Card size="small" title="请求预览">
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    耗时：{debugResult.latencyMs} ms
                  </Typography.Paragraph>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(
                      {
                        path: debugResult.requestPath,
                        body: debugResult.requestBody
                      },
                      null,
                      2
                    )}
                  </pre>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="响应预览">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(debugResult.responseBody, null, 2)}</pre>
                </Card>
              </Col>
            </Row>
          ) : (
            <Alert type="info" showIcon message="点击“执行调试”后展示请求与响应预览。" />
          )}
        </Space>
      </Modal>
    </div>
  );
}
