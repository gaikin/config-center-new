import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { OrgSelect } from "../../components/DirectoryFields";
import { ValidationReportPanel } from "../../components/ValidationReportPanel";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { getOrgLabel } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import { workflowService } from "../../services/workflowService";
import type { JobNodeDefinition, JobSceneDefinition, ListDataBuildStatus, ListDataDefinition, RuleCondition, RuleDefinition, SaveValidationReport } from "../../types";

type ListDataForm = {
  name: string;
  description: string;
  ownerOrgId: string;
  scope: string;
  effectiveStartAt: string;
  effectiveEndAt: string;
  status: ListDataDefinition["status"];
  importFileName: string;
  importColumns: string[];
  outputFields: string[];
  rowCount: number;
};

type ListDataPageProps = {
  embedded?: boolean;
};

type ReferenceSummary = {
  rules: RuleDefinition[];
  scenes: JobSceneDefinition[];
};

const buildStatusColor: Record<ListDataBuildStatus, string> = {
  PENDING: "default",
  BUILDING: "processing",
  READY: "green",
  FAILED: "red"
};

const buildStatusLabel: Record<ListDataBuildStatus, string> = {
  PENDING: "待建索引",
  BUILDING: "建索引中",
  READY: "索引就绪",
  FAILED: "索引失败"
};

function parseNodeConfig(configJson: string) {
  try {
    return JSON.parse(configJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function ListDataPage({ embedded = false }: ListDataPageProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ListDataDefinition[]>([]);
  const [references, setReferences] = useState<Record<number, ReferenceSummary>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ListDataDefinition | null>(null);
  const [buildingId, setBuildingId] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<SaveValidationReport | null>(null);
  const [parsedFileName, setParsedFileName] = useState("");
  const [form] = Form.useForm<ListDataForm>();
  const [msgApi, holder] = message.useMessage();
  const importFileName = Form.useWatch("importFileName", form) ?? "";
  const importColumns = Form.useWatch("importColumns", form) ?? [];
  const outputFieldOptions = useMemo(
    () => importColumns.map((item) => ({ label: item, value: item })),
    [importColumns]
  );
  const needsReparse = Boolean(parsedFileName && parsedFileName !== importFileName.trim());

  async function loadData() {
    setLoading(true);
    try {
      const [listDatas, rules, scenes] = await Promise.all([
        configCenterService.listListDatas(),
        configCenterService.listRules(),
        configCenterService.listJobScenes()
      ]);
      const ruleConditions = (await Promise.all(rules.map((rule) => workflowService.listRuleConditions(rule.id)))).flat();
      const nodeGroups = await Promise.all(scenes.map((scene) => workflowService.listJobNodes(scene.id)));
      const nodes = nodeGroups.flat();
      const nextRefs = buildReferences(listDatas, rules, ruleConditions, scenes, nodes);
      setRows(listDatas);
      setReferences(nextRefs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const ruleReferenceCount = useMemo(
    () => Object.values(references).reduce((sum, item) => sum + item.rules.length + item.scenes.length, 0),
    [references]
  );

  function openCreate() {
    setEditing(null);
    setReport(null);
    setParsedFileName("");
    form.setFieldsValue({
      name: "",
      description: "",
      ownerOrgId: "branch-east",
      scope: "",
      effectiveStartAt: "2026-03-15",
      effectiveEndAt: "2026-12-31",
      status: "DRAFT",
      importFileName: "",
      importColumns: [],
      outputFields: [],
      rowCount: 1
    });
    setOpen(true);
  }

  function openEdit(row: ListDataDefinition) {
    setEditing(row);
    setReport(null);
    setParsedFileName(row.importFileName);
    form.setFieldsValue({
      name: row.name,
      description: row.description,
      ownerOrgId: row.ownerOrgId,
      scope: row.scope,
      effectiveStartAt: row.effectiveStartAt,
      effectiveEndAt: row.effectiveEndAt,
      status: row.status,
      importFileName: row.importFileName,
      importColumns: row.importColumns,
      outputFields: row.outputFields,
      rowCount: row.rowCount
    });
    setOpen(true);
  }

  async function submit() {
    await form.validateFields();
    const values = form.getFieldsValue(true) as ListDataForm;
    if (parsedFileName !== values.importFileName.trim()) {
      msgApi.error("导入文件已变更，请重新解析表头后再保存");
      return;
    }
    setSaving(true);
    try {
      const result = await configCenterService.saveListDataDraft({
        id: editing?.id ?? Date.now() + Math.floor(Math.random() * 1000),
        currentVersion: editing?.currentVersion ?? 1,
        indexBuildStatus: editing?.indexBuildStatus ?? "PENDING",
        activeAlias: editing?.activeAlias ?? "",
        updatedAt: editing?.updatedAt,
        ...values
      });
      setReport(result.report);
      if (!result.success) {
        msgApi.error(result.report.summary);
        return;
      }
      msgApi.success(editing ? "名单数据已更新" : "名单数据已创建");
      setOpen(false);
      setEditing(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function buildIndex(row: ListDataDefinition) {
    setBuildingId(row.id);
    try {
      await configCenterService.buildListDataIndex(row.id);
      msgApi.success(`已完成索引构建：${row.name}`);
      await loadData();
    } finally {
      setBuildingId(undefined);
    }
  }

  async function toggleStatus(row: ListDataDefinition) {
    const next = row.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await configCenterService.updateListDataStatus(row.id, next);
    msgApi.success(`名单状态已切换为 ${lifecycleLabelMap[next]}`);
    await loadData();
  }

  async function previewImportColumns() {
    const fileName = importFileName.trim();
    if (!fileName) {
      msgApi.warning("请先填写导入文件名");
      return;
    }

    const preview = await configCenterService.previewListDataImport(fileName);
    const currentOutputFields = form.getFieldValue("outputFields") ?? [];
    form.setFieldsValue({
      importColumns: preview.importColumns,
      outputFields: currentOutputFields.filter((item: string) => preview.importColumns.includes(item)),
      rowCount: preview.rowCount
    });
    setParsedFileName(fileName);
    setReport(null);
    msgApi.success(`已解析 ${preview.importColumns.length} 个字段，请继续选择输出字段`);
  }

  return (
    <div>
      {holder}
      {!embedded ? <Typography.Title level={4}>名单数据</Typography.Title> : null}
      <Typography.Paragraph type="secondary">
        统一维护名单资产、导入解析、导入字段与输出字段。规则与作业在运行时选择匹配字段，不再把检索字段固化在名单资产上。
      </Typography.Paragraph>

      <Card
        extra={
          <Space>
            <Tag color="blue">名单数 {rows.length}</Tag>
            <Tag>引用总数 {ruleReferenceCount}</Tag>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建名单
            </Button>
          </Space>
        }
      >
        <Table<ListDataDefinition>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: [6, 10, 20] }}
          columns={[
            { title: "名单名称", dataIndex: "name", width: 180 },
            {
              title: "归属机构",
              dataIndex: "ownerOrgId",
              width: 120,
              render: (value: string) => getOrgLabel(value)
            },
            { title: "适用范围", dataIndex: "scope", width: 180 },
            {
              title: "有效期",
              width: 200,
              render: (_, row) => `${row.effectiveStartAt} ~ ${row.effectiveEndAt}`
            },
            { title: "数据条数", dataIndex: "rowCount", width: 90 },
            {
              title: "导入字段",
              width: 220,
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  {row.importColumns.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              )
            },
            {
              title: "输出字段数",
              width: 100,
              render: (_, row) => row.outputFields.length
            },
            {
              title: "索引状态",
              width: 120,
              render: (_, row) => <Tag color={buildStatusColor[row.indexBuildStatus]}>{buildStatusLabel[row.indexBuildStatus]}</Tag>
            },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={row.status === "ACTIVE" ? "green" : row.status === "DRAFT" ? "default" : "orange"}>{lifecycleLabelMap[row.status]}</Tag>
            },
            {
              title: "引用关系",
              width: 240,
              render: (_, row) => {
                const ref = references[row.id];
                const total = (ref?.rules.length ?? 0) + (ref?.scenes.length ?? 0);
                if (!ref || total === 0) {
                  return <Typography.Text type="secondary">暂无引用</Typography.Text>;
                }
                return (
                  <Space size={[4, 4]} wrap>
                    {ref.rules.map((rule) => (
                      <Tag key={`rule-${rule.id}`} color="processing">
                        规则：{rule.name}
                      </Tag>
                    ))}
                    {ref.scenes.map((scene) => (
                      <Tag key={`scene-${scene.id}`} color="purple">
                        作业：{scene.name}
                      </Tag>
                    ))}
                  </Space>
                );
              }
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 260,
              render: (_, row) => (
                <Space wrap>
                  <Button size="small" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    loading={buildingId === row.id}
                    disabled={row.indexBuildStatus === "BUILDING"}
                    onClick={() => void buildIndex(row)}
                  >
                    {row.indexBuildStatus === "READY" ? "重建索引" : "构建索引"}
                  </Button>
                  <Popconfirm
                    title={row.status === "ACTIVE" ? "确认停用该名单？" : "确认启用该名单？"}
                    onConfirm={() => void toggleStatus(row)}
                  >
                    <Button size="small">{row.status === "ACTIVE" ? "停用" : "启用"}</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editing ? `编辑名单：${editing.name}` : "新建名单"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={saving}
        width={760}
      >
        <ValidationReportPanel report={report} title="保存前检查结果" />
        <Form form={form} layout="vertical">
          <Card size="small" title="基础信息" style={{ marginBottom: 12 }}>
            <Form.Item name="name" label="名单名称" rules={[{ required: true, message: "请输入名单名称" }]}>
              <Input placeholder="如：高风险客户名单" />
            </Form.Item>
            <Form.Item name="description" label="名单说明">
              <Input.TextArea rows={3} placeholder="说明名单用途、适用场景和维护责任" />
            </Form.Item>
            <Form.Item name="ownerOrgId" label="归属机构" rules={[{ required: true, message: "请选择归属机构" }]}>
              <OrgSelect />
            </Form.Item>
            <Form.Item name="scope" label="适用范围" rules={[{ required: true, message: "请输入适用范围" }]}>
              <Input placeholder="如：贷款专区 / 东部分行" />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select options={lifecycleOptions} />
            </Form.Item>
            <Form.Item name="effectiveStartAt" label="生效开始时间" rules={[{ required: true, message: "请输入开始时间" }]}>
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="effectiveEndAt" label="生效结束时间" rules={[{ required: true, message: "请输入结束时间" }]}>
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
          </Card>

          <Card size="small" title="导入与解析">
            <Form.Item label="导入文件" required extra="先录入文件名并解析表头，再从解析结果中选择需要输出的字段。">
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item name="importFileName" noStyle rules={[{ required: true, message: "请输入导入文件名" }]}>
                  <Input placeholder="如：high-risk-customers.xlsx" />
                </Form.Item>
                <Button onClick={() => void previewImportColumns()}>解析表头</Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item
              label="导入字段预览"
              required
              extra="由平台根据导入文件解析生成，只读展示；规则与作业运行时从这些字段里选择匹配字段。"
              validateStatus={importColumns.length === 0 ? "error" : undefined}
              help={
                importColumns.length === 0
                  ? "请先解析表头"
                  : needsReparse
                    ? "导入文件已变更，请重新解析表头"
                    : `已解析 ${importColumns.length} 个字段`
              }
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Form.Item
                  name="importColumns"
                  hidden
                  rules={[
                    {
                      validator: async (_, value: string[] | undefined) => {
                        if (Array.isArray(value) && value.length > 0) {
                          return;
                        }
                        throw new Error("请先解析表头");
                      }
                    }
                  ]}
                >
                  <Select mode="multiple" options={outputFieldOptions} />
                </Form.Item>
                {importColumns.length > 0 ? (
                  <Space size={[4, 8]} wrap>
                    {importColumns.map((item) => (
                      <Tag key={item}>{item}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">尚未生成字段预览</Typography.Text>
                )}
              </Space>
            </Form.Item>
            <Form.Item
              name="outputFields"
              label="输出字段"
              extra="由上传名单的业务人员从解析表头中选择，供规则条件或作业节点下拉引用。"
              rules={[{ required: true, message: "请至少选择一个输出字段" }]}
            >
              <Select
                mode="multiple"
                allowClear
                options={outputFieldOptions}
                disabled={importColumns.length === 0}
                placeholder={importColumns.length === 0 ? "请先解析表头" : "请选择需要暴露给下游的输出字段"}
              />
            </Form.Item>
            <Form.Item name="rowCount" label="数据条数" rules={[{ required: true, message: "请输入数据条数" }]}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            {editing ? (
              <Space direction="vertical" size={4}>
                <Typography.Text type="secondary">
                  当前索引状态：{buildStatusLabel[editing.indexBuildStatus]}
                </Typography.Text>
                <Typography.Text type="secondary">当前生效别名：{editing.activeAlias || "-"}</Typography.Text>
              </Space>
            ) : null}
          </Card>
        </Form>
      </Modal>
    </div>
  );
}

function buildReferences(
  listDatas: ListDataDefinition[],
  rules: RuleDefinition[],
  conditions: RuleCondition[],
  scenes: JobSceneDefinition[],
  nodes: JobNodeDefinition[]
) {
  const summary: Record<number, ReferenceSummary> = {};
  for (const row of listDatas) {
    summary[row.id] = { rules: [], scenes: [] };
  }

  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  for (const condition of conditions) {
    for (const operand of [condition.left, condition.right]) {
      const listDataId = operand?.sourceType === "LIST_LOOKUP_FIELD" ? operand.listBinding?.listDataId : undefined;
      const rule = ruleMap.get(condition.ruleId);
      if (!listDataId || !rule || !summary[listDataId]) {
        continue;
      }
      if (!summary[listDataId].rules.some((item) => item.id === rule.id)) {
        summary[listDataId].rules.push(rule);
      }
    }
  }

  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  for (const node of nodes) {
    if (node.nodeType !== "list_lookup") {
      continue;
    }
    const config = parseNodeConfig(node.configJson);
    const listDataId = typeof config.listDataId === "number" ? config.listDataId : undefined;
    const scene = sceneMap.get(node.sceneId);
    if (!listDataId || !scene || !summary[listDataId]) {
      continue;
    }
    if (!summary[listDataId].scenes.some((item) => item.id === scene.id)) {
      summary[listDataId].scenes.push(scene);
    }
  }

  return summary;
}
