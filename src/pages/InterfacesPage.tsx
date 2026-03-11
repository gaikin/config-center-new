import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useMemo, useState } from "react";
import type { InterfaceDefinition } from "../types";
import { useAppStore } from "../store/useAppStore";
import { createId } from "../utils";

const methodOptions: InterfaceDefinition["method"][] = ["GET", "POST", "PUT", "DELETE"];
const authOptions: InterfaceDefinition["auth_type"][] = ["NONE", "TOKEN", "AKSK", "CUSTOM"];

export function InterfacesPage() {
  const { interfaces, upsertInterface, publishInterface, offlineInterface } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InterfaceDefinition | null>(null);
  const [form] = Form.useForm<InterfaceDefinition>();
  const [msgApi, holder] = message.useMessage();

  const statusTag = useMemo(
    () => ({
      DRAFT: <Tag color="default">DRAFT</Tag>,
      PUBLISHED: <Tag color="green">PUBLISHED</Tag>,
      OFFLINE: <Tag color="red">OFFLINE</Tag>
    }),
    []
  );

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      interface_id: createId("if"),
      interface_name: "",
      domain: "",
      path: "",
      method: "POST",
      auth_type: "TOKEN",
      owner: "admin",
      response_path: "data",
      status: "DRAFT",
      query_mapping: [],
      body_mapping: []
    });
    setOpen(true);
  };

  const openEdit = (row: InterfaceDefinition) => {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  };

  return (
    <div>
      {holder}
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          接口子项管理
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          新增接口
        </Button>
      </Space>
      <Alert
        style={{ marginBottom: 12 }}
        type="info"
        showIcon
        message="平台统一策略"
        description="timeout_ms / retry_count 由平台统一控制，不在前端暴露。被规则引用的发布接口不可直接下线。"
      />

      <Table<InterfaceDefinition>
        rowKey="interface_id"
        dataSource={interfaces}
        columns={[
          { title: "Interface ID", dataIndex: "interface_id", width: 220 },
          { title: "Name", dataIndex: "interface_name" },
          { title: "Path", render: (_, row) => `${row.method} ${row.path}` },
          { title: "Owner", dataIndex: "owner" },
          { title: "Status", render: (_, row) => statusTag[row.status] },
          {
            title: "Actions",
            width: 260,
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    try {
                      publishInterface(row.interface_id);
                      msgApi.success("接口已发布");
                    } catch (e) {
                      msgApi.error(String((e as Error).message));
                    }
                  }}
                >
                  发布
                </Button>
                <Button
                  type="link"
                  danger
                  onClick={() => {
                    try {
                      offlineInterface(row.interface_id);
                      msgApi.success("接口已下线");
                    } catch (e) {
                      msgApi.error(String((e as Error).message));
                    }
                  }}
                >
                  下线
                </Button>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? "编辑接口" : "新增接口"}
        open={open}
        width={760}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          upsertInterface(values);
          setOpen(false);
          msgApi.success("保存成功");
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="interface_id" label="interface_id" rules={[{ required: true }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="interface_name" label="interface_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="domain" label="domain" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="path" label="path" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item name="method" label="method" rules={[{ required: true }]} style={{ minWidth: 160 }}>
              <Select options={methodOptions.map((x) => ({ label: x, value: x }))} />
            </Form.Item>
            <Form.Item name="auth_type" label="auth_type" rules={[{ required: true }]} style={{ minWidth: 160 }}>
              <Select options={authOptions.map((x) => ({ label: x, value: x }))} />
            </Form.Item>
            <Form.Item name="owner" label="owner" rules={[{ required: true }]} style={{ minWidth: 160 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="response_path" label="response_path" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
