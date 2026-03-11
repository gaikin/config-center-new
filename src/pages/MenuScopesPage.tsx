import { Button, Form, Input, Modal, Space, Switch, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { MenuScope } from "../types";
import { createId } from "../utils";

export function MenuScopesPage() {
  const { menus, upsertMenu } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuScope | null>(null);
  const [form] = Form.useForm<MenuScope>();

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ id: createId("menu"), zone: "", menu: "", enabledHint: true, enabledOperation: true });
    setOpen(true);
  };

  const openEdit = (item: MenuScope) => {
    setEditing(item);
    form.setFieldsValue(item);
    setOpen(true);
  };

  return (
    <div>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          菜单级启停
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          新增菜单范围
        </Button>
      </Space>

      <Table<MenuScope>
        rowKey="id"
        dataSource={menus}
        columns={[
          { title: "Menu Scope ID", dataIndex: "id" },
          { title: "专区", dataIndex: "zone" },
          { title: "业务菜单", dataIndex: "menu" },
          {
            title: "智能提示",
            render: (_, row) => (row.enabledHint ? <Tag color="green">ENABLED</Tag> : <Tag>DISABLED</Tag>)
          },
          {
            title: "智能作业",
            render: (_, row) => (row.enabledOperation ? <Tag color="green">ENABLED</Tag> : <Tag>DISABLED</Tag>)
          },
          {
            title: "操作",
            render: (_, row) => (
              <Button type="link" onClick={() => openEdit(row)}>
                编辑
              </Button>
            )
          }
        ]}
      />

      <Modal
        title={editing ? "编辑菜单范围" : "新增菜单范围"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          upsertMenu(values);
          setOpen(false);
        }}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="id" label="ID" rules={[{ required: true }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="zone" label="专区" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="menu" label="业务菜单" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="enabledHint" label="启用智能提示" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enabledOperation" label="启用智能作业" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
