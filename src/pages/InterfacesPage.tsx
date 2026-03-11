import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useMemo, useState } from "react";
import type { InterfaceDefinition } from "../types";
import { useAppStore } from "../store/useAppStore";
import { createId } from "../utils";
import { idRule, maxLenRule, requiredRule } from "../validation/formRules";

const methodOptions: InterfaceDefinition["method"][] = ["GET", "POST", "PUT", "DELETE"];
const authOptions: InterfaceDefinition["auth_type"][] = ["NONE", "TOKEN", "AKSK", "CUSTOM"];

const methodLabel: Record<InterfaceDefinition["method"], string> = {
  GET: "查询（GET）",
  POST: "提交（POST）",
  PUT: "更新（PUT）",
  DELETE: "删除（DELETE）"
};

const authLabel: Record<InterfaceDefinition["auth_type"], string> = {
  NONE: "无鉴权",
  TOKEN: "令牌鉴权",
  AKSK: "密钥鉴权",
  CUSTOM: "自定义鉴权"
};

export function InterfacesPage() {
  const { interfaces, upsertInterface, publishInterface, offlineInterface } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InterfaceDefinition | null>(null);
  const [form] = Form.useForm<InterfaceDefinition>();
  const [msgApi, holder] = message.useMessage();

  const statusTag = useMemo(
    () => ({
      DRAFT: <Tag color="default">草稿</Tag>,
      PUBLISHED: <Tag color="green">已发布</Tag>,
      OFFLINE: <Tag color="red">已下线</Tag>
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
      owner: "运营管理员",
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
          接口配置
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          新建接口
        </Button>
      </Space>

      <Alert
        style={{ marginBottom: 12 }}
        type="info"
        showIcon
        message="平台策略"
        description="超时与重试次数由平台统一控制，不在页面暴露。"
      />

      <Table<InterfaceDefinition>
        rowKey="interface_id"
        dataSource={interfaces}
        columns={[
          { title: "接口ID", dataIndex: "interface_id", width: 220 },
          { title: "名称", dataIndex: "interface_name" },
          { title: "路径", render: (_, row) => `${methodLabel[row.method]} ${row.path}` },
          { title: "负责人", dataIndex: "owner" },
          { title: "状态", render: (_, row) => statusTag[row.status] },
          {
            title: "操作",
            width: 280,
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    publishInterface(row.interface_id);
                    msgApi.success("接口已发布。");
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
                      msgApi.success("接口已下线。");
                    } catch (error) {
                      msgApi.error(String((error as Error).message));
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
        title={editing ? "编辑接口" : "新建接口"}
        open={open}
        width={760}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          upsertInterface(values);
          setOpen(false);
          msgApi.success("保存成功。");
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="interface_id" label="接口ID" rules={[requiredRule("接口ID"), idRule("接口ID", "if-")]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="interface_name" label="接口名称" rules={[requiredRule("接口名称"), maxLenRule("接口名称", 80)]}>
            <Input />
          </Form.Item>
          <Form.Item name="domain" label="服务域" rules={[requiredRule("服务域"), maxLenRule("服务域", 80)]}>
            <Input />
          </Form.Item>
          <Form.Item name="path" label="路径" rules={[requiredRule("路径"), maxLenRule("路径", 200)]}>
            <Input />
          </Form.Item>

          <Space style={{ width: "100%" }} align="start">
            <Form.Item name="method" label="请求方法" rules={[requiredRule("请求方法")]} style={{ minWidth: 160 }}>
              <Select options={methodOptions.map((item) => ({ label: methodLabel[item], value: item }))} />
            </Form.Item>
            <Form.Item name="auth_type" label="鉴权类型" rules={[requiredRule("鉴权类型")]} style={{ minWidth: 160 }}>
              <Select options={authOptions.map((item) => ({ label: authLabel[item], value: item }))} />
            </Form.Item>
            <Form.Item name="owner" label="负责人" rules={[requiredRule("负责人"), maxLenRule("负责人", 60)]} style={{ minWidth: 160 }}>
              <Input />
            </Form.Item>
          </Space>

          <Form.Item name="response_path" label="响应路径" rules={[requiredRule("响应路径"), maxLenRule("响应路径", 120)]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
