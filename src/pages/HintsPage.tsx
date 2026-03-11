import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useMemo, useState } from "react";
import type { ConditionExpression, HintRule } from "../types";
import { useAppStore } from "../store/useAppStore";
import { createId, parseJson, prettyJson } from "../utils";

type HintForm = Omit<HintRule, "conditions"> & { conditionsText: string };

const defaultConditions: ConditionExpression[] = [
  {
    id: "c-1",
    left: { type: "page", xpath: "/form/customerNo" },
    operator: "not_empty",
    right: { type: "fixed", value: "" }
  }
];

export function HintsPage() {
  const { hints, menus, operations, interfaces, upsertHint } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HintRule | null>(null);
  const [form] = Form.useForm<HintForm>();
  const [msgApi, holder] = message.useMessage();

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      id: createId("hint"),
      title: "",
      content: "",
      risk_level: "MEDIUM",
      relation: "AND",
      operation_id: undefined,
      menu_scope_ids: [menus[0]?.id].filter(Boolean) as string[],
      strategy: { ips: [], persons: [], orgs: [] },
      conditionsText: prettyJson(defaultConditions)
    });
    setOpen(true);
  };

  const openEdit = (row: HintRule) => {
    setEditing(row);
    form.setFieldsValue({
      ...row,
      conditionsText: prettyJson(row.conditions)
    });
    setOpen(true);
  };

  const interfaceState = useMemo(() => {
    const statusMap = new Map(interfaces.map((x) => [x.interface_id, x.status]));
    return statusMap;
  }, [interfaces]);

  const validateConditionInterfaces = (conditions: ConditionExpression[]) => {
    for (const condition of conditions) {
      for (const side of [condition.left, condition.right]) {
        if (side.type === "interface") {
          const status = interfaceState.get(side.interface_id);
          if (status !== "PUBLISHED") {
            throw new Error(`Condition references non-published interface: ${side.interface_id}`);
          }
        }
      }
    }
  };

  return (
    <div>
      {holder}
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          智能提示规则
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          新增提示规则
        </Button>
      </Space>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="规则说明"
        description="条件表达式支持固定值/页面元素/接口值，接口值必须引用已发布接口。命中后可联动智能作业。"
      />

      <Table<HintRule>
        rowKey="id"
        dataSource={hints}
        columns={[
          { title: "Rule ID", dataIndex: "id", width: 180 },
          { title: "Title", dataIndex: "title" },
          { title: "Relation", dataIndex: "relation", width: 90 },
          { title: "Risk", render: (_, row) => <Tag color={row.risk_level === "HIGH" ? "red" : row.risk_level === "MEDIUM" ? "gold" : "green"}>{row.risk_level}</Tag> },
          { title: "Operation", dataIndex: "operation_id", render: (x) => x ?? "-" },
          {
            title: "Action",
            render: (_, row) => (
              <Button type="link" onClick={() => openEdit(row)}>
                编辑
              </Button>
            )
          }
        ]}
      />

      <Modal
        title={editing ? "编辑提示规则" : "新增提示规则"}
        width={900}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const conditions = parseJson<ConditionExpression[]>(values.conditionsText);
            validateConditionInterfaces(conditions);
            const payload: HintRule = {
              id: values.id,
              title: values.title,
              content: values.content,
              risk_level: values.risk_level,
              relation: values.relation,
              operation_id: values.operation_id,
              menu_scope_ids: values.menu_scope_ids,
              strategy: values.strategy,
              conditions
            };
            upsertHint(payload);
            setOpen(false);
            msgApi.success("规则保存成功");
          } catch (e) {
            msgApi.error(String((e as Error).message));
          }
        }}
      >
        <Form<HintForm> form={form} layout="vertical">
          <Space style={{ width: "100%" }} align="start">
            <Form.Item name="id" label="rule_id" rules={[{ required: true }]} style={{ minWidth: 220 }}>
              <Input disabled={Boolean(editing)} />
            </Form.Item>
            <Form.Item name="relation" label="relation" rules={[{ required: true }]} style={{ minWidth: 160 }}>
              <Select options={[{ label: "AND", value: "AND" }, { label: "OR", value: "OR" }]} />
            </Form.Item>
            <Form.Item name="risk_level" label="risk_level" rules={[{ required: true }]} style={{ minWidth: 160 }}>
              <Select options={["LOW", "MEDIUM", "HIGH"].map((x) => ({ label: x, value: x }))} />
            </Form.Item>
          </Space>
          <Form.Item name="title" label="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="content" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="menu_scope_ids" label="menu_scope_ids" rules={[{ required: true }]}>
            <Select mode="multiple" options={menus.map((x) => ({ label: x.menu, value: x.id }))} />
          </Form.Item>
          <Form.Item name="operation_id" label="linked operation">
            <Select allowClear options={operations.map((x) => ({ label: x.operation_name, value: x.operation_id }))} />
          </Form.Item>
          <Form.Item name={["strategy", "ips"]} label="strategy.ips (optional)">
            <Select mode="tags" open={false} />
          </Form.Item>
          <Form.Item name={["strategy", "persons"]} label="strategy.persons (optional)">
            <Select mode="tags" open={false} />
          </Form.Item>
          <Form.Item name={["strategy", "orgs"]} label="strategy.orgs (optional)">
            <Select mode="tags" open={false} />
          </Form.Item>
          <Form.Item
            name="conditionsText"
            label="conditions (JSON)"
            tooltip="Each condition contains left/operator/right, plus optional preprocessors."
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={12} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
