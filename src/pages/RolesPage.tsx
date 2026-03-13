import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
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

type RoleForm = Omit<RoleItem, "id" | "updatedAt" | "memberCount">;
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

const actionDescriptions: Record<ActionType, string> = {
  VIEW: "查看配置与运行结果",
  CONFIG: "创建和编辑业务对象",
  VALIDATE: "触发发布前校验",
  PUBLISH: "发布待生效对象",
  DISABLE: "停用已生效对象",
  DEFER: "延期即将到期对象",
  ROLLBACK: "回滚到待发布状态",
  AUDIT_VIEW: "查看审计与日志",
  RISK_CONFIRM: "确认自动化风险责任",
  ROLE_MANAGE: "维护角色与成员"
};

const roleTypeDefaultActions: Record<RoleItem["roleType"], ActionType[]> = {
  BUSINESS_OPERATOR: ["VIEW"],
  BUSINESS_CONFIG: ["VIEW", "CONFIG", "VALIDATE"],
  BUSINESS_MANAGER: ["VIEW", "VALIDATE", "PUBLISH", "DISABLE", "DEFER", "ROLLBACK", "RISK_CONFIRM"],
  BUSINESS_AUDITOR: ["VIEW", "AUDIT_VIEW"],
  BUSINESS_SUPER_ADMIN: allActions,
  PLATFORM_SUPPORT: ["VIEW", "VALIDATE", "AUDIT_VIEW"]
};

export function RolesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RoleItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [form] = Form.useForm<RoleForm>();
  const selectedRoleType = Form.useWatch("roleType", form);

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberRole, setMemberRole] = useState<RoleItem | null>(null);
  const [memberValues, setMemberValues] = useState<string[]>([]);
  const [memberOptions, setMemberOptions] = useState<string[]>([]);

  const [msgApi, holder] = message.useMessage();

  async function loadMemberOptions(roleRows: RoleItem[]) {
    const memberGroups = await Promise.all(roleRows.map((role) => configCenterService.listRoleMembers(role.id)));
    const merged = new Set<string>(["张三", "李四", "王五", "赵六"]);
    memberGroups.flat().forEach((name) => merged.add(name));
    setMemberOptions(Array.from(merged).sort((a, b) => a.localeCompare(b, "zh-CN")));
  }

  async function loadData() {
    setLoading(true);
    try {
      const data = await configCenterService.listRoles();
      setRows(data);
      await loadMemberOptions(data);
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
      name: "",
      roleType: "BUSINESS_CONFIG",
      status: "ACTIVE",
      orgScopeId: "branch-east",
      actions: roleTypeDefaultActions.BUSINESS_CONFIG
    });
    setOpen(true);
  }

  function openEdit(row: RoleItem) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      roleType: row.roleType,
      status: row.status,
      orgScopeId: row.orgScopeId,
      actions: row.actions
    });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertRole({
      ...values,
      id: editing?.id ?? Date.now()
    });
    msgApi.success(editing ? "角色已更新" : "角色已创建");
    setOpen(false);
    await loadData();
  }

  function closeRoleModal() {
    if (!form.isFieldsTouched(true)) {
      setOpen(false);
      return;
    }

    Modal.confirm({
      title: "放弃未保存更改？",
      content: "当前角色配置未保存，关闭后将丢失。",
      okText: "放弃并关闭",
      cancelText: "继续编辑",
      onOk: () => setOpen(false)
    });
  }

  function applyRolePreset() {
    if (!selectedRoleType) {
      return;
    }
    form.setFieldValue("actions", roleTypeDefaultActions[selectedRoleType]);
    msgApi.success("已按角色类型填充推荐权限");
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
    setMemberValues(members);
    setMemberOpen(true);
  }

  async function saveMembers() {
    if (!memberRole) {
      return;
    }
    await configCenterService.assignRoleMembers(memberRole.id, memberValues);
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
            <Button type="primary" icon={<PlusOutlined />} aria-label="create-role" title="新建角色" onClick={openCreate} />
          </Space>
        }
      >
        <Table<RoleItem>
          rowKey="id"
          loading={loading}
          dataSource={filteredRows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
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
                  <Popconfirm
                    title={row.status === "ACTIVE" ? "确认停用该角色？" : "确认启用该角色？"}
                    onConfirm={() => void toggleStatus(row)}
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
        title={editing ? "编辑角色" : "新建角色"}
        open={open}
        onCancel={closeRoleModal}
        onOk={() => void submit()}
        width={760}
      >
        <Form form={form} layout="vertical">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`ID 由系统自动生成（当前${editing ? `#${editing.id}` : "新建后生成"}）`}
            description={`成员数由系统根据角色成员自动统计（当前${editing?.memberCount ?? 0}）`}
          />
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

          <Button size="small" onClick={applyRolePreset} style={{ marginBottom: 12 }}>
            按角色类型填充推荐权限
          </Button>

          <Form.Item name="orgScopeId" label="组织范围" rules={[{ required: true, message: "请输入组织范围" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="actions" label="操作类型" rules={[{ required: true, message: "请选择操作类型" }]}>
            <Select
              mode="multiple"
              options={allActions.map((action) => ({ value: action, label: `${action} - ${actionDescriptions[action]}` }))}
              placeholder="可多选"
            />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="权限说明"
            description={
              <Space size={[6, 6]} wrap>
                {allActions.map((action) => (
                  <Tag key={action}>{`${action}: ${actionDescriptions[action]}`}</Tag>
                ))}
              </Space>
            }
          />
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ label: "ACTIVE", value: "ACTIVE" }, { label: "DISABLED", value: "DISABLED" }]} />
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
          支持搜索选择，或直接输入新成员名称后回车。
        </Typography.Paragraph>
        <Select
          mode="tags"
          style={{ width: "100%" }}
          value={memberValues}
          onChange={(values) => setMemberValues(values)}
          tokenSeparators={[","]}
          options={memberOptions.map((name) => ({ label: name, value: name }))}
          placeholder="输入成员姓名并回车，或从下拉中选择"
        />
      </Modal>
    </div>
  );
}
