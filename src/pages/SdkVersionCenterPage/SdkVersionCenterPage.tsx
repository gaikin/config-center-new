import { PlusOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { OrgSelect } from "../../components/DirectoryFields";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { getOrgLabel } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import { validateMenuSdkPolicy } from "../../sdkGovernance";
import type {
  LifecycleState,
  MenuCapabilityPolicy,
  MenuSdkPolicy,
  PageMenu,
  PageRegion,
  PageSite,
  PlatformRuntimeConfig,
  SdkArtifactVersion
} from "../../types";

type PolicyForm = Omit<MenuSdkPolicy, "id" | "updatedAt">;

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

function formatVersion(version: string | undefined) {
  return version?.trim() ? version : "-";
}

export function SdkVersionCenterPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<PageSite[]>([]);
  const [regions, setRegions] = useState<PageRegion[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [artifacts, setArtifacts] = useState<SdkArtifactVersion[]>([]);
  const [policies, setPolicies] = useState<MenuSdkPolicy[]>([]);
  const [menuCapabilities, setMenuCapabilities] = useState<MenuCapabilityPolicy[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformRuntimeConfig | null>(null);
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [focusedPolicyId, setFocusedPolicyId] = useState<number>();
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(6);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuSdkPolicy | null>(null);
  const [form] = Form.useForm<PolicyForm>();
  const [msgApi, holder] = message.useMessage();
  const autoOpenKeyRef = useRef("");

  const selectedSiteId = siteFilter === "ALL" ? undefined : Number(siteFilter);
  const selectedRegionId = regionFilter === "ALL" ? undefined : Number(regionFilter);

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
  const menuCapabilityMap = useMemo(
    () => Object.fromEntries(menuCapabilities.map((item) => [item.menuId, item])),
    [menuCapabilities]
  );
  const artifactVersionOptions = useMemo(
    () =>
      artifacts.map((artifact) => ({
        label: `${artifact.sdkVersion} (${lifecycleLabelMap[artifact.status]})`,
        value: artifact.sdkVersion
      })),
    [artifacts]
  );

  const filteredRegions = useMemo(() => {
    if (!selectedSiteId) {
      return regions;
    }
    return regions.filter((region) => region.siteId === selectedSiteId);
  }, [regions, selectedSiteId]);

  const filteredMenus = useMemo(() => {
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

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      if (selectedSiteId && policy.siteId !== selectedSiteId) {
        return false;
      }
      if (selectedRegionId && policy.regionId !== selectedRegionId) {
        return false;
      }
      return true;
    });
  }, [policies, selectedRegionId, selectedSiteId]);

  async function loadData() {
    setLoading(true);
    try {
      const [siteData, regionData, menuData, artifactData, policyData, capabilityData, runtimeConfig] = await Promise.all([
        configCenterService.listPageSites(),
        configCenterService.listPageRegions(),
        configCenterService.listPageMenus(),
        configCenterService.listSdkArtifactVersions(),
        configCenterService.listMenuSdkPolicies(),
        configCenterService.listMenuCapabilityPolicies(),
        configCenterService.getPlatformRuntimeConfig()
      ]);
      setSites(siteData);
      setRegions(regionData);
      setMenus(menuData);
      setArtifacts(artifactData);
      setPolicies(policyData);
      setMenuCapabilities(capabilityData);
      setPlatformConfig(runtimeConfig);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const siteId = searchParams.get("siteId");
    const regionId = searchParams.get("regionId");
    const menuIdRaw = searchParams.get("menuId");
    const action = searchParams.get("action");
    const menuId = menuIdRaw ? Number(menuIdRaw) : undefined;

    if (siteId) {
      setSiteFilter(siteId);
    }
    if (regionId) {
      setRegionFilter(regionId);
    }
    if (!menuId || Number.isNaN(menuId)) {
      setFocusedPolicyId(undefined);
      return;
    }
    const matchedPolicy = policies.find((policy) => policy.menuId === menuId);
    setFocusedPolicyId(matchedPolicy?.id);
    if (matchedPolicy && !siteId) {
      setSiteFilter(String(matchedPolicy.siteId));
    }
    if (matchedPolicy && !regionId) {
      setRegionFilter(String(matchedPolicy.regionId));
    }
    if (loading || action !== "edit") {
      return;
    }
    const autoOpenKey = `${action}:${menuId}`;
    if (autoOpenKeyRef.current === autoOpenKey) {
      return;
    }
    autoOpenKeyRef.current = autoOpenKey;
    if (matchedPolicy) {
      openEdit(matchedPolicy);
      msgApi.info("已定位到目标菜单，并打开灰度策略编辑弹窗");
      return;
    }
    const targetMenu = menus.find((menu) => menu.id === menuId);
    if (targetMenu) {
      openCreate(targetMenu);
      msgApi.info("目标菜单暂无策略，已打开新建弹窗并预填菜单");
    }
  }, [loading, menus, policies, searchParams]);

  useEffect(() => {
    if (!focusedPolicyId) {
      setTablePage(1);
      return;
    }
    const index = filteredPolicies.findIndex((item) => item.id === focusedPolicyId);
    if (index < 0) {
      return;
    }
    setTablePage(Math.floor(index / tablePageSize) + 1);
  }, [filteredPolicies, focusedPolicyId, tablePageSize]);

  function openCreate(targetMenu?: PageMenu) {
    const defaultMenu = targetMenu ?? filteredMenus[0] ?? menus[0];
    setEditing(null);
    form.setFieldsValue({
      siteId: defaultMenu?.siteId ?? sites[0]?.id ?? 0,
      regionId: defaultMenu?.regionId ?? regions[0]?.id ?? 0,
      menuId: defaultMenu?.id ?? 0,
      menuCode: defaultMenu?.menuCode ?? "",
      promptGrayEnabled: false,
      promptGrayVersion: platformConfig?.promptGrayDefaultVersion,
      promptGrayOrgIds: [],
      jobGrayEnabled: false,
      jobGrayVersion: platformConfig?.jobGrayDefaultVersion,
      jobGrayOrgIds: [],
      effectiveStart: "2026-03-14 09:00",
      effectiveEnd: "2026-12-31 23:59",
      status: "DRAFT",
      ownerOrgId: "head-office"
    });
    setOpen(true);
  }

  function openEdit(row: MenuSdkPolicy) {
    setEditing(row);
    form.setFieldsValue({
      siteId: row.siteId,
      regionId: row.regionId,
      menuId: row.menuId,
      menuCode: row.menuCode,
      promptGrayEnabled: row.promptGrayEnabled,
      promptGrayVersion: row.promptGrayVersion,
      promptGrayOrgIds: row.promptGrayOrgIds,
      jobGrayEnabled: row.jobGrayEnabled,
      jobGrayVersion: row.jobGrayVersion,
      jobGrayOrgIds: row.jobGrayOrgIds,
      effectiveStart: row.effectiveStart,
      effectiveEnd: row.effectiveEnd,
      status: row.status,
      ownerOrgId: row.ownerOrgId
    });
    setOpen(true);
  }

  async function submit() {
    if (!platformConfig) {
      msgApi.error("平台参数未加载完成，请稍后再试");
      return;
    }
    const values = await form.validateFields();
    const matchedMenu = menus.find((item) => item.id === values.menuId);
    const capability = menuCapabilityMap[values.menuId];
    const validation = validateMenuSdkPolicy({
      policy: values,
      platformConfig,
      capabilityStatus: capability
        ? {
            promptStatus: capability.promptStatus,
            jobStatus: capability.jobStatus
          }
        : undefined
    });
    if (!validation.ok) {
      msgApi.error(validation.errors.join("；") || "菜单灰度策略校验失败");
      return;
    }

    await configCenterService.upsertMenuSdkPolicy({
      ...values,
      menuCode: matchedMenu?.menuCode ?? editing?.menuCode ?? "",
      id: editing?.id ?? Date.now()
    });
    msgApi.success(editing ? "版本灰度策略已更新，已进入待发布列表" : "版本灰度策略已创建，已进入待发布列表");
    setOpen(false);
    await loadData();
  }

  const promptGrayPolicies = policies.filter((item) => item.promptGrayEnabled).length;
  const jobGrayPolicies = policies.filter((item) => item.jobGrayEnabled).length;

  return (
    <div>
      {holder}
      <Typography.Title level={4}>SDK版本中心</Typography.Title>
      <Typography.Paragraph type="secondary">
        维护平台默认版本与菜单能力灰度策略。平台参数负责默认值，菜单灰度只做按菜单与机构的覆盖。
      </Typography.Paragraph>

      <Space size={12} style={{ marginBottom: 16 }} wrap>
        <Tag color="blue">制品版本：{artifacts.length}</Tag>
        <Tag color="geekblue">策略总数：{policies.length}</Tag>
        <Tag color="orange">提示灰度菜单：{promptGrayPolicies}</Tag>
        <Tag color="purple">作业灰度菜单：{jobGrayPolicies}</Tag>
      </Space>

      <Card title="平台默认版本摘要" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4}>
          <Typography.Text>提示正式版本：{formatVersion(platformConfig?.promptStableVersion)}</Typography.Text>
          <Typography.Text type="secondary">提示默认灰度：{formatVersion(platformConfig?.promptGrayDefaultVersion)}</Typography.Text>
          <Typography.Text>作业正式版本：{formatVersion(platformConfig?.jobStableVersion)}</Typography.Text>
          <Typography.Text type="secondary">作业默认灰度：{formatVersion(platformConfig?.jobGrayDefaultVersion)}</Typography.Text>
        </Space>
      </Card>

      <Card title="版本清单" style={{ marginBottom: 16 }}>
        <Table<SdkArtifactVersion>
          rowKey="id"
          loading={loading}
          dataSource={artifacts}
          pagination={false}
          columns={[
            { title: "版本号", dataIndex: "sdkVersion", width: 140 },
            { title: "Loader", dataIndex: "loaderVersion", width: 100 },
            {
              title: "Manifest",
              dataIndex: "artifactManifestUrl",
              render: (value: string) => <Typography.Text code>{value}</Typography.Text>
            },
            { title: "兼容说明", dataIndex: "compatibility" },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
            }
          ]}
        />
      </Card>

      <Card
        title="菜单灰度策略"
        extra={
          <Space wrap>
            <Select
              style={{ width: 180 }}
              value={siteFilter}
              options={[
                { label: "全部站点", value: "ALL" },
                ...sites.map((site) => ({ label: site.name, value: String(site.id) }))
              ]}
              onChange={(value) => {
                setSiteFilter(value);
                setRegionFilter("ALL");
              }}
            />
            <Select
              style={{ width: 180 }}
              value={regionFilter}
              options={[
                { label: "全部专区", value: "ALL" },
                ...filteredRegions.map((region) => ({ label: region.regionName, value: String(region.id) }))
              ]}
              onChange={(value) => setRegionFilter(value)}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
              新建灰度策略
            </Button>
          </Space>
        }
      >
        <Table<MenuSdkPolicy>
          rowKey="id"
          loading={loading}
          dataSource={filteredPolicies}
          onRow={(row) =>
            row.id === focusedPolicyId
              ? {
                  style: { backgroundColor: "#fffbe6" }
                }
              : {}
          }
          pagination={{
            current: tablePage,
            pageSize: tablePageSize,
            showSizeChanger: true,
            pageSizeOptions: ["6", "10", "20"],
            onChange: (page) => setTablePage(page),
            onShowSizeChange: (_, size) => {
              const nextPage = size > 0 ? Math.max(1, Math.ceil(((tablePage - 1) * tablePageSize + 1) / size)) : 1;
              setTablePageSize(size);
              setTablePage(nextPage);
            }
          }}
          columns={[
            {
              title: "菜单",
              width: 220,
              render: (_, row) => (
                <Space size={6}>
                  <Typography.Text>{menuLabelMap[row.menuId] ?? "未识别菜单"}</Typography.Text>
                  {row.id === focusedPolicyId ? <Tag color="gold">定位目标</Tag> : null}
                </Space>
              )
            },
            {
              title: "提示灰度版本",
              width: 160,
              render: (_, row) =>
                row.promptGrayEnabled ? (
                  row.promptGrayVersion ?? "-"
                ) : (
                  <Typography.Text type="secondary">未开启</Typography.Text>
                )
            },
            {
              title: "提示灰度机构",
              width: 220,
              render: (_, row) =>
                row.promptGrayEnabled && row.promptGrayOrgIds.length > 0 ? (
                  <Space wrap>
                    {row.promptGrayOrgIds.map((orgId) => (
                      <Tag key={orgId}>{getOrgLabel(orgId)}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                )
            },
            {
              title: "作业灰度版本",
              width: 160,
              render: (_, row) =>
                row.jobGrayEnabled ? row.jobGrayVersion ?? "-" : <Typography.Text type="secondary">未开启</Typography.Text>
            },
            {
              title: "作业灰度机构",
              width: 220,
              render: (_, row) =>
                row.jobGrayEnabled && row.jobGrayOrgIds.length > 0 ? (
                  <Space wrap>
                    {row.jobGrayOrgIds.map((orgId) => (
                      <Tag key={orgId}>{getOrgLabel(orgId)}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                )
            },
            { title: "生效时间", width: 220, render: (_, row) => `${row.effectiveStart} ~ ${row.effectiveEnd}` },
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
        title={editing ? "编辑菜单灰度策略" : "新建菜单灰度策略"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="siteId" label="站点" rules={[{ required: true, message: "请选择站点" }]}>
            <Select
              options={sites.map((site) => ({ label: site.name, value: site.id }))}
              onChange={() => {
                form.setFieldValue("regionId", undefined);
                form.setFieldValue("menuId", undefined);
              }}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const currentSiteId = form.getFieldValue("siteId");
              const currentRegionId = form.getFieldValue("regionId");
              const currentMenuId = form.getFieldValue("menuId");
              const capability = menuCapabilityMap[currentMenuId];
              const regionOptions = regions
                .filter((region) => !currentSiteId || region.siteId === currentSiteId)
                .map((region) => ({ label: region.regionName, value: region.id }));
              const menuOptions = menus
                .filter((menu) => (!currentSiteId || menu.siteId === currentSiteId) && (!currentRegionId || menu.regionId === currentRegionId))
                .map((menu) => ({
                  label: `${regionLabelMap[menu.regionId] ?? "-"} / ${menu.menuName}`,
                  value: menu.id
                }));
              return (
                <>
                  <Form.Item name="regionId" label="专区" rules={[{ required: true, message: "请选择专区" }]}>
                    <Select options={regionOptions} />
                  </Form.Item>
                  <Form.Item name="menuId" label="菜单" rules={[{ required: true, message: "请选择菜单" }]}>
                    <Select
                      options={menuOptions}
                      onChange={(menuId) => {
                        const matched = menus.find((item) => item.id === menuId);
                        form.setFieldValue("menuCode", matched?.menuCode ?? "");
                      }}
                    />
                  </Form.Item>
                  <Space size={[6, 6]} wrap style={{ marginBottom: 8 }}>
                    <Tag color={capability?.promptStatus === "ENABLED" ? "green" : "default"}>
                      提示能力: {capability?.promptStatus === "ENABLED" ? "已开通" : capability?.promptStatus === "PENDING" ? "开通中" : "未开通"}
                    </Tag>
                    <Tag color={capability?.jobStatus === "ENABLED" ? "green" : "default"}>
                      作业能力: {capability?.jobStatus === "ENABLED" ? "已开通" : capability?.jobStatus === "PENDING" ? "开通中" : "未开通"}
                    </Tag>
                  </Space>
                </>
              );
            }}
          </Form.Item>
          <Form.Item name="menuCode" hidden>
            <Input />
          </Form.Item>

          <Card size="small" title="智能提示灰度" style={{ marginBottom: 12 }}>
            <Form.Item noStyle shouldUpdate>
              {() => {
                const menuId = form.getFieldValue("menuId");
                const capability = menuCapabilityMap[menuId];
                const promptCapabilityEnabled = capability?.promptStatus === "ENABLED";
                return (
                  <Form.Item
                    name="promptGrayEnabled"
                    label="开启提示灰度"
                    valuePropName="checked"
                    extra={promptCapabilityEnabled ? "开启后需配置灰度版本和灰度机构。" : "菜单提示能力未开通，暂不可配置提示灰度。"}
                  >
                    <Switch
                      disabled={!promptCapabilityEnabled}
                      onChange={(checked) => {
                        if (checked && !form.getFieldValue("promptGrayVersion")) {
                          form.setFieldValue("promptGrayVersion", platformConfig?.promptGrayDefaultVersion);
                        }
                        if (!checked) {
                          form.setFieldValue("promptGrayVersion", undefined);
                          form.setFieldValue("promptGrayOrgIds", []);
                        }
                      }}
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>
            <Form.Item noStyle shouldUpdate>
              {() => {
                const enabled = Boolean(form.getFieldValue("promptGrayEnabled"));
                return (
                  <>
                    <Form.Item
                      name="promptGrayVersion"
                      label="提示灰度版本"
                      rules={
                        enabled
                          ? [
                              { required: true, message: "请先选择提示灰度版本" },
                              () => ({
                                validator(_, value) {
                                  if (!value || !platformConfig || value !== platformConfig.promptStableVersion) {
                                    return Promise.resolve();
                                  }
                                  return Promise.reject(new Error("提示灰度版本不能与提示正式版本相同"));
                                }
                              })
                            ]
                          : []
                      }
                    >
                      <Select allowClear disabled={!enabled} options={artifactVersionOptions} />
                    </Form.Item>
                    <Form.Item
                      name="promptGrayOrgIds"
                      label="提示灰度机构"
                      rules={enabled ? [{ required: true, type: "array", min: 1, message: "请至少选择 1 个提示灰度机构" }] : []}
                    >
                      <OrgSelect mode="multiple" disabled={!enabled} placeholder="请选择提示灰度机构" />
                    </Form.Item>
                  </>
                );
              }}
            </Form.Item>
          </Card>

          <Card size="small" title="智能作业灰度" style={{ marginBottom: 12 }}>
            <Form.Item noStyle shouldUpdate>
              {() => {
                const menuId = form.getFieldValue("menuId");
                const capability = menuCapabilityMap[menuId];
                const jobCapabilityEnabled = capability?.jobStatus === "ENABLED";
                return (
                  <Form.Item
                    name="jobGrayEnabled"
                    label="开启作业灰度"
                    valuePropName="checked"
                    extra={jobCapabilityEnabled ? "开启后需配置灰度版本和灰度机构。" : "菜单作业能力未开通，暂不可配置作业灰度。"}
                  >
                    <Switch
                      disabled={!jobCapabilityEnabled}
                      onChange={(checked) => {
                        if (checked && !form.getFieldValue("jobGrayVersion")) {
                          form.setFieldValue("jobGrayVersion", platformConfig?.jobGrayDefaultVersion);
                        }
                        if (!checked) {
                          form.setFieldValue("jobGrayVersion", undefined);
                          form.setFieldValue("jobGrayOrgIds", []);
                        }
                      }}
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>
            <Form.Item noStyle shouldUpdate>
              {() => {
                const enabled = Boolean(form.getFieldValue("jobGrayEnabled"));
                return (
                  <>
                    <Form.Item
                      name="jobGrayVersion"
                      label="作业灰度版本"
                      rules={
                        enabled
                          ? [
                              { required: true, message: "请先选择作业灰度版本" },
                              () => ({
                                validator(_, value) {
                                  if (!value || !platformConfig || value !== platformConfig.jobStableVersion) {
                                    return Promise.resolve();
                                  }
                                  return Promise.reject(new Error("作业灰度版本不能与作业正式版本相同"));
                                }
                              })
                            ]
                          : []
                      }
                    >
                      <Select allowClear disabled={!enabled} options={artifactVersionOptions} />
                    </Form.Item>
                    <Form.Item
                      name="jobGrayOrgIds"
                      label="作业灰度机构"
                      rules={enabled ? [{ required: true, type: "array", min: 1, message: "请至少选择 1 个作业灰度机构" }] : []}
                    >
                      <OrgSelect mode="multiple" disabled={!enabled} placeholder="请选择作业灰度机构" />
                    </Form.Item>
                  </>
                );
              }}
            </Form.Item>
          </Card>

          <Form.Item name="effectiveStart" label="生效开始" rules={[{ required: true, message: "请输入开始时间" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="effectiveEnd"
            label="生效结束"
            rules={[
              { required: true, message: "请输入结束时间" },
              () => ({
                validator(_, value) {
                  const start = form.getFieldValue("effectiveStart");
                  if (!start || !value || start <= value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("生效结束时间不能早于开始时间"));
                }
              })
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="归属组织" rules={[{ required: true, message: "请选择归属组织" }]}>
            <OrgSelect />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={lifecycleOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
