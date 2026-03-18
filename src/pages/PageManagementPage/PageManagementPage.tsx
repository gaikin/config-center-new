import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { OrgSelect } from "../../components/DirectoryFields";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { toOrgOption } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import { resolveEffectiveVersion } from "../../sdkGovernance";
import { createId } from "../../utils";
import type {
  BusinessFieldDefinition,
  CapabilityOpenStatus,
  JobSceneDefinition,
  MenuSdkPolicy,
  MenuCapabilityPolicy,
  PageActivationPolicy,
  PageElement,
  PageFieldBinding,
  PageMenu,
  PageRegion,
  PageResource,
  PlatformRuntimeConfig,
  RuleDefinition
} from "../../types";

type WorkFilter = "ALL" | "READY" | "NEED_REQUEST" | "PENDING";
type RequestCapabilityType = "PROMPT" | "JOB";
type FieldFormValues = Pick<BusinessFieldDefinition, "name" | "description" | "required" | "ownerOrgId" | "status">;
type BindingFormValues = Pick<PageFieldBinding, "businessFieldCode" | "pageElementId" | "required">;
type QuickBindFormValues = {
  usePublicField?: boolean;
  fieldName?: string;
  businessFieldCode?: string;
  elementLogicName?: string;
  elementSelector?: string;
  elementSelectorType?: PageElement["selectorType"];
  required?: boolean;
};

type EnhancedPageRow = PageResource & {
  regionName: string;
  menuName: string;
  enabled: boolean;
  hasPrompt: boolean;
  hasJob: boolean;
  promptRuleCount: number;
  jobSceneCount: number;
  trend7d: number;
  dropRate: number;
  menuPromptStatus: CapabilityOpenStatus;
  menuJobStatus: CapabilityOpenStatus;
  policy?: PageActivationPolicy;
};

type MenuOverviewRow = {
  id: number;
  regionName: string;
  menuName: string;
  ownerOrgIds: string[];
  promptStatus: CapabilityOpenStatus;
  jobStatus: CapabilityOpenStatus;
  pageCount: number;
  configuredPromptPages: number;
  configuredJobPages: number;
  promptRuleTotal: number;
  jobSceneTotal: number;
};

const capabilityStatusMeta: Record<CapabilityOpenStatus, { label: string; color: string }> = {
  ENABLED: { label: "已开通", color: "green" },
  DISABLED: { label: "未开通", color: "default" },
  PENDING: { label: "申请中", color: "gold" }
};

const PageHeader = styled.div`
  margin-bottom: var(--space-16);
`;

const SummaryCard = styled(Card)<{ $accent: string }>`
  height: 100%;

  &::before {
    content: "";
    display: block;
    height: 4px;
    background: ${({ $accent }) => $accent};
  }

  .ant-card-body {
    padding-top: 14px;
  }
`;

const FilterCard = styled(Card)`
  margin-bottom: 12px;
`;

const FilterActions = styled(Space)`
  width: 100%;
  justify-content: flex-end;
`;

const FilterLabel = styled(Typography.Text)`
  display: block;
  margin-bottom: 6px;
  color: #475467;
`;

const MenuListCard = styled(Card)`
  height: 100%;

  .ant-list-pagination {
    margin-top: 10px;
    text-align: right;
  }
`;

const MenuItemCard = styled(Card)<{ $active: boolean }>`
  width: 100%;
  cursor: pointer;
  border-color: ${({ $active }) => ($active ? "var(--color-primary)" : "var(--color-border)")};
  background: ${({ $active }) => ($active ? "var(--color-primary-soft)" : "var(--color-surface)")};
`;

const DetailCard = styled(Card)`
  height: 100%;
`;

function calcCoverage(configured: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((configured / total) * 100);
}

export function PageManagementPage() {
  const navigate = useNavigate();
  const [msgApi, holder] = message.useMessage();
  const [requestForm] = Form.useForm<{ capabilityTypes: RequestCapabilityType[]; reason: string }>();

  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<PageRegion[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [policies, setPolicies] = useState<PageActivationPolicy[]>([]);
  const [menuCapabilities, setMenuCapabilities] = useState<MenuCapabilityPolicy[]>([]);
  const [menuSdkPolicies, setMenuSdkPolicies] = useState<MenuSdkPolicy[]>([]);
  const [platformRuntimeConfig, setPlatformRuntimeConfig] = useState<PlatformRuntimeConfig | null>(null);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [scenes, setScenes] = useState<JobSceneDefinition[]>([]);
  const [pageFieldBindingCounts, setPageFieldBindingCounts] = useState<Record<number, number>>({});
  const [fieldDrawerPage, setFieldDrawerPage] = useState<EnhancedPageRow | null>(null);
  const [fieldDrawerOpen, setFieldDrawerOpen] = useState(false);
  const [fieldDrawerLoading, setFieldDrawerLoading] = useState(false);
  const [fieldDrawerFields, setFieldDrawerFields] = useState<BusinessFieldDefinition[]>([]);
  const [fieldDrawerBindings, setFieldDrawerBindings] = useState<PageFieldBinding[]>([]);
  const [fieldDrawerElements, setFieldDrawerElements] = useState<PageElement[]>([]);
  const [quickBindOpen, setQuickBindOpen] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [bindingOpen, setBindingOpen] = useState(false);
  const [editingField, setEditingField] = useState<BusinessFieldDefinition | null>(null);
  const [editingBinding, setEditingBinding] = useState<PageFieldBinding | null>(null);
  const [quickBindForm] = Form.useForm<QuickBindFormValues>();
  const [fieldForm] = Form.useForm<FieldFormValues>();
  const [bindingForm] = Form.useForm<BindingFormValues>();

  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [keyword, setKeyword] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("ALL");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("ALL");

  const [selectedMenuId, setSelectedMenuId] = useState<number>();
  const [selectedPageId, setSelectedPageId] = useState<number>();

  const [requestMenuId, setRequestMenuId] = useState<number>();
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const [regionRows, menuRows, resourceRows, policyRows, capabilityRows, sdkPolicyRows, runtimeConfig, ruleRows, sceneRows] = await Promise.all([
          configCenterService.listPageRegions(),
          configCenterService.listPageMenus(),
          configCenterService.listPageResources(),
          configCenterService.listPageActivationPolicies(),
          configCenterService.listMenuCapabilityPolicies(),
          configCenterService.listMenuSdkPolicies(),
          configCenterService.getPlatformRuntimeConfig(),
          configCenterService.listRules(),
          configCenterService.listJobScenes()
        ]);
        const bindingRows = await Promise.all(
          resourceRows.map(async (resource) => ({
            pageResourceId: resource.id,
            count: (await configCenterService.listPageFieldBindings(resource.id)).length
          }))
        );
        if (!active) {
          return;
        }
        setRegions(regionRows);
        setMenus(menuRows);
        setResources(resourceRows);
        setPolicies(policyRows);
        setMenuCapabilities(capabilityRows);
        setMenuSdkPolicies(sdkPolicyRows);
        setPlatformRuntimeConfig(runtimeConfig);
        setRules(ruleRows);
        setScenes(sceneRows);
        setPageFieldBindingCounts(Object.fromEntries(bindingRows.map((item) => [item.pageResourceId, item.count])));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const regionNameMap = useMemo(
    () => Object.fromEntries(regions.map((item) => [item.id, item.regionName])),
    [regions]
  );
  const menuMap = useMemo(() => Object.fromEntries(menus.map((item) => [item.id, item])), [menus]);
  const policyMap = useMemo(
    () => Object.fromEntries(policies.map((item) => [item.pageResourceId, item])),
    [policies]
  );
  const menuCapabilityMap = useMemo(
    () => Object.fromEntries(menuCapabilities.map((item) => [item.menuId, item])),
    [menuCapabilities]
  );
  const menuSdkPolicyMap = useMemo(
    () => Object.fromEntries(menuSdkPolicies.map((item) => [item.menuId, item])),
    [menuSdkPolicies]
  );

  const sharedTemplateId = useMemo(
    () => rules.find((item) => item.ruleScope === "SHARED")?.id,
    [rules]
  );

  const tableRows = useMemo<EnhancedPageRow[]>(() => {
    return resources.map((page) => {
      const menu = menuMap[page.menuId];
      const policy = policyMap[page.id];
      const menuCapability = menuCapabilityMap[page.menuId];
      const relatedRules = rules.filter((rule) => rule.pageResourceId === page.id);
      const relatedScenes = scenes.filter((scene) => scene.pageResourceId === page.id);
      return {
        ...page,
        regionName: menu ? regionNameMap[menu.regionId] ?? "-" : "-",
        menuName: menu?.menuName ?? "-",
        enabled: Boolean(policy?.enabled),
        hasPrompt: Boolean(policy?.enabled) || relatedRules.length > 0,
        hasJob: Boolean(policy?.hasJobScenes) || relatedScenes.length > 0,
        promptRuleCount: relatedRules.length,
        jobSceneCount: relatedScenes.length,
        trend7d: 120 + (page.id % 37),
        dropRate: Number(((page.id % 17) * 1.3).toFixed(1)),
        menuPromptStatus: menuCapability?.promptStatus ?? "DISABLED",
        menuJobStatus: menuCapability?.jobStatus ?? "DISABLED",
        policy
      };
    });
  }, [menuCapabilityMap, menuMap, policyMap, regionNameMap, resources, rules, scenes]);

  const menuPagesMap = useMemo(() => {
    const grouped: Record<number, EnhancedPageRow[]> = {};
    for (const page of tableRows) {
      if (!grouped[page.menuId]) {
        grouped[page.menuId] = [];
      }
      grouped[page.menuId].push(page);
    }
    return grouped;
  }, [tableRows]);

  const menuRows = useMemo<MenuOverviewRow[]>(() => {
    return menus.map((menu) => {
      const pages = menuPagesMap[menu.id] ?? [];
      const capability = menuCapabilityMap[menu.id];
      const promptStatus = capability?.promptStatus ?? "DISABLED";
      const jobStatus = capability?.jobStatus ?? "DISABLED";
      const configuredPromptPages = pages.filter((page) => page.hasPrompt).length;
      const configuredJobPages = pages.filter((page) => page.hasJob).length;
      const promptRuleTotal = pages.reduce((sum, page) => sum + page.promptRuleCount, 0);
      const jobSceneTotal = pages.reduce((sum, page) => sum + page.jobSceneCount, 0);

      return {
        id: menu.id,
        regionName: regionNameMap[menu.regionId] ?? "-",
        menuName: menu.menuName,
        ownerOrgIds: Array.from(new Set(pages.map((page) => page.ownerOrgId))),
        promptStatus,
        jobStatus,
        pageCount: pages.length,
        configuredPromptPages,
        configuredJobPages,
        promptRuleTotal,
        jobSceneTotal
      };
    });
  }, [menuCapabilityMap, menuPagesMap, menus, regionNameMap]);

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredMenuRows = useMemo(() => {
    return menuRows.filter((row) => {
      if (regionFilter !== "ALL") {
        const menu = menuMap[row.id];
        if (!menu || String(menu.regionId) !== regionFilter) {
          return false;
        }
      }
      if (orgFilter !== "ALL" && !row.ownerOrgIds.includes(orgFilter)) {
        return false;
      }
      if (workFilter === "READY" && (row.promptStatus !== "ENABLED" || row.jobStatus !== "ENABLED")) {
        return false;
      }
      if (workFilter === "NEED_REQUEST" && row.promptStatus !== "DISABLED" && row.jobStatus !== "DISABLED") {
        return false;
      }
      if (workFilter === "PENDING" && row.promptStatus !== "PENDING" && row.jobStatus !== "PENDING") {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }
      const pages = menuPagesMap[row.id] ?? [];
      return (
        row.menuName.toLowerCase().includes(normalizedKeyword) ||
        pages.some((item) => item.name.toLowerCase().includes(normalizedKeyword))
      );
    });
  }, [menuMap, menuPagesMap, menuRows, normalizedKeyword, orgFilter, regionFilter, workFilter]);

  useEffect(() => {
    if (!selectedMenuId && filteredMenuRows.length > 0) {
      setSelectedMenuId(filteredMenuRows[0].id);
      return;
    }
    if (selectedMenuId && !filteredMenuRows.some((item) => item.id === selectedMenuId)) {
      setSelectedMenuId(filteredMenuRows[0]?.id);
    }
  }, [filteredMenuRows, selectedMenuId]);

  const selectedMenu = filteredMenuRows.find((item) => item.id === selectedMenuId) ?? null;
  const selectedMenuPages = useMemo(() => {
    if (!selectedMenu) {
      return [] as EnhancedPageRow[];
    }
    return menuPagesMap[selectedMenu.id] ?? [];
  }, [menuPagesMap, selectedMenu]);

  useEffect(() => {
    if (!selectedMenu) {
      setSelectedPageId(undefined);
      return;
    }
    const currentInMenu = selectedMenuPages.some((item) => item.id === selectedPageId);
    if (!currentInMenu) {
      setSelectedPageId(selectedMenuPages[0]?.id);
    }
  }, [selectedMenu, selectedMenuPages, selectedPageId]);

  const selectedPage = selectedMenuPages.find((item) => item.id === selectedPageId) ?? null;
  const selectedMenuNeedRequest = selectedMenu
    ? selectedMenu.promptStatus === "DISABLED" || selectedMenu.jobStatus === "DISABLED"
    : false;
  const selectedMenuPending = selectedMenu
    ? selectedMenu.promptStatus === "PENDING" || selectedMenu.jobStatus === "PENDING"
    : false;
  const runtimeNowAt = useMemo(() => new Date().toISOString().slice(0, 16).replace("T", " "), []);
  const selectedMenuSdkPolicy = selectedMenu ? menuSdkPolicyMap[selectedMenu.id] : undefined;
  const selectedMenuRuntimeOrgId = selectedMenu?.ownerOrgIds[0] ?? "head-office";
  const selectedMenuPromptVersion = selectedMenu && platformRuntimeConfig
    ? resolveEffectiveVersion({
        policy: selectedMenuSdkPolicy,
        capability: "PROMPT",
        orgId: selectedMenuRuntimeOrgId,
        nowAt: runtimeNowAt,
        platformConfig: platformRuntimeConfig
      })
    : null;
  const selectedMenuJobVersion = selectedMenu && platformRuntimeConfig
    ? resolveEffectiveVersion({
        policy: selectedMenuSdkPolicy,
        capability: "JOB",
        orgId: selectedMenuRuntimeOrgId,
        nowAt: runtimeNowAt,
        platformConfig: platformRuntimeConfig
      })
    : null;

  const selectedRules = useMemo(
    () => rules.filter((item) => item.pageResourceId === selectedPage?.id),
    [rules, selectedPage?.id]
  );
  const selectedPagePosition = useMemo(() => {
    if (!selectedPage) {
      return 0;
    }
    return selectedMenuPages.findIndex((item) => item.id === selectedPage.id) + 1;
  }, [selectedMenuPages, selectedPage]);
  const selectedPageFieldBindingCount = selectedPage ? pageFieldBindingCounts[selectedPage.id] ?? 0 : 0;
  const selectedPageActionState = selectedPage ? getPageActionState(selectedPage) : null;
  const pageSpecificFields = useMemo(
    () =>
      fieldDrawerFields.filter(
        (item) => item.scope === "PAGE_RESOURCE" && item.pageResourceId === fieldDrawerPage?.id
      ),
    [fieldDrawerFields, fieldDrawerPage?.id]
  );
  const reusableGlobalFields = useMemo(
    () => fieldDrawerFields.filter((item) => item.scope === "GLOBAL"),
    [fieldDrawerFields]
  );
  const quickBindUsePublicField = Form.useWatch("usePublicField", quickBindForm) ?? false;
  const quickBindElementLogicName = Form.useWatch("elementLogicName", quickBindForm) ?? "";
  const businessFieldMap = useMemo(
    () => Object.fromEntries(fieldDrawerFields.map((item) => [item.code, item])),
    [fieldDrawerFields]
  );
  const elementLabelMap = useMemo(
    () => Object.fromEntries(fieldDrawerElements.map((item) => [item.id, item.logicName])),
    [fieldDrawerElements]
  );

  useEffect(() => {
    if (!quickBindOpen || quickBindUsePublicField) {
      return;
    }
    quickBindForm.setFieldValue("fieldName", quickBindElementLogicName.trim());
  }, [quickBindElementLogicName, quickBindForm, quickBindOpen, quickBindUsePublicField]);

  const orgOptions = useMemo(() => {
    return Array.from(new Set(resources.map((item) => item.ownerOrgId))).map((item) => toOrgOption(item));
  }, [resources]);

  const pendingMenus = menuRows.filter((item) => item.promptStatus === "PENDING" || item.jobStatus === "PENDING").length;
  const readyMenus = menuRows.filter((item) => item.promptStatus === "ENABLED" && item.jobStatus === "ENABLED").length;
  const needRequestMenus = menuRows.filter((item) => item.promptStatus === "DISABLED" || item.jobStatus === "DISABLED").length;
  const requestMenu = menuRows.find((item) => item.id === requestMenuId) ?? null;

  function resetFilters() {
    setRegionFilter("ALL");
    setKeyword("");
    setOrgFilter("ALL");
    setWorkFilter("ALL");
  }

  function openRequest(menuId: number) {
    const menuRow = menuRows.find((item) => item.id === menuId);
    if (!menuRow) {
      return;
    }
    const defaultCapabilityTypes: RequestCapabilityType[] = [];
    if (menuRow.promptStatus === "DISABLED") {
      defaultCapabilityTypes.push("PROMPT");
    }
    if (menuRow.jobStatus === "DISABLED") {
      defaultCapabilityTypes.push("JOB");
    }
    requestForm.setFieldsValue({
      capabilityTypes: defaultCapabilityTypes,
      reason: `菜单「${menuRow.menuName}」当前业务需要补充能力开通，请协助处理。`
    });
    setRequestMenuId(menuId);
  }

  async function submitRequest() {
    if (!requestMenuId) {
      return;
    }
    try {
      const values = await requestForm.validateFields();
      setRequestSubmitting(true);
      await configCenterService.submitMenuCapabilityRequest({
        menuId: requestMenuId,
        capabilityTypes: values.capabilityTypes,
        reason: values.reason,
        applicant: "person-business-operator"
      });
      const latestPolicies = await configCenterService.listMenuCapabilityPolicies();
      setMenuCapabilities(latestPolicies);
      setRequestMenuId(undefined);
      msgApi.success("申请已提交给菜单开通管理员");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "申请提交失败";
      msgApi.error(errorMessage);
    } finally {
      setRequestSubmitting(false);
    }
  }

  function createPrompt(page: EnhancedPageRow) {
    const presetSceneId = scenes.find((item) => item.pageResourceId === page.id)?.id;
    navigate(
      `/prompts?pageResourceId=${page.id}&action=create${sharedTemplateId ? `&templateRuleId=${sharedTemplateId}` : ""}${
        presetSceneId ? `&sceneId=${presetSceneId}` : ""
      }`
    );
  }

  function createJob(page: EnhancedPageRow) {
    const presetExecutionMode = scenes.find((item) => item.pageResourceId === page.id)?.executionMode ?? "PREVIEW_THEN_EXECUTE";
    navigate(
      `/jobs?pageResourceId=${page.id}&action=create&executionMode=${presetExecutionMode}&sceneName=${encodeURIComponent(
        `${page.name}-自动化场景`
      )}`
    );
  }

  async function loadFieldDrawerModel(pageId: number) {
    setFieldDrawerLoading(true);
    try {
      const [fieldRows, bindingRows, elementRows] = await Promise.all([
        configCenterService.listBusinessFields(pageId),
        configCenterService.listPageFieldBindings(pageId),
        configCenterService.listPageElements(pageId)
      ]);
      setFieldDrawerFields(fieldRows);
      setFieldDrawerBindings(bindingRows);
      setFieldDrawerElements(elementRows);
      setPageFieldBindingCounts((previous) => ({
        ...previous,
        [pageId]: bindingRows.length
      }));
    } finally {
      setFieldDrawerLoading(false);
    }
  }

  async function openFieldMaintenance(page: EnhancedPageRow) {
    setFieldDrawerPage(page);
    setFieldDrawerOpen(true);
    setEditingField(null);
    setEditingBinding(null);
    await loadFieldDrawerModel(page.id);
  }

  function openQuickBind() {
    if (!fieldDrawerPage) {
      return;
    }
    quickBindForm.setFieldsValue({
      usePublicField: false,
      fieldName: "",
      businessFieldCode: undefined,
      elementLogicName: "",
      elementSelector: "",
      elementSelectorType: "XPATH",
      required: false
    });
    setQuickBindOpen(true);
  }

  async function submitQuickBind() {
    if (!fieldDrawerPage) {
      return;
    }
    const values = await quickBindForm.validateFields();
    const createdElement = await configCenterService.upsertPageElement({
      id: Date.now(),
      pageResourceId: fieldDrawerPage.id,
      logicName: values.elementLogicName ?? "",
      selector: values.elementSelector ?? "",
      selectorType: values.elementSelectorType ?? "XPATH",
      required: values.required ?? false
    });

    let businessFieldCode = values.businessFieldCode;
    if (!values.usePublicField) {
      const createdField = await configCenterService.upsertBusinessField({
        id: Date.now() + 1,
        code: createId("field"),
        name: values.fieldName ?? values.elementLogicName ?? "",
        scope: "PAGE_RESOURCE",
        pageResourceId: fieldDrawerPage.id,
        valueType: "STRING",
        required: values.required ?? false,
        description: "",
        ownerOrgId: fieldDrawerPage.ownerOrgId,
        status: "DRAFT",
        currentVersion: 1,
        aliases: []
      });
      businessFieldCode = createdField.code;
    }

    await configCenterService.upsertPageFieldBinding({
      id: Date.now() + 2,
      pageResourceId: fieldDrawerPage.id,
      businessFieldCode: businessFieldCode ?? "",
      pageElementId: createdElement.id,
      required: values.required ?? false
    });
    msgApi.success(values.usePublicField ? "元素已绑定到公共字段" : "元素已生成页面字段并完成绑定");
    setQuickBindOpen(false);
    await loadFieldDrawerModel(fieldDrawerPage.id);
  }

  function openEditField(row: BusinessFieldDefinition) {
    setEditingField(row);
    fieldForm.setFieldsValue({
      name: row.name,
      description: row.description,
      required: row.required,
      ownerOrgId: row.ownerOrgId,
      status: row.status
    });
    setFieldOpen(true);
  }

  async function submitField() {
    if (!fieldDrawerPage) {
      return;
    }
    const values = await fieldForm.validateFields();
    await configCenterService.upsertBusinessField({
      id: editingField?.id ?? Date.now(),
      code: editingField?.code ?? createId("field"),
      name: values.name,
      scope: "PAGE_RESOURCE",
      pageResourceId: fieldDrawerPage.id,
      valueType: editingField?.valueType ?? "STRING",
      required: values.required,
      description: values.description,
      ownerOrgId: values.ownerOrgId,
      status: values.status,
      currentVersion: editingField?.currentVersion ?? 1,
      aliases: editingField?.aliases ?? []
    });
    msgApi.success(editingField ? "页面字段已更新" : "页面字段已创建");
    setFieldOpen(false);
    await loadFieldDrawerModel(fieldDrawerPage.id);
  }

  function openEditBinding(row: PageFieldBinding) {
    setEditingBinding(row);
    bindingForm.setFieldsValue({
      businessFieldCode: row.businessFieldCode,
      pageElementId: row.pageElementId,
      required: row.required
    });
    setBindingOpen(true);
  }

  async function submitBinding() {
    if (!fieldDrawerPage) {
      return;
    }
    const values = await bindingForm.validateFields();
    await configCenterService.upsertPageFieldBinding({
      id: editingBinding?.id ?? Date.now(),
      pageResourceId: fieldDrawerPage.id,
      businessFieldCode: values.businessFieldCode,
      pageElementId: values.pageElementId,
      required: values.required
    });
    msgApi.success(editingBinding ? "字段绑定已更新" : "字段绑定已创建");
    setBindingOpen(false);
    await loadFieldDrawerModel(fieldDrawerPage.id);
  }

  async function removeBinding(row: PageFieldBinding) {
    if (!fieldDrawerPage) {
      return;
    }
    await configCenterService.deletePageFieldBinding(row.id);
    msgApi.success("字段绑定已删除");
    await loadFieldDrawerModel(fieldDrawerPage.id);
  }

  function openPublicFieldGovernance() {
    navigate("/advanced?tab=public-fields");
  }

  function getPageActionState(page: EnhancedPageRow) {
    return {
      needRequest: page.menuPromptStatus === "DISABLED" || page.menuJobStatus === "DISABLED",
      pending: page.menuPromptStatus === "PENDING" || page.menuJobStatus === "PENDING"
    };
  }

  function goPrevPage() {
    if (!selectedPage) {
      return;
    }
    const idx = selectedMenuPages.findIndex((item) => item.id === selectedPage.id);
    if (idx > 0) {
      setSelectedPageId(selectedMenuPages[idx - 1].id);
    }
  }

  function goNextPage() {
    if (!selectedPage) {
      return;
    }
    const idx = selectedMenuPages.findIndex((item) => item.id === selectedPage.id);
    if (idx >= 0 && idx < selectedMenuPages.length - 1) {
      setSelectedPageId(selectedMenuPages[idx + 1].id);
    }
  }

  return (
    <div>
      {holder}
      <PageHeader>
        <Typography.Title level={4}>菜单管理</Typography.Title>
        <Typography.Text style={{ color: "#475467" }}>
          以菜单为入口查看能力开通状态、页面配置覆盖率和下一步动作，减少在多个页面之间切换。
        </Typography.Text>
      </PageHeader>

      {pendingMenus > 0 ? (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          message={`当前有 ${pendingMenus} 个菜单能力申请处于开通中`}
        />
      ) : null}

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard $accent="linear-gradient(90deg, #1f63f0 0%, #4c8dff 100%)">
            <Statistic title="菜单总数" value={menuRows.length} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard $accent="linear-gradient(90deg, #169060 0%, #47b985 100%)">
            <Statistic title="能力已开通" value={readyMenus} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard $accent="linear-gradient(90deg, #cb7f27 0%, #efb865 100%)">
            <Statistic title="待开通菜单" value={needRequestMenus} />
          </SummaryCard>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard $accent="linear-gradient(90deg, #475467 0%, #667085 100%)">
            <Statistic title="筛选结果" value={filteredMenuRows.length} />
          </SummaryCard>
        </Col>
      </Row>

      <FilterCard title="筛选条件">
        <Row gutter={[10, 10]} align="middle">
          <Col xs={24} lg={6}>
            <div>
              <FilterLabel>专区</FilterLabel>
              <Select
                value={regionFilter}
                style={{ width: "100%" }}
                onChange={setRegionFilter}
                options={[
                  { label: "全部专区", value: "ALL" },
                  ...regions.map((item) => ({ label: item.regionName, value: String(item.id) }))
                ]}
              />
            </div>
          </Col>
          <Col xs={24} lg={7}>
            <div>
              <FilterLabel>关键词</FilterLabel>
              <Input.Search
                value={keyword}
                allowClear
                style={{ width: "100%" }}
                placeholder="搜索菜单 / 页面"
                onChange={(event) => setKeyword(event.target.value)}
                onSearch={(value) => setKeyword(value)}
              />
            </div>
          </Col>
          <Col xs={24} lg={5}>
            <div>
              <FilterLabel>组织</FilterLabel>
              <OrgSelect
                includeAll
                value={orgFilter}
                style={{ width: "100%" }}
                onChange={setOrgFilter}
                options={orgOptions}
              />
            </div>
          </Col>
          <Col xs={24} lg={4}>
            <div>
              <FilterLabel>工作状态</FilterLabel>
              <Select
                value={workFilter}
                style={{ width: "100%" }}
                onChange={(value) => setWorkFilter(value as WorkFilter)}
                options={[
                  { label: "全部状态", value: "ALL" },
                  { label: "能力已开通", value: "READY" },
                  { label: "待开通", value: "NEED_REQUEST" },
                  { label: "开通中", value: "PENDING" }
                ]}
              />
            </div>
          </Col>
          <Col xs={24} lg={2}>
            <FilterActions>
              <Button onClick={resetFilters}>重置筛选</Button>
            </FilterActions>
          </Col>
        </Row>
      </FilterCard>

      <Row gutter={[12, 12]} align="stretch">
        <Col xs={24} xl={11}>
          <MenuListCard title="菜单列表" extra={<Typography.Text type="secondary">共 {filteredMenuRows.length} 项</Typography.Text>}>
            <List<MenuOverviewRow>
              loading={loading}
              dataSource={filteredMenuRows}
              pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"] }}
              locale={{ emptyText: "暂无符合条件的菜单" }}
              renderItem={(row) => {
                const active = row.id === selectedMenuId;
                const promptCoverage = calcCoverage(row.configuredPromptPages, row.pageCount);
                const jobCoverage = calcCoverage(row.configuredJobPages, row.pageCount);
                return (
                  <List.Item style={{ paddingInline: 0 }}>
                    <MenuItemCard hoverable size="small" onClick={() => setSelectedMenuId(row.id)} $active={active}>
                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                        <Space direction="vertical" size={0}>
                          <Typography.Text strong>{row.menuName}</Typography.Text>
                          <Typography.Text type={active ? undefined : "secondary"}>{row.regionName}</Typography.Text>
                        </Space>
                        <Space size={[4, 4]} wrap>
                          <Tag color={capabilityStatusMeta[row.promptStatus].color}>提示：{capabilityStatusMeta[row.promptStatus].label}</Tag>
                          <Tag color={capabilityStatusMeta[row.jobStatus].color}>作业：{capabilityStatusMeta[row.jobStatus].label}</Tag>
                          <Tag>页面 {row.pageCount}</Tag>
                          <Tag color={row.promptRuleTotal > 0 ? "blue" : "default"}>智能提示 {row.promptRuleTotal}</Tag>
                          <Tag color={row.jobSceneTotal > 0 ? "processing" : "default"}>作业数 {row.jobSceneTotal}</Tag>
                        </Space>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <Typography.Text type="secondary">提示覆盖 {row.configuredPromptPages}/{row.pageCount}</Typography.Text>
                            <Progress percent={promptCoverage} size="small" showInfo={false} strokeColor="#1677ff" />
                          </div>
                          <div>
                            <Typography.Text type="secondary">作业覆盖 {row.configuredJobPages}/{row.pageCount}</Typography.Text>
                            <Progress percent={jobCoverage} size="small" showInfo={false} strokeColor="#0c7a43" />
                          </div>
                        </div>
                      </Space>
                    </MenuItemCard>
                  </List.Item>
                );
              }}
            />
          </MenuListCard>
        </Col>

        <Col xs={24} xl={13}>
          <DetailCard
            title={selectedMenu ? `菜单详情：${selectedMenu.menuName}` : "菜单详情"}
            extra={
              selectedMenu ? (
                <Space>
                  {selectedMenuPending ? (
                    <Button size="small" disabled>
                      开通中
                    </Button>
                  ) : selectedMenuNeedRequest ? (
                    <Button size="small" onClick={() => openRequest(selectedMenu.id)}>
                      申请菜单开通
                    </Button>
                  ) : null}
                  {selectedMenuPages.length > 1 ? (
                    <>
                      <Tag>{selectedPagePosition}/{selectedMenuPages.length}</Tag>
                      <Select
                        value={selectedPageId}
                        style={{ width: 280 }}
                        onChange={(value) => setSelectedPageId(value)}
                        options={selectedMenuPages.map((item) => ({
                          label: `${item.name}（提示 ${item.promptRuleCount} / 作业 ${item.jobSceneCount}）`,
                          value: item.id
                        }))}
                      />
                      <Button onClick={goPrevPage} disabled={!selectedPage || selectedMenuPages.findIndex((item) => item.id === selectedPage.id) <= 0}>
                        上一页
                      </Button>
                      <Button
                        onClick={goNextPage}
                        disabled={
                          !selectedPage ||
                          selectedMenuPages.findIndex((item) => item.id === selectedPage.id) >= selectedMenuPages.length - 1
                        }
                      >
                        下一页
                      </Button>
                    </>
                  ) : null}
                </Space>
              ) : null
            }
          >
            {selectedMenu ? (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                <Alert
                  showIcon
                  type={selectedMenuPending ? "warning" : "info"}
                  message={
                    selectedMenuPending
                      ? "当前菜单能力申请处理中"
                      : selectedMenuNeedRequest
                        ? "当前菜单部分能力尚未开通"
                        : "当前菜单能力已就绪，可直接配置"
                  }
                  description={
                    <Space size={[6, 6]} wrap>
                      <Tag color={capabilityStatusMeta[selectedMenu.promptStatus].color}>
                        智能提示：{capabilityStatusMeta[selectedMenu.promptStatus].label}
                      </Tag>
                      <Tag color={capabilityStatusMeta[selectedMenu.jobStatus].color}>
                        智能作业：{capabilityStatusMeta[selectedMenu.jobStatus].label}
                      </Tag>
                      <Tag>菜单页面 {selectedMenu.pageCount}</Tag>
                    </Space>
                  }
                />
                <Card
                  size="small"
                  title="SDK 版本结果态"
                  extra={
                    <Button
                      size="small"
                      onClick={() =>
                        navigate(
                          `/sdk-version-center?action=edit&menuId=${selectedMenu.id}&siteId=${menuMap[selectedMenu.id]?.siteId ?? ""}&regionId=${
                            menuMap[selectedMenu.id]?.regionId ?? ""
                          }`
                        )
                      }
                    >
                      去 SDK版本中心配置
                    </Button>
                  }
                >
                  <Space direction="vertical" size={8}>
                    <Space wrap size={[8, 8]}>
                      <Tag color={selectedMenuSdkPolicy?.promptGrayEnabled ? "orange" : "default"}>
                        提示灰度: {selectedMenuSdkPolicy?.promptGrayEnabled ? "已配置" : "未配置"}
                      </Tag>
                      <Tag color={selectedMenuSdkPolicy?.jobGrayEnabled ? "purple" : "default"}>
                        作业灰度: {selectedMenuSdkPolicy?.jobGrayEnabled ? "已配置" : "未配置"}
                      </Tag>
                    </Space>
                    <Typography.Text>
                      提示生效版本：{selectedMenuPromptVersion?.version ?? "-"}
                      <Typography.Text type="secondary">（{selectedMenuPromptVersion?.source === "MENU_GRAY" ? "命中菜单灰度" : "平台正式版本"}）</Typography.Text>
                    </Typography.Text>
                    <Typography.Text>
                      作业生效版本：{selectedMenuJobVersion?.version ?? "-"}
                      <Typography.Text type="secondary">（{selectedMenuJobVersion?.source === "MENU_GRAY" ? "命中菜单灰度" : "平台正式版本"}）</Typography.Text>
                    </Typography.Text>
                  </Space>
                </Card>
                {selectedPage ? (
                  <Space direction="vertical" style={{ width: "100%" }} size={12}>
                    {selectedPageActionState?.needRequest ? (
                      <Alert
                        type={selectedPageActionState.pending ? "warning" : "info"}
                        showIcon
                        message={selectedPageActionState.pending ? "菜单能力开通中" : "菜单能力尚未开通"}
                        description={
                          <Space>
                            <Typography.Text>当前页面暂不可新增提示或作业配置。</Typography.Text>
                            {selectedPageActionState.pending ? (
                              <Button size="small" disabled>
                                开通中
                              </Button>
                            ) : (
                              <Button size="small" onClick={() => openRequest(selectedPage.menuId)}>
                                申请菜单开通
                              </Button>
                            )}
                          </Space>
                        }
                      />
                    ) : null}

                    {!selectedPageActionState?.needRequest ? (
                      <Card
                        size="small"
                        title="配置动作"
                        extra={
                          <Space>
                            <Button type="primary" onClick={() => createPrompt(selectedPage)}>
                              新增提示规则
                            </Button>
                            <Button onClick={() => createJob(selectedPage)}>新增作业配置</Button>
                          </Space>
                        }
                      >
                        <Space size={[8, 8]} wrap>
                          <Tag color="blue">提示规则 {selectedPage.promptRuleCount}</Tag>
                          <Tag color="purple">作业场景 {selectedPage.jobSceneCount}</Tag>
                          <Tag color={selectedPage.enabled ? "green" : "default"}>{selectedPage.enabled ? "页面已启用" : "页面未启用"}</Tag>
                        </Space>
                      </Card>
                    ) : null}

                    <Card
                      size="small"
                      title={`当前页面：${selectedPage.name}`}
                      extra={
                        <Space>
                          <Tag>{selectedPagePosition}/{selectedMenuPages.length}</Tag>
                          <Button size="small" onClick={() => void openFieldMaintenance(selectedPage)}>
                            元素映射
                          </Button>
                        </Space>
                      }
                    >
                      <Descriptions size="small" column={2}>
                        <Descriptions.Item label="页面名称">{selectedPage.name}</Descriptions.Item>
                        <Descriptions.Item label="所属专区">{selectedPage.regionName}</Descriptions.Item>
                        <Descriptions.Item label="所属菜单">{selectedPage.menuName}</Descriptions.Item>
                        <Descriptions.Item label="页面状态">{lifecycleLabelMap[selectedPage.status]}</Descriptions.Item>
                        <Descriptions.Item label="已绑定字段数">{selectedPageFieldBindingCount}</Descriptions.Item>
                        <Descriptions.Item label="最近更新">{selectedPage.updatedAt}</Descriptions.Item>
                      </Descriptions>
                    </Card>

                    <Card size="small" title="运行情况">
                      <Space size={24} wrap>
                        <Statistic title="近 7 天触发次数" value={selectedPage.trend7d} />
                        <Statistic title="近 30 天触发次数" value={selectedPage.trend7d * 4 + 18} />
                        <Statistic
                          title="发布后下降比例"
                          value={selectedPage.dropRate}
                          suffix="%"
                          valueStyle={{ color: selectedPage.dropRate >= 10 ? "#d46b08" : "#389e0d" }}
                        />
                      </Space>
                    </Card>

                    {selectedRules.length > 0 ? (
                      <Card size="small" title="当前页面已配置规则">
                        <Space size={[4, 4]} wrap>
                          {selectedRules.map((item) => (
                            <Tag key={item.id}>{item.name}</Tag>
                          ))}
                        </Space>
                      </Card>
                    ) : null}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">该菜单下暂无页面。</Typography.Text>
                )}
              </Space>
            ) : (
              <Typography.Text type="secondary">请选择一个菜单查看详情。</Typography.Text>
            )}
          </DetailCard>
        </Col>
      </Row>

      <Drawer
        title={fieldDrawerPage ? `元素映射：${fieldDrawerPage.name}` : "元素映射"}
        placement="right"
        width={720}
        open={fieldDrawerOpen}
        onClose={() => {
          setFieldDrawerOpen(false);
          setQuickBindOpen(false);
          setFieldOpen(false);
          setBindingOpen(false);
        }}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            showIcon
            type="info"
            message="先录元素，再完成字段映射"
          />

          <Card
            size="small"
            title="当前页面字段"
            extra={
              <Space>
                <Button onClick={openPublicFieldGovernance}>公共字段治理</Button>
                <Button type="primary" onClick={openQuickBind} disabled={!fieldDrawerPage}>
                  元素映射
                </Button>
              </Space>
            }
          >
            <Table<BusinessFieldDefinition>
              rowKey="id"
              loading={fieldDrawerLoading}
              dataSource={pageSpecificFields}
              pagination={false}
              locale={{ emptyText: "当前页面还没有页面特有字段，可按需补充。" }}
              columns={[
                { title: "字段名称", dataIndex: "name", width: 180 },
                { title: "说明", dataIndex: "description" },
                {
                  title: "状态",
                  width: 100,
                  render: (_, row) => <Tag>{lifecycleLabelMap[row.status]}</Tag>
                },
                {
                  title: "操作",
                  width: 100,
                  render: (_, row) => (
                    <Button size="small" onClick={() => openEditField(row)}>
                      编辑
                    </Button>
                  )
                }
              ]}
            />
          </Card>

          <Card
            size="small"
            title="字段绑定"
          >
            <Table<PageFieldBinding>
              rowKey="id"
              loading={fieldDrawerLoading}
              dataSource={fieldDrawerBindings}
              pagination={false}
              locale={{ emptyText: "当前页面还没有字段绑定。" }}
              columns={[
                {
                  title: "字段",
                  width: 220,
                  render: (_, row) => {
                    const field = businessFieldMap[row.businessFieldCode];
                    if (!field) {
                      return <Typography.Text type="secondary">字段已不存在</Typography.Text>;
                    }
                    return (
                      <Space size={6}>
                        <Typography.Text>{field.name}</Typography.Text>
                        <Tag color={field.scope === "GLOBAL" ? "blue" : "geekblue"}>
                          {field.scope === "GLOBAL" ? "公共字段" : "页面字段"}
                        </Tag>
                      </Space>
                    );
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

          <Card size="small" title="可引用公共字段">
            <Space size={[8, 8]} wrap>
              {reusableGlobalFields.length > 0 ? (
                reusableGlobalFields.map((field) => <Tag key={field.id}>{field.name}</Tag>)
              ) : (
                <Typography.Text type="secondary">当前还没有可复用公共字段。</Typography.Text>
              )}
            </Space>
          </Card>
        </Space>
      </Drawer>

      <Modal
        title="元素映射"
        open={quickBindOpen}
        onCancel={() => setQuickBindOpen(false)}
        onOk={() => void submitQuickBind()}
      >
        <Form form={quickBindForm} layout="vertical">
          <Form.Item name="elementLogicName" label="元素名" rules={[{ required: true, message: "请输入元素名" }]}>
            <Input placeholder="例如：客户号输入框" />
          </Form.Item>
          <Form.Item label="自动生成字段名">
            <Input value={quickBindElementLogicName.trim()} disabled placeholder="输入元素名后自动生成" />
          </Form.Item>
          <Form.Item name="elementSelectorType" label="选择器类型" rules={[{ required: true, message: "请选择选择器类型" }]}>
            <Select
              options={[
                { label: "XPATH", value: "XPATH" },
                { label: "CSS", value: "CSS" }
              ]}
            />
          </Form.Item>
          <Form.Item name="elementSelector" label="元素选择器" rules={[{ required: true, message: "请输入元素选择器" }]}>
            <Input placeholder="例如：//*[@id='customerNo']" />
          </Form.Item>
          <Form.Item name="usePublicField" label="使用公共字段" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          {quickBindUsePublicField ? (
            <Form.Item name="businessFieldCode" label="公共字段" rules={[{ required: true, message: "请选择公共字段" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={reusableGlobalFields.map((field) => ({
                  label: field.name,
                  value: field.code
                }))}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑页面字段"
        open={fieldOpen}
        onCancel={() => setFieldOpen(false)}
        onOk={() => void submitField()}
      >
        <Form form={fieldForm} layout="vertical">
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
        title="编辑字段绑定"
        open={bindingOpen}
        onCancel={() => setBindingOpen(false)}
        onOk={() => void submitBinding()}
      >
        <Form form={bindingForm} layout="vertical">
          <Form.Item name="businessFieldCode" label="字段" rules={[{ required: true, message: "请选择字段" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={fieldDrawerFields.map((field) => ({
                label: `${field.name}（${field.scope === "GLOBAL" ? "公共字段" : "页面字段"}）`,
                value: field.code
              }))}
            />
          </Form.Item>
          <Form.Item name="pageElementId" label="元素" rules={[{ required: true, message: "请选择元素" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={fieldDrawerElements.map((element) => ({
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

      <Modal
        title={requestMenu ? `申请菜单开通：${requestMenu.menuName}` : "申请菜单开通"}
        open={Boolean(requestMenu)}
        confirmLoading={requestSubmitting}
        onCancel={() => setRequestMenuId(undefined)}
        onOk={() => void submitRequest()}
        okText="提交申请"
      >
        <Form form={requestForm} layout="vertical">
          <Alert
            showIcon
            type="info"
            style={{ marginBottom: 12 }}
            message="申请会提交给菜单开通管理员审批"
          />
          <Form.Item
            name="capabilityTypes"
            label="申请能力"
            rules={[{ required: true, message: "请至少选择一个能力" }]}
          >
            <Checkbox.Group
              options={[
                {
                  label: `智能提示（${requestMenu ? capabilityStatusMeta[requestMenu.promptStatus].label : "-"})`,
                  value: "PROMPT",
                  disabled: requestMenu ? requestMenu.promptStatus !== "DISABLED" : true
                },
                {
                  label: `智能作业（${requestMenu ? capabilityStatusMeta[requestMenu.jobStatus].label : "-"})`,
                  value: "JOB",
                  disabled: requestMenu ? requestMenu.jobStatus !== "DISABLED" : true
                }
              ]}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="申请原因"
            rules={[
              { required: true, message: "请填写申请原因" },
              { min: 10, message: "申请原因至少 10 个字，便于管理员评估" }
            ]}
          >
            <Input.TextArea rows={4} maxLength={300} placeholder="例如：贷款审核菜单近期需要发布提示与作业能力，降低人工漏检风险。" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
