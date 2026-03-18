import { Alert, Button,
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
import { OrgSelect, OrgText, PersonMultiSelect } from "../../components/DirectoryFields";
import { getPersonLabel, normalizePersonValue, toPersonOption } from "../../directory";
import { lifecycleLabelMap } from "../../enumLabels";
import { getRoleTypeDefaultActions, HEAD_OFFICE_ORG_ID, HIGH_PRIVILEGE_ACTIONS, normalizeRoleActions } from "../../permissionPolicy";
import { configCenterService } from "../../services/configCenterService";
import type { ActionType, RoleItem } from "../../types";

const roleTypeLabel: Record<RoleItem["roleType"], string> = {
  CONFIG_OPERATOR: "配置人员",
  PERMISSION_ADMIN: "权限管理人员",
  TECH_SUPPORT: "技术支持人员"
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
  "ROLE_MANAGE",
  "MENU_ENABLE_MANAGE"
];

const actionLabelMap: Record<ActionType, string> = {
  VIEW: "查看",
  CONFIG: "配置",
  VALIDATE: "发布检查",
  PUBLISH: "发布",
  DISABLE: "停用",
  DEFER: "延期",
  ROLLBACK: "回滚",
  AUDIT_VIEW: "审计查看",
  RISK_CONFIRM: "风险确认",
  ROLE_MANAGE: "角色维护",
  MENU_ENABLE_MANAGE: "菜单启用"
};

const actionDescriptions: Record<ActionType, string> = {
  VIEW: "查看配置与运行结果",
  CONFIG: "创建和编辑业务对象",
  VALIDATE: "查看发布检查结果并处理阻断项",
  PUBLISH: "发布待生效对象",
  DISABLE: "停用已生效对象",
  DEFER: "延期即将到期对象",
  ROLLBACK: "回滚到待发布状态",
  AUDIT_VIEW: "查看审计与日志",
  RISK_CONFIRM: "确认自动化风险责任",
  ROLE_MANAGE: "维护角色与成员和操作权限",
  MENU_ENABLE_MANAGE: "高权限操作：菜单启用（仅总行分配）"
};

export function RolesPage({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RoleItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [form] = Form.useForm<RoleForm>();
  const selectedRoleType = Form.useWatch("roleType", form);
  const selectedOrgScopeId = Form.useWatch("orgScopeId", form);
  const selectedActions = Form.useWatch("actions", form) as ActionType[] | undefined;

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberRole, setMemberRole] = useState<RoleItem | null>(null);
  const [memberValues, setMemberValues] = useState<string[]>([]);
  const [memberOptions, setMemberOptions] = useState<string[]>([]);

  const [msgApi, holder] = message.useMessage();

  async function loadMemberOptions(roleRows: RoleItem[]) {
    const memberGroups = await Promise.all(roleRows.map((role) => configCenterService.listRoleMembers(role.id)));
    const merged = new Set<string>([
      normalizePersonValue("张三"),
      normalizePersonValue("李四"),
      normalizePersonValue("王五"),
      normalizePersonValue("赵六")
    ]);
    memberGroups.flat().forEach((personId) => merged.add(normalizePersonValue(personId)));
    setMemberOptions(Array.from(merged).sort((left, right) => getPersonLabel(left).localeCompare(getPersonLabel(right), "zh-CN")));
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

  useEffect(() => {
    if (!open || !selectedOrgScopeId || !selectedRoleType || !selectedActions) {
      return;
    }
    const normalized = normalizeRoleActions(selectedRoleType, selectedOrgScopeId, selectedActions);
    if (normalized.join("|") !== selectedActions.join("|")) {
      form.setFieldValue("actions", normalized);
      if (selectedOrgScopeId !== HEAD_OFFICE_ORG_ID && selectedActions.some((action) => HIGH_PRIVILEGE_ACTIONS.includes(action))) {
        msgApi.warning("非总行范围角色不可配置高权限操作。");
      }
    }
  }, [form, msgApi, open, selectedActions, selectedOrgScopeId, selectedRoleType]);

  useEffect(() => {
    if (!open || selectedRoleType !== "TECH_SUPPORT") {
      return;
    }
    if (selectedOrgScopeId && selectedOrgScopeId !== HEAD_OFFICE_ORG_ID) {
      form.setFieldValue("orgScopeId", HEAD_OFFICE_ORG_ID);
      msgApi.warning("技术支持人员仅允许配置为总行范围。");
    }
  }, [form, msgApi, open, selectedOrgScopeId, selectedRoleType]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "ALL") {
      return rows;
    }
    return rows.filter((item) => item.status === statusFilter);
  }, [rows, statusFilter]);

  function openCreate() {
    setEditing(null);
    const defaultOrgScope = "branch-east";
    form.setFieldsValue({
      name: "",
      roleType: "CONFIG_OPERATOR",
      status: "ACTIVE",
      orgScopeId: defaultOrgScope,
      actions: getRoleTypeDefaultActions("CONFIG_OPERATOR", defaultOrgScope)
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
    try {
      const values = await form.validateFields();
      await configCenterService.upsertRole(
        {
          ...values,
          actions: normalizeRoleActions(values.roleType, values.orgScopeId, values.actions),
          id: editing?.id ?? Date.now()
        }
      );
      msgApi.success(editing ? "角色已更新" : "角色已创建");
      setOpen(false);
      await loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "角色保存失败";
      msgApi.error(errorMessage);
    }
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
    if (!selectedRoleType || !selectedOrgScopeId) {
      return;
    }
    form.setFieldValue("actions", getRoleTypeDefaultActions(selectedRoleType, selectedOrgScopeId));
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
    setMemberValues(members.map((item) => normalizePersonValue(item)));
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
      {!embedded ? (
        <>
          <Typography.Title level={4}>权限管理</Typography.Title>
        </>
      ) : null}

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
            { title: "组织范围", dataIndex: "orgScopeId", width: 140, render: (value: string) => <OrgText value={value} /> },
            {
              title: "权限点",
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  {row.actions.map((action) => (
                    <Tag key={action}>{actionLabelMap[action]}</Tag>
                  ))}
                </Space>
              )
            },
            { title: "成员数", dataIndex: "memberCount", width: 90 },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
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
            showIcon
            type="info"
            style={{ marginBottom: 12 }}
            message="高权限分配规则"
          />
          {selectedRoleType && selectedOrgScopeId ? (
            <Alert
              showIcon
              type="success"
              style={{ marginBottom: 12 }}
              message="默认权限"
            />
          ) : null}
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
            按角色类型重置默认权限
          </Button>

          <Form.Item name="orgScopeId" label="组织范围" rules={[{ required: true, message: "请选择组织范围" }]}>
            <OrgSelect />
          </Form.Item>
          <Form.Item
            name="actions"
            label="操作类型"
            rules={[{ required: true, message: "请选择操作类型" }]}
          >
            <Select
              mode="multiple"
              options={allActions.map((action) => ({
                value: action,
                label: `${actionLabelMap[action]} - ${actionDescriptions[action]}`,
                disabled: selectedOrgScopeId !== HEAD_OFFICE_ORG_ID && HIGH_PRIVILEGE_ACTIONS.includes(action)
              }))}
              placeholder="可多选"
            />
          </Form.Item>
          <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
            {allActions.map((action) => (
              <Tag key={action} color={HIGH_PRIVILEGE_ACTIONS.includes(action) ? "magenta" : undefined}>
                {`${actionLabelMap[action]}：${actionDescriptions[action]}`}
              </Tag>
            ))}
          </Space>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ label: lifecycleLabelMap.ACTIVE, value: "ACTIVE" }, { label: lifecycleLabelMap.DISABLED, value: "DISABLED" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={memberRole ? `批量分配成员：${memberRole.name}` : "批量分配成员"}
        open={memberOpen}
        onCancel={() => setMemberOpen(false)}
        onOk={() => void saveMembers()}
      >
        <PersonMultiSelect
          style={{ width: "100%" }}
          value={memberValues}
          onChange={(values) => setMemberValues((values as string[]).map((item) => normalizePersonValue(item)))}
          options={memberOptions.map((personId) => toPersonOption(personId))}
          placeholder="选择成员"
        />
      </Modal>
    </div>
  );
}

