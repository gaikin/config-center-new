import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import type { PermissionResource, ResourceType } from "../../types";
import { configCenterService } from "../../services/configCenterService";

type ResourceFormValues = Omit<PermissionResource, "updatedAt">;

const resourceTypeLabelMap: Record<ResourceType, string> = {
  MENU: "菜单",
  PAGE: "页面",
  ACTION: "动作"
};

const resourceStatusColor: Record<PermissionResource["status"], string> = {
  ACTIVE: "green",
  DISABLED: "default"
};

export function PermissionResourcesPage({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PermissionResource[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionResource | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | ResourceType>("ALL");
  const [keyword, setKeyword] = useState("");
  const [form] = Form.useForm<ResourceFormValues>();
  const selectedType = Form.useWatch("resourceType", form);
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const data = await configCenterService.listPermissionResources();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const pathPrefixOptions = useMemo(() => {
    const prefixes = Array.from(new Set(rows.map((item) => item.resourcePath.split("/").slice(0, 3).join("/"))));
    return prefixes.filter(Boolean).sort();
  }, [rows]);
  const [pathPrefix, setPathPrefix] = useState<string>("ALL");

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "ALL" && row.resourceType !== typeFilter) {
        return false;
      }
      if (pathPrefix !== "ALL" && !row.resourcePath.startsWith(pathPrefix)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }
      return (
        row.resourceCode.toLowerCase().includes(normalizedKeyword) ||
        row.resourceName.toLowerCase().includes(normalizedKeyword) ||
        row.resourcePath.toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [keyword, pathPrefix, rows, typeFilter]);

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      id: Date.now(),
      resourceCode: "",
      resourceName: "",
      resourceType: "MENU",
      resourcePath: "/menu/",
      pagePath: undefined,
      status: "ACTIVE",
      orderNo: (rows[0]?.orderNo ?? 0) + 10,
      description: ""
    });
    setOpen(true);
  }

  function openEdit(row: PermissionResource) {
    setEditing(row);
    form.setFieldsValue({
      ...row
    });
    setOpen(true);
  }

  async function submit() {
    try {
      const values = await form.validateFields();
      await configCenterService.upsertPermissionResource({
        ...values,
        resourceCode: values.resourceCode.trim(),
        resourceName: values.resourceName.trim(),
        resourcePath: values.resourcePath.trim(),
        pagePath: values.resourceType === "PAGE" ? values.pagePath?.trim() : undefined,
        description: values.description?.trim()
      });
      msgApi.success(editing ? "资源已更新" : "资源已创建");
      setOpen(false);
      await loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "资源保存失败";
      msgApi.error(errorMessage);
    }
  }

  return (
    <div>
      {holder}
      {!embedded ? <Typography.Title level={4}>资源管理</Typography.Title> : null}
      <Card
        extra={
          <Space wrap>
            <Select
              value={typeFilter}
              style={{ width: 120 }}
              onChange={(value) => setTypeFilter(value as "ALL" | ResourceType)}
              options={[
                { label: "全部类型", value: "ALL" },
                { label: "菜单", value: "MENU" },
                { label: "页面", value: "PAGE" },
                { label: "动作", value: "ACTION" }
              ]}
            />
            <Select
              value={pathPrefix}
              style={{ width: 180 }}
              onChange={(value) => setPathPrefix(value)}
              options={[{ label: "全部前缀", value: "ALL" }, ...pathPrefixOptions.map((value) => ({ label: value, value }))]}
            />
            <Input.Search
              allowClear
              style={{ width: 220 }}
              placeholder="搜索编码/名称/路径"
              onSearch={(value) => setKeyword(value)}
              onChange={(event) => setKeyword(event.target.value)}
              value={keyword}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建资源
            </Button>
          </Space>
        }
      >
        <Table<PermissionResource>
          rowKey="id"
          loading={loading}
          dataSource={filteredRows}
          pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: ["8", "12", "20"] }}
          columns={[
            { title: "资源名称", dataIndex: "resourceName", width: 180 },
            { title: "编码", dataIndex: "resourceCode", width: 180, render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
            { title: "类型", width: 100, render: (_, row) => <Tag>{resourceTypeLabelMap[row.resourceType]}</Tag> },
            { title: "路径", dataIndex: "resourcePath", render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
            {
              title: "页面路由",
              dataIndex: "pagePath",
              width: 180,
              render: (value?: string) => (value ? <Typography.Text code>{value}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text>)
            },
            { title: "排序", dataIndex: "orderNo", width: 90 },
            { title: "状态", width: 100, render: (_, row) => <Tag color={resourceStatusColor[row.status]}>{row.status}</Tag> },
            { title: "描述", dataIndex: "description", width: 220, ellipsis: true },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 100,
              render: (_, row) => (
                <Button type="link" onClick={() => openEdit(row)}>
                  编辑
                </Button>
              )
            }
          ]}
        />
      </Card>

      <Modal title={editing ? "编辑资源" : "新建资源"} open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item name="resourceName" label="资源名称" rules={[{ required: true, message: "请输入资源名称" }]}>
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="resourceCode" label="资源编码" rules={[{ required: true, message: "请输入资源编码" }]}>
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="resourceType" label="资源类型" rules={[{ required: true, message: "请选择资源类型" }]}>
            <Select
              options={[
                { label: "菜单", value: "MENU" },
                { label: "页面", value: "PAGE" },
                { label: "动作", value: "ACTION" }
              ]}
            />
          </Form.Item>
          <Form.Item name="resourcePath" label="资源路径" rules={[{ required: true, message: "请输入资源路径" }]}>
            <Input placeholder={selectedType === "PAGE" ? "/page/module/view" : selectedType === "ACTION" ? "/action/module/scope/verb" : "/menu/module"} />
          </Form.Item>
          <Form.Item name="pagePath" label="页面路由">
            <Input disabled={selectedType !== "PAGE"} placeholder="/advanced" />
          </Form.Item>
          <Space style={{ width: "100%" }} size={12}>
            <Form.Item name="orderNo" label="排序" style={{ flex: 1 }} rules={[{ required: true, message: "请输入排序值" }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ flex: 1 }} rules={[{ required: true, message: "请选择状态" }]}>
              <Select options={[{ label: "ACTIVE", value: "ACTIVE" }, { label: "DISABLED", value: "DISABLED" }]} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
