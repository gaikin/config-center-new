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
import { OrgSelect, OrgText, PersonMultiSelect } from "../../components/DirectoryFields";
import { getPersonLabel, normalizePersonValue, toPersonOption } from "../../directory";
import { lifecycleLabelMap } from "../../enumLabels";
import {
  getRoleTypeRecommendedResourcePaths,
  HEAD_OFFICE_ORG_ID,
  HIGH_PRIVILEGE_RESOURCE_PATHS
} from "../../permissionPolicy";
import { configCenterService } from "../../services/configCenterService";
import type { PermissionResource, RoleItem, ResourceType } from "../../types";

const roleTypeLabel: Record<RoleItem["roleType"], string> = {
  CONFIG_OPERATOR: "配置人员",
  PERMISSION_ADMIN: "权限管理人员",
  TECH_SUPPORT: "技术支持人员"
};

const statusColor: Record<RoleItem["status"], string> = {
  ACTIVE: "green",
  DISABLED: "orange"
};

const resourceTypeLabel: Record<ResourceType, string> = {
  MENU: "菜单资源",
  PAGE: "页面资源",
  ACTION: "动作资源"
};

type RoleFormValues = {
  name: string;
  roleType: RoleItem["roleType"];
  status: RoleItem["status"];
  orgScopeId: string;
  resourceCodes: string[];
};

type StatusFilter = "ALL" | RoleItem["status"];

function uniqueStringList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function RolesPage({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RoleItem[]>([]);
  const [resources, setResources] = useState<PermissionResource[]>([]);
  const [roleGrantCodeMap, setRoleGrantCodeMap] = useState<Record<number, string[]>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [form] = Form.useForm<RoleFormValues>();
  const selectedRoleType = Form.useWatch("roleType", form);
  const selectedOrgScopeId = Form.useWatch("orgScopeId", form);
  const selectedResourceCodes = (Form.useWatch("resourceCodes", form) as string[] | undefined) ?? [];

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberRole, setMemberRole] = useState<RoleItem | null>(null);
  const [memberValues, setMemberValues] = useState<string[]>([]);
  const [memberOptions, setMemberOptions] = useState<string[]>([]);

  const [msgApi, holder] = message.useMessage();

  const resourceByCode = useMemo(
    () => new Map(resources.map((resource) => [resource.resourceCode, resource] as const)),
    [resources]
  );

  const resourceOptionsByType = useMemo(() => {
    const typedEntries: Array<[ResourceType, PermissionResource[]]> = [
      ["MENU", []],
      ["PAGE", []],
      ["ACTION", []]
    ];
    for (const resource of resources) {
      const entry = typedEntries.find(([resourceType]) => resourceType === resource.resourceType);
      entry?.[1].push(resource);
    }
    return typedEntries.map(([resourceType, rowsByType]) => ({
      label: resourceTypeLabel[resourceType],
      options: rowsByType
        .sort((left, right) => left.orderNo - right.orderNo || left.id - right.id)
        .map((resource) => ({
          value: resource.resourceCode,
          label: `${resource.resourceName} (${resource.resourcePath})`,
          disabled: resource.status !== "ACTIVE"
        }))
    }));
  }, [resources]);

  const selectedResourceSummary = useMemo(() => {
    const summary: Record<ResourceType, number> = {
      MENU: 0,
      PAGE: 0,
      ACTION: 0
    };
    for (const resourceCode of selectedResourceCodes) {
      const resource = resourceByCode.get(resourceCode);
      if (resource) {
        summary[resource.resourceType] += 1;
      }
    }
    return summary;
  }, [resourceByCode, selectedResourceCodes]);

  function resolveRecommendedResourceCodes(roleType: RoleItem["roleType"], orgScopeId: string) {
    const recommendedPaths = getRoleTypeRecommendedResourcePaths(roleType, orgScopeId);
    const codes = resources
      .filter((resource) => resource.status === "ACTIVE" && recommendedPaths.includes(resource.resourcePath))
      .map((resource) => resource.resourceCode);
    return uniqueStringList(codes);
  }

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
      const [roleRows, resourceRows] = await Promise.all([
        configCenterService.listRoles(),
        configCenterService.listPermissionResources()
      ]);
      const grantGroups = await Promise.all(
        roleRows.map((role) => configCenterService.listRoleResourceGrants(role.id))
      );
      const nextGrantMap: Record<number, string[]> = {};
      grantGroups.forEach((grants, index) => {
        nextGrantMap[roleRows[index].id] = uniqueStringList(grants.map((grant) => grant.resourceCode));
      });
      setRows(roleRows);
      setResources(resourceRows);
      setRoleGrantCodeMap(nextGrantMap);
      await loadMemberOptions(roleRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!open || !selectedOrgScopeId) {
      return;
    }
    const highPrivilegeCodes = selectedResourceCodes.filter((resourceCode) => {
      const resourcePath = resourceByCode.get(resourceCode)?.resourcePath;
      return resourcePath ? HIGH_PRIVILEGE_RESOURCE_PATHS.includes(resourcePath) : false;
    });
    if (selectedOrgScopeId !== HEAD_OFFICE_ORG_ID && highPrivilegeCodes.length > 0) {
      const filtered = selectedResourceCodes.filter((resourceCode) => !highPrivilegeCodes.includes(resourceCode));
      form.setFieldValue("resourceCodes", filtered);
      msgApi.warning("非总行范围角色不可配置高权限资源。");
    }
  }, [form, msgApi, open, resourceByCode, selectedOrgScopeId, selectedResourceCodes]);

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
    const defaultRoleType: RoleItem["roleType"] = "CONFIG_OPERATOR";
    const defaultOrgScope = "branch-east";
    form.setFieldsValue({
      name: "",
      roleType: defaultRoleType,
      status: "ACTIVE",
      orgScopeId: defaultOrgScope,
      resourceCodes: resolveRecommendedResourceCodes(defaultRoleType, defaultOrgScope)
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
      resourceCodes: roleGrantCodeMap[row.id] ?? []
    });
    setOpen(true);
  }

  function applyRolePreset() {
    if (!selectedRoleType || !selectedOrgScopeId) {
      return;
    }
    form.setFieldValue("resourceCodes", resolveRecommendedResourceCodes(selectedRoleType, selectedOrgScopeId));
    msgApi.success("已按角色类型填充推荐资源");
  }

  async function submit() {
    try {
      const values = await form.validateFields();
      const roleId = editing?.id ?? Date.now();
      await configCenterService.upsertRole({
        id: roleId,
        name: values.name.trim(),
        roleType: values.roleType,
        status: values.status,
        orgScopeId: values.orgScopeId.trim()
      });
      await configCenterService.saveRoleResourceGrants(roleId, values.resourceCodes);
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
        <Typography.Title level={4}>权限管理</Typography.Title>
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
              title: "授权资源",
              render: (_, row) => {
                const codes = roleGrantCodeMap[row.id] ?? [];
                const names = codes
                  .map((resourceCode) => resourceByCode.get(resourceCode)?.resourceName ?? resourceCode)
                  .slice(0, 4);
                return (
                  <Space size={[4, 4]} wrap>
                    {names.map((name) => (
                      <Tag key={`${row.id}-${name}`}>{name}</Tag>
                    ))}
                    {codes.length > 4 ? <Tag>+{codes.length - 4}</Tag> : null}
                  </Space>
                );
              }
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

      <Modal title={editing ? "编辑角色" : "新建角色"} open={open} onCancel={closeRoleModal} onOk={() => void submit()} width={860}>
        <Form form={form} layout="vertical">
          <Alert showIcon type="info" style={{ marginBottom: 12 }} message="角色授权将基于资源路径生效（菜单/页面/动作互不自动继承）。" />
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
            按角色类型填充推荐资源
          </Button>

          <Form.Item name="orgScopeId" label="组织范围" rules={[{ required: true, message: "请选择组织范围" }]}>
            <OrgSelect />
          </Form.Item>
          <Form.Item name="resourceCodes" label="授权资源" rules={[{ required: true, message: "请选择至少一个资源" }]}>
            <Select mode="multiple" options={resourceOptionsByType} placeholder="可多选，支持按资源类型分组查看" />
          </Form.Item>
          <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
            <Tag>菜单 {selectedResourceSummary.MENU}</Tag>
            <Tag>页面 {selectedResourceSummary.PAGE}</Tag>
            <Tag>动作 {selectedResourceSummary.ACTION}</Tag>
          </Space>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ label: lifecycleLabelMap.ACTIVE, value: "ACTIVE" }, { label: lifecycleLabelMap.DISABLED, value: "DISABLED" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={memberRole ? `批量分配成员：${memberRole.name}` : "批量分配成员"} open={memberOpen} onCancel={() => setMemberOpen(false)} onOk={() => void saveMembers()}>
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
