import { Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { OrgSelect, OrgText } from "../../components/DirectoryFields";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { configCenterService } from "../../services/configCenterService";
import { createId } from "../../utils";
import type { BusinessFieldDefinition } from "../../types";

type PublicFieldFormValues = Pick<BusinessFieldDefinition, "name" | "description" | "required" | "ownerOrgId" | "status">;

export function PublicFieldsPage({ embedded = false }: { embedded?: boolean }) {
  const [rows, setRows] = useState<BusinessFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessFieldDefinition | null>(null);
  const [form] = Form.useForm<PublicFieldFormValues>();
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const fieldRows = await configCenterService.listBusinessFields();
      setRows(fieldRows.filter((item) => item.scope === "GLOBAL"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      name: "",
      description: "",
      required: false,
      ownerOrgId: "head-office",
      status: "DRAFT"
    });
    setOpen(true);
  }

  function openEdit(row: BusinessFieldDefinition) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      description: row.description,
      required: row.required,
      ownerOrgId: row.ownerOrgId,
      status: row.status
    });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertBusinessField({
      id: editing?.id ?? Date.now(),
      code: editing?.code ?? createId("field"),
      name: values.name,
      scope: "GLOBAL",
      pageResourceId: undefined,
      valueType: editing?.valueType ?? "STRING",
      required: values.required,
      description: values.description,
      ownerOrgId: values.ownerOrgId,
      status: values.status,
      currentVersion: editing?.currentVersion ?? 1,
      aliases: editing?.aliases ?? []
    });
    msgApi.success(editing ? "公共字段已更新" : "公共字段已创建");
    setOpen(false);
    await loadData();
  }

  return (
    <div>
      {holder}
      {!embedded ? <Typography.Title level={4}>公共字段治理</Typography.Title> : null}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        这里维护跨页面复用的公共字段。页面特有字段仍然在菜单管理详情的元素映射抽屉中按需补充。
      </Typography.Paragraph>

      <Card
        extra={
          <Space>
            <Tag color="blue">公共字段 {rows.length}</Tag>
            <Button type="primary" onClick={openCreate}>
              新增公共字段
            </Button>
          </Space>
        }
      >
        <Table<BusinessFieldDefinition>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            { title: "字段名称", dataIndex: "name", width: 180 },
            { title: "说明", dataIndex: "description" },
            {
              title: "归属组织",
              dataIndex: "ownerOrgId",
              width: 140,
              render: (value: string) => <OrgText value={value} />
            },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag>{lifecycleLabelMap[row.status]}</Tag>
            },
            {
              title: "操作",
              width: 100,
              render: (_, row) => (
                <Button size="small" onClick={() => openEdit(row)}>
                  编辑
                </Button>
              )
            }
          ]}
        />
      </Card>

      <Modal title={editing ? "编辑公共字段" : "新增公共字段"} open={open} onCancel={() => setOpen(false)} onOk={() => void submit()}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="字段名称" rules={[{ required: true, message: "请输入字段名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="归属组织" rules={[{ required: true, message: "请选择归属组织" }]}>
            <OrgSelect />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={lifecycleOptions} />
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
