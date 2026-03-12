import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import type { InterfaceDefinition, LifecycleState } from "../types";

type InterfaceForm = Omit<InterfaceDefinition, "updatedAt">;
type StatusFilter = "ALL" | LifecycleState;

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

export function InterfacesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InterfaceDefinition[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InterfaceDefinition | null>(null);
  const [form] = Form.useForm<InterfaceForm>();
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const data = await configCenterService.listInterfaces();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRows = useMemo(() => {
    if (statusFilter === "ALL") {
      return rows;
    }
    return rows.filter((item) => item.status === statusFilter);
  }, [rows, statusFilter]);

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      id: Date.now(),
      name: "",
      method: "POST",
      url: "",
      status: "DRAFT",
      ownerOrgId: "branch-east",
      currentVersion: 1,
      timeoutMs: 3000,
      retryTimes: 1,
      paramSourceSummary: "",
      responsePath: "$.data",
      maskSensitive: true
    });
    setOpen(true);
  }

  function openEdit(row: InterfaceDefinition) {
    setEditing(row);
    form.setFieldsValue({ ...row });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertInterface(values);
    msgApi.success(editing ? "接口定义已更新" : "接口定义已创建");
    setOpen(false);
    await loadData();
  }

  async function switchStatus(item: InterfaceDefinition) {
    const next: LifecycleState = item.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await configCenterService.updateInterfaceStatus(item.id, next);
    msgApi.success(`接口状态已切换为 ${next}`);
    await loadData();
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>接口定义中心</Typography.Title>
      <Typography.Paragraph type="secondary">
        接口定义统一复用于规则判断与作业执行。支持参数来源、出参路径、超时重试和敏感信息脱敏策略治理。
      </Typography.Paragraph>

      <Card
        extra={
          <Space>
            <Segmented
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { label: "全部", value: "ALL" },
                { label: "草稿", value: "DRAFT" },
                { label: "生效", value: "ACTIVE" },
                { label: "停用", value: "DISABLED" },
                { label: "失效", value: "EXPIRED" }
              ]}
            />
            <Button type="primary" onClick={openCreate}>
              新建接口
            </Button>
          </Space>
        }
      >
        <Table<InterfaceDefinition>
          rowKey="id"
          loading={loading}
          dataSource={filteredRows}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "接口名称", dataIndex: "name", width: 200 },
            {
              title: "请求",
              width: 240,
              render: (_, row) => (
                <Space>
                  <Tag color="geekblue">{row.method}</Tag>
                  <Typography.Text>{row.url}</Typography.Text>
                </Space>
              )
            },
            { title: "参数来源", dataIndex: "paramSourceSummary" },
            { title: "出参路径", dataIndex: "responsePath", width: 160 },
            {
              title: "脱敏",
              width: 80,
              render: (_, row) => (row.maskSensitive ? <Tag color="green">是</Tag> : <Tag color="default">否</Tag>)
            },
            { title: "超时(ms)", dataIndex: "timeoutMs", width: 90 },
            { title: "重试", dataIndex: "retryTimes", width: 80 },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag>
            },
            {
              title: "操作",
              width: 180,
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
        title={editing ? "编辑接口定义" : "新建接口定义"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="id" label="ID" rules={[{ required: true, message: "请输入 ID" }]}>
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="name" label="接口名称" rules={[{ required: true, message: "请输入接口名称" }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="method" label="请求方法" rules={[{ required: true, message: "请选择请求方法" }]}>
            <Select options={["GET", "POST", "PUT", "DELETE"].map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="url" label="请求地址" rules={[{ required: true, message: "请输入请求地址" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="paramSourceSummary" label="参数来源" rules={[{ required: true, message: "请输入参数来源" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="responsePath" label="出参路径" rules={[{ required: true, message: "请输入出参路径" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="maskSensitive" label="敏感字段脱敏" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
          <Form.Item name="timeoutMs" label="超时(ms)" rules={[{ required: true, message: "请输入超时" }]}>
            <InputNumber min={1} max={5000} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="retryTimes" label="重试次数" rules={[{ required: true, message: "请输入重试次数" }]}>
            <InputNumber min={0} max={3} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[
              { label: "DRAFT", value: "DRAFT" },
              { label: "ACTIVE", value: "ACTIVE" },
              { label: "DISABLED", value: "DISABLED" },
              { label: "EXPIRED", value: "EXPIRED" }
            ]} />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true, message: "请输入组织范围" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="currentVersion" label="当前版本" rules={[{ required: true, message: "请输入版本" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
