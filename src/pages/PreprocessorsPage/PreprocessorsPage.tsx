import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { OrgSelect, OrgText } from "../../components/DirectoryFields";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { configCenterService } from "../../services/configCenterService";
import type { LifecycleState, PreprocessorDefinition } from "../../types";

type PreprocessorForm = Omit<PreprocessorDefinition, "id" | "updatedAt" | "usedByCount">;

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

export function PreprocessorsPage({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PreprocessorDefinition[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PreprocessorDefinition | null>(null);
  const [form] = Form.useForm<PreprocessorForm>();
  const watchedProcessorType = Form.useWatch("processorType", form);
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
      name: "",
      processorType: "BUILT_IN",
      category: "STRING",
      status: "DRAFT",
      ownerOrgId: "branch-east",
      scriptContent: ""
    });
    setOpen(true);
  }

  function openEdit(row: PreprocessorDefinition) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      processorType: row.processorType,
      category: row.category,
      status: row.status,
      ownerOrgId: row.ownerOrgId,
      scriptContent: row.scriptContent ?? ""
    });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertPreprocessor({
      ...values,
      id: editing?.id ?? Date.now(),
      usedByCount: editing?.usedByCount ?? 0
    });
    msgApi.success(editing ? "数据转换规则已更新，已进入待发布列表" : "数据转换规则已创建，已进入待发布列表");
    setOpen(false);
    await loadData();
  }

  function closeModal() {
    if (!form.isFieldsTouched(true)) {
      setOpen(false);
      return;
    }

    Modal.confirm({
      title: "放弃未保存更改？",
      content: "当前表单有未保存内容，确认关闭后将丢失。",
      okText: "放弃并关闭",
      cancelText: "继续编辑",
      onOk: () => setOpen(false)
    });
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
      {!embedded ? (
        <>
          <Typography.Title level={4}>数据转换规则</Typography.Title>
          <Typography.Paragraph type="secondary">
            这是高级维护区，用来统一管理规则和作业共用的数据转换逻辑。优先使用内置能力，脚本方式仅作受控增强。
          </Typography.Paragraph>
        </>
      ) : null}

      <Card
        extra={
          <Button type="primary" icon={<PlusOutlined />} aria-label="create-preprocessor" title="新建预处理器" onClick={openCreate} />
        }
      >
        <Table<PreprocessorDefinition>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
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
            { title: "组织范围", dataIndex: "ownerOrgId", width: 140, render: (value: string) => <OrgText value={value} /> },
            { title: "被引用次数", dataIndex: "usedByCount", width: 110 },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
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
                  <Popconfirm
                    title={row.status === "ACTIVE" ? "确认停用该预处理器？" : "确认启用该预处理器？"}
                    onConfirm={() => void switchStatus(row)}
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
        title={editing ? "编辑预处理器" : "新建预处理器"}
        open={open}
        onCancel={closeModal}
        onOk={() => void submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            标识由系统自动生成；被引用次数会自动统计，你只需维护转换逻辑本身。
          </Typography.Paragraph>
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
            <Select options={lifecycleOptions} />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true, message: "请选择组织" }]}>
            <OrgSelect />
          </Form.Item>

          {watchedProcessorType === "SCRIPT" ? (
            <Form.Item name="scriptContent" label="脚本内容" rules={[{ required: true, message: "脚本类型需要填写脚本内容" }]}>
              <Input.TextArea
                rows={10}
                placeholder="请输入脚本内容（原型态）"
                style={{ fontFamily: "Consolas, 'Courier New', monospace" }}
              />
            </Form.Item>
          ) : (
            <Alert type="info" showIcon message="内置类型无需脚本内容" description="当前将使用平台内置实现。" />
          )}
        </Form>
      </Modal>
    </div>
  );
}

