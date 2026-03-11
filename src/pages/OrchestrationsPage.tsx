import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { useState } from "react";
import type { OperationDefinition, OrchestrationDefinition, OrchestrationNode } from "../types";
import { useAppStore } from "../store/useAppStore";
import { createId } from "../utils";
import { idRule, maxLenRule, requiredRule, xpathLikeRule } from "../validation/formRules";

type OperationForm = OperationDefinition;

type NodeRow = {
  node_id: string;
  node_type: OrchestrationNode["node_type"];
  order: number;
  enabled: boolean;
  output_key?: string;
  xpath?: string;
  interface_id?: string;
  value_path?: string;
  template?: string;
  custom_desc?: string;
};

type OrchestrationForm = Omit<OrchestrationDefinition, "nodes"> & { nodes: NodeRow[] };

function createDefaultNodeRow(): NodeRow {
  return {
    node_id: createId("node"),
    node_type: "page_get",
    order: 1,
    enabled: true,
    output_key: "vars.customerNo",
    xpath: "/form/customerNo"
  };
}

function mapNodeToRow(node: OrchestrationNode): NodeRow {
  const config = node.config ?? {};
  if (node.node_type === "page_get") {
    return {
      node_id: node.node_id,
      node_type: node.node_type,
      order: node.order,
      enabled: node.enabled,
      output_key: node.output_key,
      xpath: String(config.xpath ?? "")
    };
  }
  if (node.node_type === "page_set") {
    return {
      node_id: node.node_id,
      node_type: node.node_type,
      order: node.order,
      enabled: node.enabled,
      output_key: node.output_key,
      xpath: String(config.xpath ?? ""),
      value_path: String(config.value_path ?? "")
    };
  }
  if (node.node_type === "api_call") {
    return {
      node_id: node.node_id,
      node_type: node.node_type,
      order: node.order,
      enabled: node.enabled,
      output_key: node.output_key,
      interface_id: String(config.interface_id ?? "")
    };
  }
  if (node.node_type === "js_script") {
    return {
      node_id: node.node_id,
      node_type: node.node_type,
      order: node.order,
      enabled: node.enabled,
      output_key: node.output_key,
      template: String(config.template ?? "")
    };
  }
  return {
    node_id: node.node_id,
    node_type: node.node_type,
    order: node.order,
    enabled: node.enabled,
    output_key: node.output_key,
    custom_desc: String(config.description ?? "")
  };
}

function buildNodeConfig(row: NodeRow): Record<string, unknown> {
  if (row.node_type === "page_get") {
    return { xpath: row.xpath ?? "" };
  }
  if (row.node_type === "page_set") {
    return {
      xpath: row.xpath ?? "",
      value_source_type: "context",
      value_path: row.value_path ?? ""
    };
  }
  if (row.node_type === "api_call") {
    return { interface_id: row.interface_id ?? "" };
  }
  if (row.node_type === "js_script") {
    return { mode: "template", template: row.template ?? "" };
  }
  return { description: row.custom_desc ?? "" };
}

function NodeConfigEditor({
  rowIndex,
  interfaces
}: {
  rowIndex: number;
  interfaces: Array<{ interface_id: string; interface_name: string; status: string }>;
}) {
  return (
    <Form.Item
      noStyle
      shouldUpdate={(prevValues, currentValues) =>
        prevValues.nodes?.[rowIndex]?.node_type !== currentValues.nodes?.[rowIndex]?.node_type
      }
    >
      {({ getFieldValue }) => {
        const nodeType = getFieldValue(["nodes", rowIndex, "node_type"]) as OrchestrationNode["node_type"] | undefined;

        if (nodeType === "page_get") {
          return (
            <Form.Item
              name={[rowIndex, "xpath"]}
              label="页面定位"
              rules={[requiredRule("页面定位"), xpathLikeRule]}
              style={{ minWidth: 260 }}
            >
              <Input placeholder="例如：/form/customerNo" />
            </Form.Item>
          );
        }

        if (nodeType === "page_set") {
          return (
            <Space align="start" size={8}>
              <Form.Item
                name={[rowIndex, "xpath"]}
                label="目标定位"
                rules={[requiredRule("目标定位"), xpathLikeRule]}
                style={{ minWidth: 240 }}
              >
                <Input placeholder="例如：/form/customerName" />
              </Form.Item>
              <Form.Item
                name={[rowIndex, "value_path"]}
                label="取值路径"
                rules={[requiredRule("取值路径")]}
                style={{ minWidth: 220 }}
              >
                <Input placeholder="例如：vars.customerName" />
              </Form.Item>
            </Space>
          );
        }

        if (nodeType === "api_call") {
          return (
            <Form.Item
              name={[rowIndex, "interface_id"]}
              label="调用接口"
              rules={[requiredRule("调用接口")]}
              style={{ minWidth: 300 }}
            >
              <Select
                options={interfaces.map((item) => ({
                  label: `${item.interface_name}（${item.interface_id}｜${item.status === "PUBLISHED" ? "已发布" : "未发布"}）`,
                  value: item.interface_id
                }))}
              />
            </Form.Item>
          );
        }

        if (nodeType === "js_script") {
          return (
            <Form.Item
              name={[rowIndex, "template"]}
              label="脚本模板"
              rules={[requiredRule("脚本模板"), maxLenRule("脚本模板", 500)]}
              style={{ minWidth: 420 }}
            >
              <Input.TextArea rows={2} placeholder="例如：{{vars.customerData.data.customerName}}" />
            </Form.Item>
          );
        }

        return (
          <Form.Item
            name={[rowIndex, "custom_desc"]}
            label="自定义说明"
            rules={[requiredRule("自定义说明"), maxLenRule("自定义说明", 200)]}
            style={{ minWidth: 420 }}
          >
            <Input.TextArea rows={2} placeholder="描述该自定义节点的执行逻辑" />
          </Form.Item>
        );
      }}
    </Form.Item>
  );
}

export function OrchestrationsPage() {
  const { operations, orchestrations, interfaces, upsertOperation, publishOperation, upsertOrchestration } = useAppStore();
  const [opOpen, setOpOpen] = useState(false);
  const [orcOpen, setOrcOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<OperationDefinition | null>(null);
  const [editingOrc, setEditingOrc] = useState<OrchestrationDefinition | null>(null);
  const [opForm] = Form.useForm<OperationForm>();
  const [orcForm] = Form.useForm<OrchestrationForm>();
  const [msgApi, holder] = message.useMessage();

  const openNewOperation = () => {
    setEditingOp(null);
    opForm.setFieldsValue({
      operation_id: createId("op"),
      operation_name: "",
      preview_mode: true,
      floating_button: true,
      status: "DRAFT",
      orchestration_id: orchestrations[0]?.orchestration_id
    });
    setOpOpen(true);
  };

  const openEditOperation = (row: OperationDefinition) => {
    setEditingOp(row);
    opForm.setFieldsValue(row);
    setOpOpen(true);
  };

  const openNewOrchestration = () => {
    setEditingOrc(null);
    orcForm.setFieldsValue({
      orchestration_id: createId("orc"),
      orchestration_name: "",
      status: "ENABLED",
      nodes: [createDefaultNodeRow()]
    });
    setOrcOpen(true);
  };

  const openEditOrchestration = (row: OrchestrationDefinition) => {
    setEditingOrc(row);
    orcForm.setFieldsValue({
      orchestration_id: row.orchestration_id,
      orchestration_name: row.orchestration_name,
      status: row.status,
      nodes: row.nodes.map(mapNodeToRow)
    });
    setOrcOpen(true);
  };

  return (
    <div>
      {holder}
      <Typography.Title level={4}>作业与编排</Typography.Title>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 12 }}
        message="执行规则"
        description="编排支持可视化节点编辑；一个作业绑定一个编排；失败策略为停止（STOP）。"
      />

      <Space align="start" size={12} style={{ width: "100%" }}>
        <Card
          title="智能作业"
          style={{ flex: 1 }}
          extra={
            <Button size="small" type="primary" onClick={openNewOperation}>
              新建作业
            </Button>
          }
        >
          <Table<OperationDefinition>
            size="small"
            rowKey="operation_id"
            dataSource={operations}
            pagination={false}
            columns={[
              { title: "作业ID", dataIndex: "operation_id", width: 180 },
              { title: "名称", dataIndex: "operation_name" },
              { title: "绑定编排", dataIndex: "orchestration_id" },
              {
                title: "状态",
                render: (_, row) => (
                  <Tag color={row.status === "PUBLISHED" ? "green" : "default"}>
                    {row.status === "PUBLISHED" ? "已发布" : "草稿"}
                  </Tag>
                )
              },
              { title: "预览模式", render: (_, row) => (row.preview_mode ? <Tag color="green">开启</Tag> : <Tag>关闭</Tag>) },
              { title: "悬浮触发", render: (_, row) => (row.floating_button ? <Tag color="green">开启</Tag> : <Tag>关闭</Tag>) },
              {
                title: "操作",
                render: (_, row) => (
                  <Space>
                    <Button type="link" onClick={() => openEditOperation(row)}>
                      编辑
                    </Button>
                    <Button
                      type="link"
                      onClick={() => {
                        publishOperation(row.operation_id);
                        msgApi.success("作业已发布。");
                      }}
                    >
                      发布
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        </Card>

        <Card
          title="编排定义"
          style={{ flex: 1 }}
          extra={
            <Button size="small" type="primary" onClick={openNewOrchestration}>
              新建编排
            </Button>
          }
        >
          <Table<OrchestrationDefinition>
            size="small"
            rowKey="orchestration_id"
            dataSource={orchestrations}
            pagination={false}
            columns={[
              { title: "编排ID", dataIndex: "orchestration_id", width: 200 },
              { title: "名称", dataIndex: "orchestration_name" },
              { title: "节点数", render: (_, row) => row.nodes.length },
              {
                title: "状态",
                render: (_, row) =>
                  row.status === "ENABLED" ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>
              },
              {
                title: "操作",
                render: (_, row) => (
                  <Button type="link" onClick={() => openEditOrchestration(row)}>
                    编辑
                  </Button>
                )
              }
            ]}
          />
        </Card>
      </Space>

      <Modal
        title={editingOp ? "编辑作业" : "新建作业"}
        open={opOpen}
        onCancel={() => setOpOpen(false)}
        onOk={async () => {
          const values = await opForm.validateFields();
          upsertOperation(values);
          setOpOpen(false);
          msgApi.success("作业保存成功。");
        }}
      >
        <Form form={opForm} layout="vertical">
          <Form.Item name="operation_id" label="作业ID" rules={[requiredRule("作业ID"), idRule("作业ID", "op-")]}>
            <Input disabled={Boolean(editingOp)} />
          </Form.Item>
          <Form.Item name="operation_name" label="作业名称" rules={[requiredRule("作业名称"), maxLenRule("作业名称", 80)]}>
            <Input />
          </Form.Item>
          <Form.Item name="orchestration_id" label="编排ID" rules={[requiredRule("编排ID")]}>
            <Select
              options={orchestrations.map((item) => ({
                label: `${item.orchestration_name}（${item.orchestration_id}）`,
                value: item.orchestration_id
              }))}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[requiredRule("状态")]}>
            <Select options={[{ label: "草稿", value: "DRAFT" }, { label: "已发布", value: "PUBLISHED" }]} />
          </Form.Item>
          <Form.Item name="preview_mode" label="预览模式" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="floating_button" label="悬浮触发" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingOrc ? "编辑编排" : "新建编排"}
        width={1000}
        open={orcOpen}
        onCancel={() => setOrcOpen(false)}
        onOk={async () => {
          try {
            const values = await orcForm.validateFields();
            if (!values.nodes || values.nodes.length === 0) {
              throw new Error("请至少配置一个节点。");
            }

            const nodes = [...values.nodes]
              .sort((a, b) => a.order - b.order)
              .map((node) => ({
                node_id: node.node_id,
                node_type: node.node_type,
                order: node.order,
                enabled: node.enabled,
                output_key: node.output_key,
                config: buildNodeConfig(node)
              }));

            const apiNodes = nodes.filter((node) => node.node_type === "api_call");
            for (const node of apiNodes) {
              const interfaceId = String(node.config.interface_id ?? "");
              const found = interfaces.find((item) => item.interface_id === interfaceId);
              if (!found || found.status !== "PUBLISHED") {
                throw new Error(`接口调用节点引用了未发布接口：${interfaceId}`);
              }
            }

            upsertOrchestration({
              orchestration_id: values.orchestration_id,
              orchestration_name: values.orchestration_name,
              status: values.status,
              updated_at: new Date().toISOString(),
              nodes
            });
            setOrcOpen(false);
            msgApi.success("编排保存成功。");
          } catch (error) {
            msgApi.error(String((error as Error).message));
          }
        }}
      >
        <Form form={orcForm} layout="vertical">
          <Form.Item
            name="orchestration_id"
            label="编排ID"
            rules={[requiredRule("编排ID"), idRule("编排ID", "orc-")]}
          >
            <Input disabled={Boolean(editingOrc)} />
          </Form.Item>
          <Form.Item
            name="orchestration_name"
            label="编排名称"
            rules={[requiredRule("编排名称"), maxLenRule("编排名称", 80)]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[requiredRule("状态")]}>
            <Select options={[{ label: "启用", value: "ENABLED" }, { label: "停用", value: "DISABLED" }]} />
          </Form.Item>

          <Form.List name="nodes">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`节点 ${index + 1}`}
                    extra={
                      <Button danger type="link" onClick={() => remove(field.name)}>
                        删除节点
                      </Button>
                    }
                  >
                    <Space wrap align="start" size={8} style={{ width: "100%" }}>
                      <Form.Item
                        name={[field.name, "node_id"]}
                        label="节点ID"
                        rules={[requiredRule("节点ID"), idRule("节点ID", "node-")]}
                        style={{ minWidth: 240 }}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "node_type"]}
                        label="节点类型"
                        rules={[requiredRule("节点类型")]}
                        style={{ minWidth: 160 }}
                      >
                        <Select
                          options={[
                            { label: "页面取值", value: "page_get" },
                            { label: "页面回填", value: "page_set" },
                            { label: "接口调用", value: "api_call" },
                            { label: "脚本模板", value: "js_script" },
                            { label: "自定义节点", value: "custom" }
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "order"]}
                        label="执行顺序"
                        rules={[requiredRule("执行顺序")]}
                        style={{ minWidth: 120 }}
                      >
                        <InputNumber min={1} precision={0} style={{ width: "100%" }} />
                      </Form.Item>
                      <Form.Item name={[field.name, "enabled"]} label="启用" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "output_key"]}
                        label="输出变量（可选）"
                        rules={[maxLenRule("输出变量", 120)]}
                        style={{ minWidth: 220 }}
                      >
                        <Input placeholder="例如：vars.customerNo" />
                      </Form.Item>
                    </Space>

                    <NodeConfigEditor
                      rowIndex={field.name}
                      interfaces={interfaces.map((item) => ({
                        interface_id: item.interface_id,
                        interface_name: item.interface_name,
                        status: item.status
                      }))}
                    />
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add(createDefaultNodeRow())} style={{ width: "100%" }}>
                  新增节点
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
