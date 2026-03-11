import { Alert, Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { useState } from "react";
import type { OperationDefinition, OrchestrationDefinition } from "../types";
import { useAppStore } from "../store/useAppStore";
import { createId, parseJson, prettyJson } from "../utils";

type OperationForm = OperationDefinition;
type OrchestrationForm = Omit<OrchestrationDefinition, "nodes"> & { nodesText: string };

export function OrchestrationsPage() {
  const { operations, orchestrations, interfaces, upsertOperation, upsertOrchestration } = useAppStore();
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
      nodesText: prettyJson([
        {
          node_id: createId("node"),
          node_type: "page_get",
          order: 1,
          enabled: true,
          output_key: "vars.customerNo",
          config: { xpath: "/form/customerNo" }
        }
      ])
    });
    setOrcOpen(true);
  };

  const openEditOrchestration = (row: OrchestrationDefinition) => {
    setEditingOrc(row);
    orcForm.setFieldsValue({
      ...row,
      nodesText: prettyJson(row.nodes)
    });
    setOrcOpen(true);
  };

  return (
    <div>
      {holder}
      <Typography.Title level={4}>智能作业与编排</Typography.Title>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 12 }}
        message="执行规则"
        description="单作业绑定单编排；节点按顺序执行；失败策略固定 STOP；预览时机为编排完成后统一预览。"
      />

      <Space align="start" size={12} style={{ width: "100%" }}>
        <Card
          title="智能作业"
          style={{ flex: 1 }}
          extra={
            <Button size="small" type="primary" onClick={openNewOperation}>
              新增作业
            </Button>
          }
        >
          <Table<OperationDefinition>
            size="small"
            rowKey="operation_id"
            dataSource={operations}
            pagination={false}
            columns={[
              { title: "operation_id", dataIndex: "operation_id", width: 180 },
              { title: "name", dataIndex: "operation_name" },
              { title: "orchestration", dataIndex: "orchestration_id" },
              {
                title: "preview",
                render: (_, row) => (row.preview_mode ? <Tag color="green">ON</Tag> : <Tag>OFF</Tag>)
              },
              {
                title: "floating",
                render: (_, row) => (row.floating_button ? <Tag color="green">ON</Tag> : <Tag>OFF</Tag>)
              },
              {
                title: "action",
                render: (_, row) => (
                  <Button type="link" onClick={() => openEditOperation(row)}>
                    编辑
                  </Button>
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
              新增编排
            </Button>
          }
        >
          <Table<OrchestrationDefinition>
            size="small"
            rowKey="orchestration_id"
            dataSource={orchestrations}
            pagination={false}
            columns={[
              { title: "orchestration_id", dataIndex: "orchestration_id", width: 200 },
              { title: "name", dataIndex: "orchestration_name" },
              { title: "nodes", render: (_, row) => row.nodes.length },
              { title: "status", render: (_, row) => (row.status === "ENABLED" ? <Tag color="green">ENABLED</Tag> : <Tag>DISABLED</Tag>) },
              {
                title: "action",
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
        title={editingOp ? "编辑作业" : "新增作业"}
        open={opOpen}
        onCancel={() => setOpOpen(false)}
        onOk={async () => {
          const values = await opForm.validateFields();
          upsertOperation(values);
          setOpOpen(false);
          msgApi.success("作业保存成功");
        }}
      >
        <Form form={opForm} layout="vertical">
          <Form.Item name="operation_id" label="operation_id" rules={[{ required: true }]}>
            <Input disabled={Boolean(editingOp)} />
          </Form.Item>
          <Form.Item name="operation_name" label="operation_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="orchestration_id" label="orchestration_id" rules={[{ required: true }]}>
            <Select options={orchestrations.map((x) => ({ label: `${x.orchestration_name} (${x.orchestration_id})`, value: x.orchestration_id }))} />
          </Form.Item>
          <Form.Item name="preview_mode" label="preview_mode" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="floating_button" label="floating_button" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingOrc ? "编辑编排" : "新增编排"}
        width={860}
        open={orcOpen}
        onCancel={() => setOrcOpen(false)}
        onOk={async () => {
          try {
            const values = await orcForm.validateFields();
            const nodes = parseJson<OrchestrationDefinition["nodes"]>(values.nodesText);
            const apiNodes = nodes.filter((n) => n.node_type === "api_call");
            for (const node of apiNodes) {
              const interfaceId = String(node.config.interface_id ?? "");
              const hit = interfaces.find((x) => x.interface_id === interfaceId);
              if (!hit || hit.status !== "PUBLISHED") {
                throw new Error(`api_call node references non-published interface: ${interfaceId}`);
              }
            }
            upsertOrchestration({
              orchestration_id: values.orchestration_id,
              orchestration_name: values.orchestration_name,
              status: values.status,
              nodes
            });
            setOrcOpen(false);
            msgApi.success("编排保存成功");
          } catch (e) {
            msgApi.error(String((e as Error).message));
          }
        }}
      >
        <Form form={orcForm} layout="vertical">
          <Form.Item name="orchestration_id" label="orchestration_id" rules={[{ required: true }]}>
            <Input disabled={Boolean(editingOrc)} />
          </Form.Item>
          <Form.Item name="orchestration_name" label="orchestration_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="status" rules={[{ required: true }]}>
            <Select options={["ENABLED", "DISABLED"].map((x) => ({ label: x, value: x }))} />
          </Form.Item>
          <Form.Item name="nodesText" label="nodes (JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={14} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
