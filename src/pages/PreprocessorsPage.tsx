import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import type { LifecycleState, PreprocessorDefinition } from "../types";

type PreprocessorForm = Omit<PreprocessorDefinition, "updatedAt">;

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

const typeLabel: Record<PreprocessorDefinition["processorType"], string> = {
  BUILT_IN: "内置",
  SCRIPT: "脚本"
};

const categoryLabel: Record<PreprocessorDefinition["category"], string> = {
  STRING: "字符串",
  NUMBER: "数值",
  DATE: "日期",
  JSON: "JSON"
};

export function PreprocessorsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PreprocessorDefinition[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PreprocessorDefinition | null>(null);
  const [form] = Form.useForm<PreprocessorForm>();
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const data = await configCenterService.listPreprocessors();
      setRows(data);
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
      id: Date.now(),
      name: "",
      processorType: "BUILT_IN",
      category: "STRING",
      status: "DRAFT",
      ownerOrgId: "branch-east",
      usedByCount: 0
    });
    setOpen(true);
  }

  function openEdit(row: PreprocessorDefinition) {
    setEditing(row);
    form.setFieldsValue({ ...row });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertPreprocessor(values);
    msgApi.success(editing ? "预处理器已更新" : "预处理器已创建");
    setOpen(false);
    await loadData();
  }

  async function switchStatus(item: PreprocessorDefinition) {
    const next: LifecycleState = item.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await configCenterService.updatePreprocessorStatus(item.id, next);
    msgApi.success(`状态已切换为 ${next}`);
    await loadData();
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>预处理器中心</Typography.Title>
      <Typography.Paragraph type="secondary">
        统一维护规则和作业共用的数据转换逻辑，优先使用内置能力，脚本能力仅作受控增强。
      </Typography.Paragraph>

      <Card
        extra={
          <Button type="primary" onClick={openCreate}>
            新建预处理器
          </Button>
        }
      >
        <Table<PreprocessorDefinition>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "名称", dataIndex: "name", width: 220 },
            {
              title: "类型",
              width: 100,
              render: (_, row) => <Tag color={row.processorType === "SCRIPT" ? "volcano" : "blue"}>{typeLabel[row.processorType]}</Tag>
            },
            {
              title: "分类",
              width: 100,
              render: (_, row) => <Tag>{categoryLabel[row.category]}</Tag>
            },
            { title: "组织范围", dataIndex: "ownerOrgId", width: 140 },
            { title: "被引用次数", dataIndex: "usedByCount", width: 110 },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag>
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 220,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>
                    编辑
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

      <Modal
        title={editing ? "编辑预处理器" : "新建预处理器"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="id" label="ID" rules={[{ required: true, message: "请输入 ID" }]}>
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="processorType" label="类型" rules={[{ required: true, message: "请选择类型" }]}>
            <Select options={[{ label: "内置", value: "BUILT_IN" }, { label: "脚本", value: "SCRIPT" }]} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: "请选择分类" }]}>
            <Select
              options={[
                { label: "字符串", value: "STRING" },
                { label: "数值", value: "NUMBER" },
                { label: "日期", value: "DATE" },
                { label: "JSON", value: "JSON" }
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={["DRAFT", "ACTIVE", "DISABLED", "EXPIRED"].map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true, message: "请输入组织" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="usedByCount" label="被引用次数" rules={[{ required: true, message: "请输入次数" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
