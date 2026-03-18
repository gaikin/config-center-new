import { Button, Card, Form, Modal, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { OrgSelect } from "../../components/DirectoryFields";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { configCenterService } from "../../services/configCenterService";
import type {
  JobPreloadPolicy,
  JobSceneDefinition,
  LifecycleState,
  PageActivationPolicy,
  PageMenu,
  PageRegion,
  PageResource,
  RuleDefinition
} from "../../types";

type PolicyForm = Omit<PageActivationPolicy, "id" | "updatedAt">;

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

const preloadOptions: Array<{ label: string; value: JobPreloadPolicy }> = [
  { label: "立即准备", value: "immediate" },
  { label: "空闲时准备", value: "idle" },
  { label: "用户触发前准备", value: "intent" },
  { label: "暂不准备", value: "none" }
];

export function PageActivationPoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<PageRegion[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [scenes, setScenes] = useState<JobSceneDefinition[]>([]);
  const [policies, setPolicies] = useState<PageActivationPolicy[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PageActivationPolicy | null>(null);
  const [form] = Form.useForm<PolicyForm>();
  const [msgApi, holder] = message.useMessage();

  const resourceMap = useMemo(
    () => Object.fromEntries(resources.map((resource) => [resource.id, resource])),
    [resources]
  );
  const menuMap = useMemo(() => Object.fromEntries(menus.map((menu) => [menu.id, menu])), [menus]);
  const regionMap = useMemo(() => Object.fromEntries(regions.map((region) => [region.id, region])), [regions]);

  const enhancedPolicies = useMemo(() => {
    return policies.map((policy) => {
      const resource = resourceMap[policy.pageResourceId];
      const menu = resource ? menuMap[resource.menuId] : undefined;
      const region = menu ? regionMap[menu.regionId] : undefined;
      return {
        ...policy,
        pageName: resource?.name ?? `page-${policy.pageResourceId}`,
        menuName: menu?.menuName ?? "-",
        regionName: region?.regionName ?? "-"
      };
    });
  }, [menuMap, policies, regionMap, resourceMap]);

  async function loadData() {
    setLoading(true);
    try {
      const [regionData, menuData, resourceData, ruleData, sceneData, policyData] = await Promise.all([
        configCenterService.listPageRegions(),
        configCenterService.listPageMenus(),
        configCenterService.listPageResources(),
        configCenterService.listRules(),
        configCenterService.listJobScenes(),
        configCenterService.listPageActivationPolicies()
      ]);
      setRegions(regionData);
      setMenus(menuData);
      setResources(resourceData);
      setRules(ruleData);
      setScenes(sceneData);
      setPolicies(policyData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function openCreate() {
    const defaultPage = resources[0];
    setEditing(null);
    form.setFieldsValue({
      pageResourceId: defaultPage?.id ?? 0,
      enabled: true,
      promptRuleSetName: rules[0]?.name ?? "",
      hasJobScenes: true,
      jobPreloadPolicy: "idle",
      jobSceneName: scenes[0]?.name,
      status: "DRAFT",
      ownerOrgId: defaultPage?.ownerOrgId ?? "branch-east"
    });
    setOpen(true);
  }

  function openEdit(row: PageActivationPolicy) {
    setEditing(row);
    form.setFieldsValue({
      pageResourceId: row.pageResourceId,
      enabled: row.enabled,
      promptRuleSetName: row.promptRuleSetName,
      hasJobScenes: row.hasJobScenes,
      jobPreloadPolicy: row.jobPreloadPolicy,
      jobSceneName: row.jobSceneName,
      status: row.status,
      ownerOrgId: row.ownerOrgId
    });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertPageActivationPolicy({
      ...values,
      id: editing?.id ?? Date.now()
    });
    msgApi.success(editing ? "页面开通设置已更新，已进入待发布列表" : "页面开通设置已创建，已进入待发布列表");
    setOpen(false);
    await loadData();
  }

  const enabledCount = policies.filter((policy) => policy.enabled).length;
  const withJobCount = policies.filter((policy) => policy.hasJobScenes).length;

  return (
    <div>
      {holder}
      <Typography.Title level={4}>页面开通设置</Typography.Title>
      <Typography.Paragraph type="secondary">
        在这里决定页面是否开通智能提示、是否带作业，以及作业在什么时机提前准备。技术定位细节继续放在高级维护区。
      </Typography.Paragraph>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        业务人员只需要配置“这个页面是否启用、用哪条提示规则、是否带作业”。页面定位和识别细节由技术侧维护。
      </Typography.Paragraph>

      <Space size={12} style={{ marginBottom: 16 }} wrap>
        <Tag color="processing">启用页面：{enabledCount}</Tag>
        <Tag color="blue">带作业页面：{withJobCount}</Tag>
        <Tag color="orange">待发布策略：{policies.filter((policy) => policy.status === "DRAFT").length}</Tag>
      </Space>

      <Card
        title="页面开通列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建开通设置
          </Button>
        }
      >
        <Table<(PageActivationPolicy & { pageName: string; menuName: string; regionName: string })>
          rowKey="id"
          loading={loading}
          dataSource={enhancedPolicies}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            { title: "页面", dataIndex: "pageName", width: 200 },
            {
              title: "归属",
              width: 220,
              render: (_, row) => `${row.regionName} / ${row.menuName}`
            },
            {
              title: "启用提示",
              width: 100,
              render: (_, row) => (row.enabled ? <Tag color="green">启用</Tag> : <Tag>关闭</Tag>)
            },
            { title: "提示规则", dataIndex: "promptRuleSetName", width: 180 },
            {
              title: "作业能力",
              width: 200,
              render: (_, row) =>
                row.hasJobScenes ? (
                  <Space wrap>
                    <Tag color="blue">{row.jobSceneName ?? "已绑定作业"}</Tag>
                    <Tag>{preloadOptions.find((item) => item.value === row.jobPreloadPolicy)?.label ?? row.jobPreloadPolicy}</Tag>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">无</Typography.Text>
                )
            },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
            },
            {
              title: "操作",
              width: 120,
              render: (_, row) => (
                <Button type="link" onClick={() => openEdit(row)}>
                  编辑
                </Button>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editing ? "编辑页面开通设置" : "新建页面开通设置"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="pageResourceId" label="页面" rules={[{ required: true, message: "请选择页面" }]}>
            <Select
              options={resources.map((resource) => {
                const menu = menuMap[resource.menuId];
                const region = menu ? regionMap[menu.regionId] : undefined;
                return {
                  label: `${region?.regionName ?? "-"} / ${menu?.menuName ?? "-"} / ${resource.name}`,
                  value: resource.id
                };
              })}
              onChange={(pageResourceId) => {
                const resource = resources.find((item) => item.id === pageResourceId);
                form.setFieldValue("ownerOrgId", resource?.ownerOrgId ?? "branch-east");
              }}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用智能提示" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="关闭" />
          </Form.Item>
          <Form.Item name="promptRuleSetName" label="提示规则" rules={[{ required: true, message: "请选择提示规则" }]}>
            <Select
              showSearch
              options={rules.map((rule) => ({ label: rule.name, value: rule.name }))}
              placeholder="选择提示规则"
            />
          </Form.Item>
          <Form.Item name="hasJobScenes" label="是否启用作业" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              form.getFieldValue("hasJobScenes") ? (
                <>
                  <Form.Item name="jobSceneName" label="作业场景">
                    <Select
                      allowClear
                      options={scenes.map((scene) => ({ label: scene.name, value: scene.name }))}
                    />
                  </Form.Item>
                  <Form.Item name="jobPreloadPolicy" label="作业准备时机" rules={[{ required: true, message: "请选择作业准备时机" }]}>
                    <Select options={preloadOptions} />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item
            name="ownerOrgId"
            label="归属机构"
            rules={[{ required: true, message: "请选择归属机构" }]}
            extra="归属机构随页面自动带出，无需手工填写。"
          >
            <OrgSelect disabled />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={lifecycleOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

