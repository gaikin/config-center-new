import {
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
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { OrgSelect } from "../../components/DirectoryFields";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { configCenterService } from "../../services/configCenterService";
import { createId, getRightOverlayDrawerWidth } from "../../utils";
import type {
  BusinessFieldDefinition,
  LifecycleState,
  PageElement,
  PageFieldBinding,
  PageMenu,
  PageRegion,
  PageResource,
  PageSite
} from "../../types";

type ResourceForm = Omit<PageResource, "id" | "updatedAt" | "elementCount" | "currentVersion" | "pageCode" | "frameCode">;
type ElementForm = Omit<PageElement, "id" | "updatedAt">;
type FieldForm = Omit<BusinessFieldDefinition, "id" | "updatedAt" | "currentVersion" | "aliases" | "code">;
type BindingForm = Omit<PageFieldBinding, "id" | "updatedAt">;

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
  "菜单与专区 + DOM特征校验"
];

export function PageResourcesPage() {
  const screens = Grid.useBreakpoint();
  const drawerWidth = getRightOverlayDrawerWidth(Boolean(screens.lg));
  const [searchParams] = useSearchParams();
  const targetResourceId = Number(searchParams.get("resourceId") ?? "");
  const targetAction = searchParams.get("action");
  const hasAutoOpenedFieldDrawer = useRef(false);

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<PageSite[]>([]);
  const [regions, setRegions] = useState<PageRegion[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
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
  const [fieldDrawerOpen, setFieldDrawerOpen] = useState(false);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [businessFields, setBusinessFields] = useState<BusinessFieldDefinition[]>([]);
  const [fieldBindings, setFieldBindings] = useState<PageFieldBinding[]>([]);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [bindingOpen, setBindingOpen] = useState(false);
  const [editingField, setEditingField] = useState<BusinessFieldDefinition | null>(null);
  const [editingBinding, setEditingBinding] = useState<PageFieldBinding | null>(null);
  const [fieldForm] = Form.useForm<FieldForm>();
  const [bindingForm] = Form.useForm<BindingForm>();

  const [msgApi, holder] = message.useMessage();

  const selectedSiteId = siteFilter === "ALL" ? undefined : Number(siteFilter);
  const selectedRegionId = regionFilter === "ALL" ? undefined : Number(regionFilter);
  const selectedMenuId = menuFilter === "ALL" ? undefined : Number(menuFilter);

  const regionLabelMap = useMemo(
    () => Object.fromEntries(regions.map((region) => [region.id, region.regionName])),
    [regions]
  );

  const menuLabelMap = useMemo(
    () =>
      Object.fromEntries(
        menus.map((menu) => [menu.id, `${regionLabelMap[menu.regionId] ?? "-"} / ${menu.menuName}`])
      ),
    [menus, regionLabelMap]
  );
  const elementLabelMap = useMemo(
    () => Object.fromEntries(elements.map((element) => [element.id, element.logicName])),
    [elements]
  );
  const businessFieldMap = useMemo(
    () => Object.fromEntries(businessFields.map((field) => [field.code, field])),
    [businessFields]
  );

  const regionsFilteredBySite = useMemo(() => {
    if (!selectedSiteId) {
      return regions;
    }
    return regions.filter((region) => region.siteId === selectedSiteId);
  }, [regions, selectedSiteId]);

  const menusFiltered = useMemo(() => {
    return menus.filter((menu) => {
      if (selectedSiteId && menu.siteId !== selectedSiteId) {
        return false;
      }
      if (selectedRegionId && menu.regionId !== selectedRegionId) {
        return false;
      }
      return true;
    });
  }, [menus, selectedRegionId, selectedSiteId]);

  const resourcesFiltered = useMemo(() => {
    const menuIds = new Set(menusFiltered.map((menu) => menu.id));
    return resources.filter((resource) => {
      if ((selectedSiteId || selectedRegionId) && !menuIds.has(resource.menuId)) {
        return false;
      }
      if (selectedMenuId && resource.menuId !== selectedMenuId) {
        return false;
      }
      return true;
    });
  }, [menusFiltered, resources, selectedMenuId, selectedRegionId, selectedSiteId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [siteData, regionData, menuData, resourceData] = await Promise.all([
        configCenterService.listPageSites(),
        configCenterService.listPageRegions(),
        configCenterService.listPageMenus(),
        configCenterService.listPageResources()
      ]);
      setSites(siteData);
      setRegions(regionData);
      setMenus(menuData);
      setResources(resourceData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (hasAutoOpenedFieldDrawer.current) {
      return;
    }
    if (targetAction !== "fields" || !Number.isFinite(targetResourceId) || targetResourceId <= 0 || resources.length === 0) {
      return;
    }
    const target = resources.find((item) => item.id === targetResourceId);
    if (!target) {
      return;
    }
    hasAutoOpenedFieldDrawer.current = true;
    void openFieldDrawer(target);
  }, [resources, targetAction, targetResourceId]);

  async function loadElements(resourceId: number) {
    setElementLoading(true);
    try {
      const data = await configCenterService.listPageElements(resourceId);
      setElements(data);
    } finally {
      setElementLoading(false);
    }
  }

  async function loadFieldModel(resourceId: number) {
    setFieldLoading(true);
    try {
      const [fieldData, bindingData, elementData] = await Promise.all([
        configCenterService.listBusinessFields(resourceId),
        configCenterService.listPageFieldBindings(resourceId),
        configCenterService.listPageElements(resourceId)
      ]);
      setBusinessFields(fieldData);
      setFieldBindings(bindingData);
      setElements(elementData);
    } finally {
      setFieldLoading(false);
    }
  }

  function openCreate() {
    const defaultMenuId = selectedMenuId ?? menusFiltered[0]?.id ?? menus[0]?.id ?? 0;
    setEditing(null);
    form.setFieldsValue({
      menuId: defaultMenuId,
      name: "",
      status: "DRAFT",
      ownerOrgId: "branch-east",
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
      detectRulesSummary: row.detectRulesSummary
    });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    await configCenterService.upsertPageResource({
      ...values,
      id: editing?.id ?? Date.now(),
      frameCode: editing?.frameCode,
      pageCode: editing?.pageCode ?? createId("page"),
      currentVersion: editing?.currentVersion ?? 1,
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

  async function openFieldDrawer(row: PageResource) {
    setCurrentResource(row);
    setFieldDrawerOpen(true);
    await loadFieldModel(row.id);
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

  function openCreateField(scope: BusinessFieldDefinition["scope"]) {
    if (!currentResource) {
      return;
    }
    setEditingField(null);
    fieldForm.setFieldsValue({
      name: "",
      scope,
      pageResourceId: scope === "PAGE_RESOURCE" ? currentResource.id : undefined,
      required: false,
      description: "",
      ownerOrgId: scope === "GLOBAL" ? "head-office" : currentResource.ownerOrgId,
      status: "DRAFT"
    });
    setFieldOpen(true);
  }

  function openEditField(row: BusinessFieldDefinition) {
    setEditingField(row);
    fieldForm.setFieldsValue({
      name: row.name,
      scope: row.scope,
      pageResourceId: row.pageResourceId,
      required: row.required,
      description: row.description,
      ownerOrgId: row.ownerOrgId,
      status: row.status
    });
    setFieldOpen(true);
  }

  async function submitField() {
    const values = await fieldForm.validateFields();
    await configCenterService.upsertBusinessField({
      id: editingField?.id ?? Date.now(),
      code: editingField?.code ?? createId("field"),
      name: values.name,
      scope: values.scope,
      pageResourceId: values.scope === "PAGE_RESOURCE" ? values.pageResourceId : undefined,
      valueType: editingField?.valueType ?? "STRING",
      required: values.required,
      description: values.description,
      ownerOrgId: values.ownerOrgId,
      status: values.status,
      currentVersion: editingField?.currentVersion ?? 1,
      aliases: editingField?.aliases ?? []
    });
    msgApi.success(editingField ? "业务字段已更新" : "业务字段已创建");
    setFieldOpen(false);
    if (currentResource) {
      await loadFieldModel(currentResource.id);
    }
  }

  function openCreateBinding() {
    if (!currentResource) {
      return;
    }
    setEditingBinding(null);
    bindingForm.setFieldsValue({
      pageResourceId: currentResource.id,
      businessFieldCode: undefined,
      pageElementId: undefined,
      required: false
    });
    setBindingOpen(true);
  }

  function openEditBinding(row: PageFieldBinding) {
    setEditingBinding(row);
    bindingForm.setFieldsValue({
      pageResourceId: row.pageResourceId,
      businessFieldCode: row.businessFieldCode,
      pageElementId: row.pageElementId,
      required: row.required
    });
    setBindingOpen(true);
  }

  async function submitBinding() {
    const values = await bindingForm.validateFields();
    await configCenterService.upsertPageFieldBinding({
      id: editingBinding?.id ?? Date.now(),
      pageResourceId: values.pageResourceId,
      businessFieldCode: values.businessFieldCode,
      pageElementId: values.pageElementId,
      required: values.required
    });
    msgApi.success(editingBinding ? "字段绑定已更新" : "字段绑定已创建");
    setBindingOpen(false);
    if (currentResource) {
      await loadFieldModel(currentResource.id);
    }
  }

  async function removeBinding(row: PageFieldBinding) {
    await configCenterService.deletePageFieldBinding(row.id);
    msgApi.success("字段绑定已删除");
    if (currentResource) {
      await loadFieldModel(currentResource.id);
    }
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>页面字段与元素维护</Typography.Title>

      <Card style={{ marginBottom: 12 }}>
        <Space wrap>
          <Tag color="blue">站点数：{sites.length}</Tag>
          <Tag color="cyan">专区数：{regions.length}</Tag>
          <Tag color="geekblue">菜单数：{menus.length}</Tag>
          <Tag color="processing">页面资源：{resources.length}</Tag>
        </Space>
      </Card>

      <Card
        title="页面维护列表"
        extra={
          <Space wrap>
            <Segmented
              value={siteFilter}
              onChange={(value) => {
                setSiteFilter(value as string);
                setRegionFilter("ALL");
                setMenuFilter("ALL");
              }}
              options={[
                { label: "全部站点", value: "ALL" },
                ...sites.map((site) => ({ label: site.name, value: String(site.id) }))
              ]}
            />
            <Select
              value={regionFilter}
              style={{ width: 200 }}
              options={[
                { label: "全部专区", value: "ALL" },
                ...regionsFilteredBySite.map((region) => ({
                  label: region.regionName,
                  value: String(region.id)
                }))
              ]}
              onChange={(value) => {
                setRegionFilter(value);
                setMenuFilter("ALL");
              }}
            />
            <Select
              value={menuFilter}
              style={{ width: 220 }}
              options={[
                { label: "全部菜单", value: "ALL" },
                ...menusFiltered.map((menu) => ({
                  label: `${regionLabelMap[menu.regionId] ?? "-"} / ${menu.menuName}`,
                  value: String(menu.id)
                }))
              ]}
              onChange={(value) => setMenuFilter(value)}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              aria-label="create-page-resource"
              title="新建页面资源"
              onClick={openCreate}
            />
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
              width: 220,
              render: (menuId: number) => menuLabelMap[menuId] ?? `menu-${menuId}`
            },
            { title: "元素数", dataIndex: "elementCount", width: 80 },
            { title: "识别口径", dataIndex: "detectRulesSummary" },
            {
              title: "状态",
              dataIndex: "status",
              width: 100,
              render: (status: LifecycleState) => <Tag color={statusColor[status]}>{lifecycleLabelMap[status]}</Tag>
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 },
            {
              title: "操作",
              width: 280,
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button type="link" onClick={() => void openFieldDrawer(row)}>
                    字段维护
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
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="menuId" label="菜单" rules={[{ required: true, message: "请选择菜单" }]}>
            <Select
              options={menus.map((menu) => ({
                label: `${regionLabelMap[menu.regionId] ?? "-"} / ${menu.menuName}`,
                value: menu.id
              }))}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={lifecycleOptions} />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true, message: "请选择组织" }]}>
            <OrgSelect />
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            aria-label="add-page-element"
            title="新增元素"
            onClick={openCreateElement}
            disabled={!currentResource}
          />
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
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="delete-page-element"
                      title="删除元素"
                    />
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
          <Form.Item name="pageResourceId" hidden rules={[{ required: true, message: "请选择所属页面" }]}>
            <InputNumber style={{ width: "100%" }} disabled />
          </Form.Item>
          <Form.Item label="所属页面">
            <Input value={currentResource?.name ?? ""} disabled />
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

      <Drawer
        title={currentResource ? `字段维护：${currentResource.name}` : "字段维护"}
        placement="right"
        width={drawerWidth}
        open={fieldDrawerOpen}
        onClose={() => setFieldDrawerOpen(false)}
      >
        <Card
          size="small"
          title="页面字段字典"
          extra={
            <Space>
              <Button size="small" onClick={() => openCreateField("GLOBAL")}>
                新增公共字段
              </Button>
              <Button size="small" type="primary" onClick={() => openCreateField("PAGE_RESOURCE")}>
                新增页面特有字段
              </Button>
            </Space>
          }
          style={{ marginBottom: 12 }}
        >
          <Table<BusinessFieldDefinition>
            rowKey="id"
            loading={fieldLoading}
            dataSource={businessFields}
            pagination={false}
            columns={[
              {
                title: "字段",
                width: 220,
                render: (_, row) => <Typography.Text>{row.name}</Typography.Text>
              },
              {
                title: "归属",
                width: 100,
                render: (_, row) => <Tag color={row.scope === "GLOBAL" ? "blue" : "geekblue"}>{row.scope === "GLOBAL" ? "公共字段" : "当前页面字段"}</Tag>
              },
              { title: "说明", dataIndex: "description" },
              {
                title: "操作",
                width: 100,
                render: (_, row) => (
                  <Button type="link" size="small" onClick={() => openEditField(row)}>
                    编辑
                  </Button>
                )
              }
            ]}
          />
        </Card>

        <Card
          size="small"
          title="页面字段绑定"
          extra={
            <Button size="small" type="primary" onClick={openCreateBinding}>
              新增绑定
            </Button>
          }
        >
          <Table<PageFieldBinding>
            rowKey="id"
            loading={fieldLoading}
            dataSource={fieldBindings}
            pagination={false}
            columns={[
              {
                title: "字段",
                width: 180,
                render: (_, row) => {
                  const field = businessFieldMap[row.businessFieldCode];
                  if (!field) {
                    return <Typography.Text type="secondary">字段已删除</Typography.Text>;
                  }
                  return <Typography.Text>{field.name}</Typography.Text>;
                }
              },
              {
                title: "元素",
                width: 180,
                render: (_, row) => elementLabelMap[row.pageElementId] ?? <Typography.Text type="secondary">元素已删除</Typography.Text>
              },
              {
                title: "必填",
                width: 80,
                render: (_, row) => (row.required ? <Tag color="red">是</Tag> : <Tag>否</Tag>)
              },
              {
                title: "操作",
                width: 140,
                render: (_, row) => (
                  <Space>
                    <Button size="small" onClick={() => openEditBinding(row)}>
                      编辑
                    </Button>
                    <Popconfirm title="确认删除该字段绑定？" onConfirm={() => void removeBinding(row)}>
                      <Button size="small" danger>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
          />
        </Card>
      </Drawer>

      <Modal
        title={editingField ? "编辑页面字段" : "新增页面字段"}
        open={fieldOpen}
        onCancel={() => setFieldOpen(false)}
        onOk={() => void submitField()}
      >
        <Form form={fieldForm} layout="vertical">
          <Form.Item name="scope" label="字段归属" rules={[{ required: true, message: "请选择字段归属" }]}>
            <Select
              options={[
                { label: "公共字段", value: "GLOBAL" },
                { label: "页面特有字段", value: "PAGE_RESOURCE" }
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              fieldForm.getFieldValue("scope") === "PAGE_RESOURCE" ? (
                <>
                  <Form.Item name="pageResourceId" hidden rules={[{ required: true, message: "请选择所属页面" }]}>
                    <InputNumber style={{ width: "100%" }} disabled />
                  </Form.Item>
                  <Form.Item label="所属页面">
                    <Input value={currentResource?.name ?? ""} disabled />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item name="name" label="字段名称" rules={[{ required: true, message: "请输入字段名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="归属组织" rules={[{ required: true, message: "请选择归属组织" }]}>
            <OrgSelect />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={lifecycleOptions} />
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingBinding ? "编辑字段绑定" : "新增字段绑定"}
        open={bindingOpen}
        onCancel={() => setBindingOpen(false)}
        onOk={() => void submitBinding()}
      >
        <Form form={bindingForm} layout="vertical">
          <Form.Item name="pageResourceId" hidden rules={[{ required: true, message: "请选择页面资源" }]}>
            <InputNumber style={{ width: "100%" }} disabled />
          </Form.Item>
          <Form.Item label="所属页面">
            <Input value={currentResource?.name ?? ""} disabled />
          </Form.Item>
          <Form.Item name="businessFieldCode" label="字段" rules={[{ required: true, message: "请选择字段" }]}>
            <Select
              showSearch
              options={businessFields.map((field) => ({
                label: field.name,
                value: field.code
              }))}
            />
          </Form.Item>
          <Form.Item name="pageElementId" label="元素" rules={[{ required: true, message: "请选择元素" }]}>
            <Select
              showSearch
              options={elements.map((element) => ({
                label: element.logicName,
                value: element.id
              }))}
            />
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
