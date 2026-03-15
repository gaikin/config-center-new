import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrgSelect, OrgText } from "../../components/DirectoryFields";
import { lifecycleLabelMap } from "../../enumLabels";
import { getOrgLabel, toOrgOption } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import type {
  InterfaceDefinition,
  JobSceneDefinition,
  PageActivationPolicy,
  PageMenu,
  PageRegion,
  PageResource,
  RuleDefinition
} from "../../types";

type EnabledFilter = "ALL" | "ENABLED" | "DISABLED";

type EnhancedPageRow = PageResource & {
  regionName: string;
  menuName: string;
  enabled: boolean;
  hasPrompt: boolean;
  hasJob: boolean;
  linkedApiCount: number;
  trend7d: number;
  dropRate: number;
  policy?: PageActivationPolicy;
};

export function PageManagementPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<PageRegion[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [policies, setPolicies] = useState<PageActivationPolicy[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [scenes, setScenes] = useState<JobSceneDefinition[]>([]);
  const [interfaces, setInterfaces] = useState<InterfaceDefinition[]>([]);

  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [keyword, setKeyword] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("ALL");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("ALL");
  const [selectedPageId, setSelectedPageId] = useState<number>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const [regionRows, menuRows, resourceRows, policyRows, ruleRows, sceneRows, interfaceRows] = await Promise.all([
          configCenterService.listPageRegions(),
          configCenterService.listPageMenus(),
          configCenterService.listPageResources(),
          configCenterService.listPageActivationPolicies(),
          configCenterService.listRules(),
          configCenterService.listJobScenes(),
          configCenterService.listInterfaces()
        ]);
        if (!active) {
          return;
        }
        setRegions(regionRows);
        setMenus(menuRows);
        setResources(resourceRows);
        setPolicies(policyRows);
        setRules(ruleRows);
        setScenes(sceneRows);
        setInterfaces(interfaceRows);
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

  const tableRows = useMemo<EnhancedPageRow[]>(() => {
    return resources.map((page) => {
      const menu = menuMap[page.menuId];
      const policy = policyMap[page.id];
      const relatedRules = rules.filter((rule) => rule.pageResourceId === page.id);
      const relatedScenes = scenes.filter((scene) => scene.pageResourceId === page.id);
      const relatedApis = interfaces.filter((item) => item.ownerOrgId === page.ownerOrgId);
      return {
        ...page,
        regionName: menu ? regionNameMap[menu.regionId] ?? "-" : "-",
        menuName: menu?.menuName ?? "-",
        enabled: Boolean(policy?.enabled),
        hasPrompt: Boolean(policy?.enabled) || relatedRules.length > 0,
        hasJob: Boolean(policy?.hasJobScenes) || relatedScenes.length > 0,
        linkedApiCount: relatedApis.length,
        trend7d: 120 + (page.id % 37),
        dropRate: Number(((page.id % 17) * 1.3).toFixed(1)),
        policy
      };
    });
  }, [interfaces, menuMap, policyMap, regionNameMap, resources, rules, scenes]);

  const filteredRows = useMemo(() => {
    return tableRows.filter((row) => {
      if (regionFilter !== "ALL") {
        const menu = menuMap[row.menuId];
        if (!menu || String(menu.regionId) !== regionFilter) {
          return false;
        }
      }
      if (orgFilter !== "ALL" && row.ownerOrgId !== orgFilter) {
        return false;
      }
      if (enabledFilter === "ENABLED" && !row.enabled) {
        return false;
      }
      if (enabledFilter === "DISABLED" && row.enabled) {
        return false;
      }
      if (!keyword.trim()) {
        return true;
      }
      const normalized = keyword.trim().toLowerCase();
      return (
        row.name.toLowerCase().includes(normalized) ||
        row.menuName.toLowerCase().includes(normalized)
      );
    });
  }, [enabledFilter, keyword, menuMap, orgFilter, regionFilter, tableRows]);

  useEffect(() => {
    if (!selectedPageId && filteredRows.length > 0) {
      setSelectedPageId(filteredRows[0].id);
      return;
    }
    if (selectedPageId && !filteredRows.some((item) => item.id === selectedPageId)) {
      setSelectedPageId(filteredRows[0]?.id);
    }
  }, [filteredRows, selectedPageId]);

  const selectedPage = filteredRows.find((item) => item.id === selectedPageId) ?? null;
  const selectedRules = useMemo(
    () => rules.filter((item) => item.pageResourceId === selectedPage?.id),
    [rules, selectedPage?.id]
  );
  const sharedTemplates = useMemo(() => rules.filter((item) => item.ruleScope === "SHARED"), [rules]);
  const selectedScenes = useMemo(
    () => scenes.filter((item) => item.pageResourceId === selectedPage?.id),
    [scenes, selectedPage?.id]
  );
  const selectedApis = useMemo(
    () => interfaces.filter((item) => item.ownerOrgId === selectedPage?.ownerOrgId),
    [interfaces, selectedPage?.ownerOrgId]
  );

  const orgOptions = useMemo(() => {
    return Array.from(new Set(resources.map((item) => item.ownerOrgId))).map((item) => toOrgOption(item));
  }, [resources]);

  return (
    <div>
      <Typography.Title level={4}>页面管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        业务主入口从“页面”出发：先找到页面，再看启用范围、已开通能力和近期运行趋势，最后直接发起提示规则或作业配置。
      </Typography.Paragraph>

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
            placeholder="搜索页面名称 / 菜单"
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
            value={enabledFilter}
            style={{ width: 140 }}
            onChange={(value) => setEnabledFilter(value as EnabledFilter)}
            options={[
              { label: "全部状态", value: "ALL" },
              { label: "已启用", value: "ENABLED" },
              { label: "未启用", value: "DISABLED" }
            ]}
          />
        </Space>
      </Card>

      <Card title="页面列表">
        <Table<EnhancedPageRow>
          rowKey="id"
          loading={loading}
          dataSource={filteredRows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          onRow={(row) => ({
            onClick: () => setSelectedPageId(row.id)
          })}
          rowClassName={(row) => (row.id === selectedPageId ? "ant-table-row-selected" : "")}
          columns={[
            { title: "页面", dataIndex: "name", width: 210 },
            {
              title: "归属",
              width: 180,
              render: (_, row) => `${row.regionName} / ${row.menuName}`
            },
            { title: "机构", dataIndex: "ownerOrgId", width: 130, render: (value: string) => <OrgText value={value} /> },
            {
              title: "启用状态",
              width: 110,
              render: (_, row) => (row.enabled ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>)
            },
            {
              title: "已开通能力",
              width: 220,
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  <Tag color={row.hasPrompt ? "blue" : "default"}>智能提示</Tag>
                  <Tag color={row.hasJob ? "purple" : "default"}>智能作业</Tag>
                  <Tag color={row.linkedApiCount > 0 ? "cyan" : "default"}>API {row.linkedApiCount}</Tag>
                </Space>
              )
            },
            {
              title: "近7天触发",
              width: 150,
              render: (_, row) => (
                <Space>
                  <Typography.Text>{row.trend7d}</Typography.Text>
                  {row.dropRate >= 10 ? <Tag color="orange">下降 {row.dropRate}%</Tag> : <Tag color="green">稳定</Tag>}
                </Space>
              )
            }
          ]}
        />
      </Card>

      {selectedPage ? (
        <Card
          style={{ marginTop: 12 }}
          title={`页面详情：${selectedPage.name}`}
          extra={
            <Space wrap>
              <Button
                onClick={() =>
                  navigate(
                    `/prompts?pageResourceId=${selectedPage.id}&action=create${
                      sharedTemplates[0]?.id ? `&templateRuleId=${sharedTemplates[0].id}` : ""
                    }${selectedScenes[0]?.id ? `&sceneId=${selectedScenes[0].id}` : ""}`
                  )
                }
              >
                新增提示规则
              </Button>
              <Button
                onClick={() =>
                  navigate(
                    `/jobs?pageResourceId=${selectedPage.id}&action=create&executionMode=${
                      selectedScenes[0]?.executionMode ?? "PREVIEW_THEN_EXECUTE"
                    }&sceneName=${encodeURIComponent(`${selectedPage.name}-自动化场景`)}`
                  )
                }
              >
                新增作业配置
              </Button>
              <Button
                onClick={() =>
                  navigate(
                    `/interfaces?ownerOrgId=${selectedPage.ownerOrgId}&action=create&useCase=${encodeURIComponent(
                      `${selectedPage.name}业务辅助查询`
                    )}`
                  )
                }
              >
                新建关联 API
              </Button>
              <Button
                onClick={() =>
                  navigate(`/page-resources?resourceId=${selectedPage.id}&action=fields`)
                }
              >
                字段维护
              </Button>
              <Button type="primary" onClick={() => navigate("/publish")}>
                去发布与灰度
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Alert
              type="info"
              showIcon
              message="推荐路径：先补提示规则、作业或 API，再进入“发布与灰度”完成上线。"
              description="发布完成后，再到“运行统计”确认触发情况和是否出现明显下降。"
            />
            <Card size="small" title="基本信息">
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="页面名称">{selectedPage.name}</Descriptions.Item>
                <Descriptions.Item label="页面编码">{selectedPage.pageCode}</Descriptions.Item>
                <Descriptions.Item label="iframe 标识">
                  {selectedPage.frameCode ?? <Typography.Text type="secondary">主页面</Typography.Text>}
                </Descriptions.Item>
                <Descriptions.Item label="所属专区">{selectedPage.regionName}</Descriptions.Item>
                <Descriptions.Item label="所属菜单">{selectedPage.menuName}</Descriptions.Item>
                <Descriptions.Item label="页面状态">{lifecycleLabelMap[selectedPage.status]}</Descriptions.Item>
                <Descriptions.Item label="最近更新">{selectedPage.updatedAt}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="启用范围">
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="覆盖机构">{getOrgLabel(selectedPage.ownerOrgId)}</Descriptions.Item>
                <Descriptions.Item label="页面是否启用">
                  {selectedPage.enabled ? <Tag color="green">启用</Tag> : <Tag color="default">关闭</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="提示规则">
                  {selectedPage.policy?.promptRuleSetName ?? <Typography.Text type="secondary">未配置</Typography.Text>}
                </Descriptions.Item>
                <Descriptions.Item label="作业预热策略">
                  {selectedPage.policy?.jobPreloadPolicy ?? <Typography.Text type="secondary">未配置</Typography.Text>}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="已开通能力">
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Space wrap>
                  <Tag color={selectedPage.hasPrompt ? "blue" : "default"}>
                    智能提示：{selectedRules.length > 0 ? `${selectedRules.length} 条规则` : "未开通"}
                  </Tag>
                  <Tag color={selectedPage.hasJob ? "purple" : "default"}>
                    智能作业：{selectedScenes.length > 0 ? `${selectedScenes.length} 个场景` : "未开通"}
                  </Tag>
                  <Tag color={selectedApis.length > 0 ? "cyan" : "default"}>
                    关联 API：{selectedApis.length} 个
                  </Tag>
                </Space>
                <Space size={[4, 4]} wrap>
                  {selectedRules.map((item) => (
                    <Tag key={item.id}>{item.name}</Tag>
                  ))}
                  {selectedRules.length === 0 ? <Typography.Text type="secondary">暂无提示规则</Typography.Text> : null}
                </Space>
              </Space>
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
          </Space>
        </Card>
      ) : null}
    </div>
  );
}
