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
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import type { ActionType, RoleItem } from "../types";

const roleTypeLabel: Record<RoleItem["roleType"], string> = {
  BUSINESS_OPERATOR: "业务操作",
  BUSINESS_CONFIG: "业务配置",
  BUSINESS_MANAGER: "业务管理",
  BUSINESS_AUDITOR: "业务审计",
  BUSINESS_SUPER_ADMIN: "业务超管",
  PLATFORM_SUPPORT: "平台支持"
};

const statusColor: Record<RoleItem["status"], string> = {
  ACTIVE: "green",
  DISABLED: "orange"
};

type RoleForm = Omit<RoleItem, "updatedAt">;
type StatusFilter = "ALL" | RoleItem["status"];

const allActions: ActionType[] = [
  "VIEW",
  "CONFIG",
  "VALIDATE",
  "PUBLISH",
  "DISABLE",
  "DEFER",
  "ROLLBACK",
  "AUDIT_VIEW",
  "RISK_CONFIRM",
  "ROLE_MANAGE"
];

export function RolesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RoleItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [form] = Form.useForm<RoleForm>();
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberRole, setMemberRole] = useState<RoleItem | null>(null);
  const [memberText, setMemberText] = useState("");
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const data = await configCenterService.listRoles();
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
      roleType: "BUSINESS_CONFIG",
      status: "ACTIVE",
      orgScopeId: "branch-east",
      actions: ["VIEW", "CONFIG", "VALIDATE"],
      memberCount: 0
    });
    setOpen(true);
  }

  function openEdit(row: RoleItem) {
    setEditing(row);
    form.setFieldsValue({ ...row });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertRole(values);
    msgApi.success(editing ? "角色已更新" : "角色已创建");
    setOpen(false);
    await loadData();
  }

  async function cloneRole(role: RoleItem) {
    await configCenterService.cloneRole(role.id);
    msgApi.success(`已复制角色：${role.name}`);
    await loadData();
  }

  async function toggleStatus(role: RoleItem) {
    await configCenterService.toggleRoleStatus(role.id);
    msgApi.success(`角色状态已切换：${role.name}`);
    await loadData();
  }

  async function openMembers(role: RoleItem) {
    const members = await configCenterService.listRoleMembers(role.id);
    setMemberRole(role);
    setMemberText(members.join("\n"));
    setMemberOpen(true);
  }

  async function saveMembers() {
    if (!memberRole) {
      return;
    }
    const members = memberText
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean);
    await configCenterService.assignRoleMembers(memberRole.id, members);
    msgApi.success(`已更新成员：${memberRole.name}`);
    setMemberOpen(false);
    await loadData();
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>角色管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        角色按组织隔离配置，支持角色定义、复制、停用/恢复、组织范围绑定、操作类型配置与成员批量分配。
      </Typography.Paragraph>

      <Card
        extra={
          <Space>
            <Segmented
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { label: "全部", value: "ALL" },
                { label: "启用", value: "ACTIVE" },
                { label: "停用", value: "DISABLED" }
              ]}
            />
            <Button type="primary" onClick={openCreate}>
              新建角色
            </Button>
          </Space>
        }
      >
        <Table<RoleItem>
          rowKey="id"
          loading={loading}
          dataSource={filteredRows}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "角色名称", dataIndex: "name", width: 220 },
            {
              title: "角色类型",
              width: 120,
              render: (_, row) => <Tag color="blue">{roleTypeLabel[row.roleType]}</Tag>
            },
            { title: "组织范围", dataIndex: "orgScopeId", width: 140 },
            {
              title: "权限点",
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  {row.actions.map((action) => (
                    <Tag key={action}>{action}</Tag>
                  ))}
                </Space>
              )
            },
            { title: "成员数", dataIndex: "memberCount", width: 90 },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag>
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 320,
              render: (_, row) => (
                <Space wrap>
                  <Button size="small" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button size="small" onClick={() => void cloneRole(row)}>
                    复制
                  </Button>
                  <Button size="small" onClick={() => void openMembers(row)}>
                    配成员
                  </Button>
                  <Button size="small" onClick={() => void toggleStatus(row)}>
                    {row.status === "ACTIVE" ? "停用" : "启用"}
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editing ? "编辑角色" : "新建角色"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="id" label="ID" rules={[{ required: true, message: "请输入 ID" }]}>
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: "请输入角色名称" }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="roleType" label="角色类型" rules={[{ required: true, message: "请选择角色类型" }]}>
            <Select
              options={Object.entries(roleTypeLabel).map(([value, label]) => ({
                value,
                label
              }))}
            />
          </Form.Item>
          <Form.Item name="orgScopeId" label="组织范围" rules={[{ required: true, message: "请输入组织范围" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="actions" label="操作类型" rules={[{ required: true, message: "请选择操作类型" }]}>
            <Select
              mode="multiple"
              options={allActions.map((action) => ({ value: action, label: action }))}
              placeholder="可多选"
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ label: "ACTIVE", value: "ACTIVE" }, { label: "DISABLED", value: "DISABLED" }]} />
          </Form.Item>
          <Form.Item name="memberCount" label="成员数" rules={[{ required: true, message: "请输入成员数" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={memberRole ? `批量分配成员：${memberRole.name}` : "批量分配成员"}
        open={memberOpen}
        onCancel={() => setMemberOpen(false)}
        onOk={() => void saveMembers()}
      >
        <Typography.Paragraph type="secondary">
          每行一个成员姓名，或使用英文逗号分隔。
        </Typography.Paragraph>
        <Input.TextArea
          rows={8}
          value={memberText}
          onChange={(event) => setMemberText(event.target.value)}
          placeholder="例如：\n张三\n李四\n王五"
        />
      </Modal>
    </div>
  );
}
