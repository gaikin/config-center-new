import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Drawer,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import { getRightOverlayDrawerWidth } from "../utils";
import type { LifecycleState, PageElement, PageMenu, PageResource, PageSite } from "../types";

type ResourceForm = Omit<PageResource, "id" | "updatedAt" | "elementCount">;
type ElementForm = Omit<PageElement, "id" | "updatedAt">;

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

const detectRuleOptions = [
  "业务标识优先 + URL兜底",
  "业务标识 + 页面标题 + URL兜底",
  "URL前缀 + DOM特征校验",
  "菜单编码 + URL精确匹配"
];

export function PageResourcesPage() {
  const screens = Grid.useBreakpoint();
  const drawerWidth = getRightOverlayDrawerWidth(Boolean(screens.lg));

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<PageSite[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [menuFilter, setMenuFilter] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PageResource | null>(null);
  const [form] = Form.useForm<ResourceForm>();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentResource, setCurrentResource] = useState<PageResource | null>(null);
  const [elementLoading, setElementLoading] = useState(false);
  const [elements, setElements] = useState<PageElement[]>([]);
  const [elementOpen, setElementOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<PageElement | null>(null);
  const [elementForm] = Form.useForm<ElementForm>();

  const [msgApi, holder] = message.useMessage();

  const selectedSiteId = siteFilter === "ALL" ? undefined : Number(siteFilter);
  const selectedMenuId = menuFilter === "ALL" ? undefined : Number(menuFilter);

  const menuLabelMap = useMemo(() => {
    return Object.fromEntries(menus.map((menu) => [menu.id, `${menu.zoneName}/${menu.menuName}`]));
  }, [menus]);

  const menusFilteredBySite = useMemo(() => {
    if (!selectedSiteId) {
      return menus;
    }
    return menus.filter((menu) => menu.siteId === selectedSiteId);
  }, [menus, selectedSiteId]);

  const resourcesFiltered = useMemo(() => {
    const menuIdsBySite = new Set(menusFilteredBySite.map((menu) => menu.id));
    return resources.filter((resource) => {
      if (selectedSiteId && !menuIdsBySite.has(resource.menuId)) {
        return false;
      }
      if (selectedMenuId && resource.menuId !== selectedMenuId) {
        return false;
      }
      return true;
    });
  }, [resources, menusFilteredBySite, selectedSiteId, selectedMenuId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [siteData, menuData, resourceData] = await Promise.all([
        configCenterService.listPageSites(),
        configCenterService.listPageMenus(),
        configCenterService.listPageResources()
      ]);
      setSites(siteData);
      setMenus(menuData);
      setResources(resourceData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadElements(resourceId: number) {
    setElementLoading(true);
    try {
      const data = await configCenterService.listPageElements(resourceId);
      setElements(data);
    } finally {
      setElementLoading(false);
    }
  }

  function openCreate() {
    const defaultMenuId = selectedMenuId ?? menusFilteredBySite[0]?.id ?? menus[0]?.id ?? 0;
    setEditing(null);
    form.setFieldsValue({
      menuId: defaultMenuId,
      name: "",
      status: "DRAFT",
      ownerOrgId: "branch-east",
      currentVersion: 1,
      detectRulesSummary: "业务标识优先 + URL兜底"
    });
    setOpen(true);
  }

  function openEdit(row: PageResource) {
    setEditing(row);
    form.setFieldsValue({
      menuId: row.menuId,
      name: row.name,
      status: row.status,
      ownerOrgId: row.ownerOrgId,
      currentVersion: row.currentVersion,
      detectRulesSummary: row.detectRulesSummary
    });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertPageResource({
      ...values,
      id: editing?.id ?? Date.now(),
      elementCount: editing?.elementCount ?? 0
    });
    msgApi.success(editing ? "页面资源已更新（生效中对象会自动生成待发布版本）" : "页面资源已创建");
    setOpen(false);
    await loadAll();
  }

  function closeResourceModal() {
    if (!form.isFieldsTouched(true)) {
      setOpen(false);
      return;
    }

    Modal.confirm({
      title: "放弃未保存更改？",
      content: "当前页面资源配置尚未保存，关闭后将丢失。",
      okText: "放弃并关闭",
      cancelText: "继续编辑",
      onOk: () => setOpen(false)
    });
  }

  async function openElementsDrawer(row: PageResource) {
    setCurrentResource(row);
    setDrawerOpen(true);
    await loadElements(row.id);
  }

  function openCreateElement() {
    if (!currentResource) {
      return;
    }
    setEditingElement(null);
    elementForm.setFieldsValue({
      pageResourceId: currentResource.id,
      logicName: "",
      selector: "",
      selectorType: "XPATH",
      required: false
    });
    setElementOpen(true);
  }

  function openEditElement(row: PageElement) {
    setEditingElement(row);
    elementForm.setFieldsValue({
      pageResourceId: row.pageResourceId,
      logicName: row.logicName,
      selector: row.selector,
      selectorType: row.selectorType,
      required: row.required
    });
    setElementOpen(true);
  }

  async function submitElement() {
    const values = await elementForm.validateFields();
    await configCenterService.upsertPageElement({
      ...values,
      id: editingElement?.id ?? Date.now()
    });
    msgApi.success(editingElement ? "元素映射已更新" : "元素映射已新增");
    setElementOpen(false);
    if (currentResource) {
      await loadElements(currentResource.id);
      await loadAll();
    }
  }

  function closeElementModal() {
    if (!elementForm.isFieldsTouched(true)) {
      setElementOpen(false);
      return;
    }

    Modal.confirm({
      title: "放弃未保存更改？",
      content: "当前元素映射尚未保存，关闭后将丢失。",
      okText: "放弃并关闭",
      cancelText: "继续编辑",
      onOk: () => setElementOpen(false)
    });
  }

  async function removeElement(row: PageElement) {
    await configCenterService.deletePageElement(row.id);
    msgApi.success("元素映射已删除");
    if (currentResource) {
      await loadElements(currentResource.id);
      await loadAll();
    }
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>页面资源中心</Typography.Title>
      <Typography.Paragraph type="secondary">
        统一维护页面识别规则与元素映射，规则和作业场景统一复用，不在业务对象中重复维护选择器。
      </Typography.Paragraph>

      <Card style={{ marginBottom: 12 }}>
        <Space wrap>
          <Tag color="blue">站点数：{sites.length}</Tag>
          <Tag color="geekblue">菜单数：{menus.length}</Tag>
          <Tag color="green">页面资源：{resources.length}</Tag>
        </Space>
      </Card>

      <Card
        title="页面资源列表"
        extra={
          <Space>
            <Segmented
              value={siteFilter}
              onChange={(value) => {
                setSiteFilter(value as string);
                setMenuFilter("ALL");
              }}
              options={[
                { label: "全部站点", value: "ALL" },
                ...sites.map((site) => ({ label: site.name, value: String(site.id) }))
              ]}
            />
            <Select
              value={menuFilter}
              style={{ width: 220 }}
              options={[
                { label: "全部菜单", value: "ALL" },
                ...menusFilteredBySite.map((menu) => ({
                  label: `${menu.zoneName}/${menu.menuName}`,
                  value: String(menu.id)
                }))
              ]}
              onChange={(value) => setMenuFilter(value)}
            />
            <Button type="primary" icon={<PlusOutlined />} aria-label="create-page-resource" title="新建页面资源" onClick={openCreate} />
          </Space>
        }
      >
        <Table<PageResource>
          rowKey="id"
          loading={loading}
          dataSource={resourcesFiltered}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            { title: "名称", dataIndex: "name", width: 200 },
            {
              title: "所属菜单",
              dataIndex: "menuId",
              width: 180,
              render: (menuId: number) => menuLabelMap[menuId] ?? `menu-${menuId}`
            },
            { title: "版本", dataIndex: "currentVersion", width: 80 },
            { title: "元素数", dataIndex: "elementCount", width: 80 },
            { title: "识别口径", dataIndex: "detectRulesSummary" },
            {
              title: "状态",
              dataIndex: "status",
              width: 100,
              render: (status: LifecycleState) => <Tag color={statusColor[status]}>{status}</Tag>
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 220,
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button type="link" onClick={() => void openElementsDrawer(row)}>
                    元素映射
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editing ? "编辑页面资源" : "新建页面资源"}
        open={open}
        onCancel={closeResourceModal}
        onOk={() => void submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`ID 由系统自动生成（当前${editing ? `#${editing.id}` : "新建后生成"}）`}
            description={`元素数量由系统根据元素映射自动统计（当前${editing?.elementCount ?? 0}）`}
          />
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="menuId" label="菜单" rules={[{ required: true, message: "请选择菜单" }]}>
            <Select
              options={menus.map((menu) => ({
                label: `${menu.zoneName}/${menu.menuName}`,
                value: menu.id
              }))}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select
              options={[
                { label: "DRAFT", value: "DRAFT" },
                { label: "ACTIVE", value: "ACTIVE" },
                { label: "DISABLED", value: "DISABLED" },
                { label: "EXPIRED", value: "EXPIRED" }
              ]}
            />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true, message: "请输入组织" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="currentVersion" label="当前版本" rules={[{ required: true, message: "请输入版本" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="detectRulesSummary" label="识别口径" rules={[{ required: true, message: "请选择或输入识别口径" }]}>
            <AutoComplete
              options={detectRuleOptions.map((item) => ({ value: item }))}
              placeholder="请选择或输入识别规则口径"
              filterOption={(inputValue, option) => (option?.value ?? "").toLowerCase().includes(inputValue.toLowerCase())}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={currentResource ? `元素映射：${currentResource.name}` : "元素映射"}
        placement="right"
        width={drawerWidth}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button type="primary" icon={<PlusOutlined />} aria-label="add-page-element" title="新增元素" onClick={openCreateElement} disabled={!currentResource} />
        }
      >
        <Table<PageElement>
          rowKey="id"
          loading={elementLoading}
          dataSource={elements}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            { title: "逻辑名", dataIndex: "logicName", width: 160 },
            {
              title: "选择器",
              dataIndex: "selector",
              render: (value: string) => <Typography.Text code>{value}</Typography.Text>
            },
            { title: "类型", dataIndex: "selectorType", width: 90 },
            {
              title: "必填",
              width: 80,
              render: (_, row) => (row.required ? <Tag color="red">是</Tag> : <Tag color="default">否</Tag>)
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 180,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEditElement(row)}>
                    编辑
                  </Button>
                  <Popconfirm title="确认删除该元素映射？" onConfirm={() => void removeElement(row)}>
                    <Button size="small" danger icon={<DeleteOutlined />} aria-label="delete-page-element" title="删除元素" />
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Drawer>

      <Modal
        title={editingElement ? "编辑元素映射" : "新增元素映射"}
        open={elementOpen}
        onCancel={closeElementModal}
        onOk={() => void submitElement()}
      >
        <Form form={elementForm} layout="vertical">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`元素 ID 由系统自动生成（当前${editingElement ? `#${editingElement.id}` : "新建后生成"}）`}
          />
          <Form.Item name="pageResourceId" label="页面资源 ID" rules={[{ required: true, message: "请输入页面资源 ID" }]}>
            <InputNumber style={{ width: "100%" }} disabled />
          </Form.Item>
          <Form.Item name="logicName" label="逻辑名" rules={[{ required: true, message: "请输入逻辑名" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="selector" label="定位表达式" rules={[{ required: true, message: "请输入定位表达式" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="selectorType" label="选择器类型" rules={[{ required: true, message: "请选择选择器类型" }]}>
            <Select options={[{ label: "XPATH", value: "XPATH" }, { label: "CSS", value: "CSS" }]} />
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
