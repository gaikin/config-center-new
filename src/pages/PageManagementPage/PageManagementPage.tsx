import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrgSelect, OrgText } from "../../components/DirectoryFields";
import { lifecycleLabelMap } from "../../enumLabels";
import { toOrgOption } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import type {
  CapabilityOpenStatus,
  JobSceneDefinition,
  MenuCapabilityPolicy,
  PageActivationPolicy,
  PageMenu,
  PageRegion,
  PageResource,
  RuleDefinition
} from "../../types";

type WorkFilter = "ALL" | "READY" | "NEED_REQUEST" | "PENDING";
type RequestCapabilityType = "PROMPT" | "JOB";

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
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [scenes, setScenes] = useState<JobSceneDefinition[]>([]);

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
        const [regionRows, menuRows, resourceRows, policyRows, capabilityRows, ruleRows, sceneRows] = await Promise.all([
          configCenterService.listPageRegions(),
          configCenterService.listPageMenus(),
          configCenterService.listPageResources(),
          configCenterService.listPageActivationPolicies(),
          configCenterService.listMenuCapabilityPolicies(),
          configCenterService.listRules(),
          configCenterService.listJobScenes()
        ]);
        if (!active) {
          return;
        }
        setRegions(regionRows);
        setMenus(menuRows);
        setResources(resourceRows);
        setPolicies(policyRows);
        setMenuCapabilities(capabilityRows);
        setRules(ruleRows);
        setScenes(sceneRows);
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

  const selectedRules = useMemo(
    () => rules.filter((item) => item.pageResourceId === selectedPage?.id),
    [rules, selectedPage?.id]
  );
  const selectedPageActionState = selectedPage ? getPageActionState(selectedPage) : null;

  const orgOptions = useMemo(() => {
    return Array.from(new Set(resources.map((item) => item.ownerOrgId))).map((item) => toOrgOption(item));
  }, [resources]);

  const pendingMenus = menuRows.filter((item) => item.promptStatus === "PENDING" || item.jobStatus === "PENDING").length;
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

  function getMenuTargetPage(menuId: number) {
    const pages = menuPagesMap[menuId] ?? [];
    if (pages.length === 0) {
      return undefined;
    }
    if (selectedMenuId === menuId) {
      const currentPage = pages.find((item) => item.id === selectedPageId);
      if (currentPage) {
        return currentPage;
      }
    }
    return pages[0];
  }

  function createPromptFromMenu(menuId: number) {
    const targetPage = getMenuTargetPage(menuId);
    if (!targetPage) {
      msgApi.warning("该菜单下暂无页面，暂不可新增提示规则");
      return;
    }
    setSelectedMenuId(menuId);
    setSelectedPageId(targetPage.id);
    createPrompt(targetPage);
  }

  function createJobFromMenu(menuId: number) {
    const targetPage = getMenuTargetPage(menuId);
    if (!targetPage) {
      msgApi.warning("该菜单下暂无页面，暂不可新增作业配置");
      return;
    }
    setSelectedMenuId(menuId);
    setSelectedPageId(targetPage.id);
    createJob(targetPage);
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
      <Typography.Title level={4}>页面管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        以菜单为业务入口：先选菜单，再查看该菜单下页面配置详情，直接发起提示或作业配置。
      </Typography.Paragraph>

      {pendingMenus > 0 ? (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          message={`当前有 ${pendingMenus} 个菜单能力申请处于开通中`}
          description="申请处理完成后，相关页面会自动开放新增提示/新增作业入口。"
        />
      ) : null}

      <Card style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select
            value={regionFilter}
            style={{ width: 220 }}
            onChange={setRegionFilter}
            options={[
              { label: "全部专区", value: "ALL" },
              ...regions.map((item) => ({ label: item.regionName, value: String(item.id) }))
            ]}
          />
          <Input.Search
            value={keyword}
            allowClear
            style={{ width: 260 }}
            placeholder="搜索菜单名称 / 页面名称"
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => setKeyword(value)}
          />
          <OrgSelect
            includeAll
            value={orgFilter}
            style={{ width: 180 }}
            onChange={setOrgFilter}
            options={orgOptions}
          />
          <Select
            value={workFilter}
            style={{ width: 170 }}
            onChange={(value) => setWorkFilter(value as WorkFilter)}
            options={[
              { label: "全部状态", value: "ALL" },
              { label: "能力已开通", value: "READY" },
              { label: "待开通", value: "NEED_REQUEST" },
              { label: "开通中", value: "PENDING" }
            ]}
          />
          <Button onClick={resetFilters}>重置筛选</Button>
        </Space>
      </Card>

      <Card title="菜单列表">
        <Table<MenuOverviewRow>
          rowKey="id"
          loading={loading}
          dataSource={filteredMenuRows}
          pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: ["8", "12", "20"] }}
          onRow={(row) => ({
            onClick: () => setSelectedMenuId(row.id)
          })}
          rowClassName={(row) => (row.id === selectedMenuId ? "ant-table-row-selected" : "")}
          columns={[
            {
              title: "菜单",
              width: 260,
              render: (_, row) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{row.menuName}</Typography.Text>
                  <Typography.Text type="secondary">{row.regionName}</Typography.Text>
                </Space>
              )
            },
            {
              title: "涉及机构",
              width: 220,
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  {row.ownerOrgIds.slice(0, 2).map((item) => (
                    <Tag key={item}>
                      <OrgText value={item} />
                    </Tag>
                  ))}
                  {row.ownerOrgIds.length > 2 ? <Tag>+{row.ownerOrgIds.length - 2}</Tag> : null}
                </Space>
              )
            },
            {
              title: "配置概览",
              width: 300,
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  <Tag color={row.configuredPromptPages > 0 ? "blue" : "default"}>
                    提示页 {row.configuredPromptPages}/{row.pageCount}
                  </Tag>
                  <Tag color={row.configuredJobPages > 0 ? "purple" : "default"}>
                    作业页 {row.configuredJobPages}/{row.pageCount}
                  </Tag>
                  <Tag color={row.promptRuleTotal > 0 ? "blue" : "default"}>规则 {row.promptRuleTotal}</Tag>
                  <Tag color={row.jobSceneTotal > 0 ? "purple" : "default"}>场景 {row.jobSceneTotal}</Tag>
                </Space>
              )
            },
            {
              title: "动作",
              width: 260,
              render: (_, row) => {
                const needRequest = row.promptStatus === "DISABLED" || row.jobStatus === "DISABLED";
                const pending = row.promptStatus === "PENDING" || row.jobStatus === "PENDING";
                if (pending) {
                  return <Button size="small" disabled>开通中</Button>;
                }
                if (needRequest) {
                  return (
                    <Button size="small" onClick={(e) => { e.stopPropagation(); openRequest(row.id); }}>
                      申请菜单开通
                    </Button>
                  );
                }
                return (
                  <Space size={6} wrap>
                    <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); createPromptFromMenu(row.id); }}>
                      新增提示规则
                    </Button>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); createJobFromMenu(row.id); }}>
                      新增智能作业
                    </Button>
                  </Space>
                );
              }
            }
          ]}
        />
      </Card>

      {selectedMenu ? (
        <Card
          style={{ marginTop: 12 }}
          title={`菜单下页面配置详情：${selectedMenu.menuName}`}
          extra={
            selectedMenuPages.length > 1 ? (
              <Space>
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
              </Space>
            ) : null
          }
        >
          {selectedPage ? (
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              {selectedPageActionState?.needRequest ? (
                <Alert
                  type={selectedPageActionState.pending ? "warning" : "info"}
                  showIcon
                  message={selectedPageActionState.pending ? "菜单能力开通中" : "菜单能力尚未开通"}
                  description={
                    <Space>
                      <Typography.Text>当前页面暂不可新增提示或作业。</Typography.Text>
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

              <Card size="small" title="页面信息">
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="页面名称">{selectedPage.name}</Descriptions.Item>
                  <Descriptions.Item label="所属专区">{selectedPage.regionName}</Descriptions.Item>
                  <Descriptions.Item label="所属菜单">{selectedPage.menuName}</Descriptions.Item>
                  <Descriptions.Item label="页面状态">{lifecycleLabelMap[selectedPage.status]}</Descriptions.Item>
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
        </Card>
      ) : null}

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
            description="请选择未开通能力并说明业务原因，审批通过后即可在页面继续配置。"
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
            <Input.TextArea rows={4} maxLength={300} placeholder="例如：贷款审核菜单近期需要上线提示+作业能力，降低人工漏检风险。" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
