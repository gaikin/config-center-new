import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { OrgSelect } from "../../components/DirectoryFields";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { getOrgLabel } from "../../orgOptions";
import { configCenterService } from "../../services/configCenterService";
import type {
  LifecycleState,
  MenuSdkPolicy,
  PageMenu,
  PageRegion,
  PageSite,
  SdkArtifactVersion,
  SdkReleaseLane
} from "../../types";

type PolicyForm = Omit<MenuSdkPolicy, "id" | "updatedAt" | "resolutionSummary">;

const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

export function SdkVersionCenterPage() {
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<PageSite[]>([]);
  const [regions, setRegions] = useState<PageRegion[]>([]);
  const [menus, setMenus] = useState<PageMenu[]>([]);
  const [artifacts, setArtifacts] = useState<SdkArtifactVersion[]>([]);
  const [lanes, setLanes] = useState<SdkReleaseLane[]>([]);
  const [policies, setPolicies] = useState<MenuSdkPolicy[]>([]);
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuSdkPolicy | null>(null);
  const [form] = Form.useForm<PolicyForm>();
  const [msgApi, holder] = message.useMessage();

  const selectedSiteId = siteFilter === "ALL" ? undefined : Number(siteFilter);
  const selectedRegionId = regionFilter === "ALL" ? undefined : Number(regionFilter);

  const regionLabelMap = useMemo(
    () => Object.fromEntries(regions.map((region) => [region.id, region.regionName])),
    [regions]
  );
  const laneLabelMap = useMemo(
    () => Object.fromEntries(lanes.map((lane) => [lane.id, `${lane.laneName} (${lane.sdkVersion})`])),
    [lanes]
  );
  const menuLabelMap = useMemo(
    () =>
      Object.fromEntries(
        menus.map((menu) => [menu.id, `${regionLabelMap[menu.regionId] ?? "-"} / ${menu.menuName}`])
      ),
    [menus, regionLabelMap]
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
      const [siteData, regionData, menuData, artifactData, laneData, policyData] = await Promise.all([
        configCenterService.listPageSites(),
        configCenterService.listPageRegions(),
        configCenterService.listPageMenus(),
        configCenterService.listSdkArtifactVersions(),
        configCenterService.listSdkReleaseLanes(),
        configCenterService.listMenuSdkPolicies()
      ]);
      setSites(siteData);
      setRegions(regionData);
      setMenus(menuData);
      setArtifacts(artifactData);
      setLanes(laneData);
      setPolicies(policyData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function openCreate() {
    const defaultMenu = filteredMenus[0] ?? menus[0];
    setEditing(null);
    form.setFieldsValue({
      siteId: defaultMenu?.siteId ?? sites[0]?.id ?? 0,
      regionId: defaultMenu?.regionId ?? regions[0]?.id ?? 0,
      menuId: defaultMenu?.id ?? 0,
      menuCode: defaultMenu?.menuCode ?? "",
      stableLaneId: lanes.find((lane) => lane.laneCode === "stable")?.id ?? lanes[0]?.id ?? 0,
      grayLaneId: lanes.find((lane) => lane.laneCode === "gray-a")?.id,
      grayOrgIds: [],
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
      stableLaneId: row.stableLaneId,
      grayLaneId: row.grayLaneId,
      grayOrgIds: row.grayOrgIds,
      effectiveStart: row.effectiveStart,
      effectiveEnd: row.effectiveEnd,
      status: row.status,
      ownerOrgId: row.ownerOrgId
    });
    setOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    const matchedMenu = menus.find((item) => item.id === values.menuId);
    await configCenterService.upsertMenuSdkPolicy({
      ...values,
      menuCode: matchedMenu?.menuCode ?? editing?.menuCode ?? "",
      id: editing?.id ?? Date.now()
    });
    msgApi.success(editing ? "版本灰度策略已更新，已进入待发布列表" : "版本灰度策略已创建，已进入待发布列表");
    setOpen(false);
    await loadData();
  }

  const draftArtifacts = artifacts.filter((item) => item.status === "DRAFT").length;
  const grayPolicies = policies.filter((item) => item.grayOrgIds.length > 0).length;

  return (
    <div>
      {holder}
      <Typography.Title level={4}>版本灰度策略（高级）</Typography.Title>
      <Typography.Paragraph type="secondary">
        这是高级维护区，用来维护菜单层级的版本灰度范围。业务侧通常在各业务页面完成发布，不需要单独进入发布页。
      </Typography.Paragraph>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        当前原型只保留三个业务可理解的信息：当前线上版本、试点版本、影响机构范围。
      </Typography.Paragraph>

      <Space size={12} style={{ marginBottom: 16 }} wrap>
        <Tag color="blue">制品版本：{artifacts.length}</Tag>
        <Tag color="purple">发布通道：{lanes.length}</Tag>
        <Tag color="geekblue">版本策略：{policies.length}</Tag>
        <Tag color="orange">待灰度菜单：{grayPolicies}</Tag>
        <Tag color="red">待发布制品：{draftArtifacts}</Tag>
      </Space>

      <Card title="版本清单" style={{ marginBottom: 16 }}>
        <Table<SdkArtifactVersion>
          rowKey="id"
          loading={loading}
          dataSource={artifacts}
          pagination={false}
          columns={[
            { title: "版本号", dataIndex: "sdkVersion", width: 120 },
            { title: "Loader", dataIndex: "loaderVersion", width: 100 },
            { title: "Manifest", dataIndex: "artifactManifestUrl", render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
            { title: "兼容说明", dataIndex: "compatibility" },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
            }
          ]}
        />
      </Card>

      <Card title="发布通道" style={{ marginBottom: 16 }}>
        <Table<SdkReleaseLane>
          rowKey="id"
          loading={loading}
          dataSource={lanes}
          pagination={false}
          columns={[
            { title: "通道", dataIndex: "laneName", width: 140 },
            { title: "指向版本", dataIndex: "sdkVersion", width: 160 },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
            },
            { title: "更新时间", dataIndex: "updatedAt", width: 180 }
          ]}
        />
      </Card>

      <Card
        title="菜单版本灰度策略"
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建版本策略
            </Button>
          </Space>
        }
      >
        <Table<MenuSdkPolicy>
          rowKey="id"
          loading={loading}
          dataSource={filteredPolicies}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            {
              title: "菜单",
              width: 220,
              render: (_, row) => menuLabelMap[row.menuId] ?? "未识别菜单"
            },
            {
              title: "线上版本",
              width: 160,
              render: (_, row) => laneLabelMap[row.stableLaneId] ?? row.stableLaneId
            },
            {
              title: "试点版本",
              width: 160,
              render: (_, row) =>
                row.grayLaneId ? laneLabelMap[row.grayLaneId] ?? row.grayLaneId : <Typography.Text type="secondary">-</Typography.Text>
            },
            {
              title: "灰度机构",
              width: 220,
              render: (_, row) =>
                row.grayOrgIds.length > 0 ? (
                  <Space wrap>
                    {row.grayOrgIds.map((orgId) => (
                      <Tag key={orgId}>{getOrgLabel(orgId)}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">全部机构走线上版本</Typography.Text>
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
        title={editing ? "编辑版本灰度策略" : "新建版本灰度策略"}
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
                </>
              );
            }}
          </Form.Item>
          <Form.Item name="menuCode" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="stableLaneId" label="线上版本" rules={[{ required: true, message: "请选择线上版本" }]}>
            <Select options={lanes.map((lane) => ({ label: `${lane.laneName} (${lane.sdkVersion})`, value: lane.id }))} />
          </Form.Item>
          <Form.Item name="grayLaneId" label="试点版本">
            <Select allowClear options={lanes.map((lane) => ({ label: `${lane.laneName} (${lane.sdkVersion})`, value: lane.id }))} />
          </Form.Item>
          <Form.Item name="grayOrgIds" label="灰度机构">
            <OrgSelect mode="multiple" placeholder="未选择则全部机构走线上版本" />
          </Form.Item>
          <Form.Item name="effectiveStart" label="生效开始" rules={[{ required: true, message: "请输入开始时间" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="effectiveEnd" label="生效结束" rules={[{ required: true, message: "请输入结束时间" }]}>
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

