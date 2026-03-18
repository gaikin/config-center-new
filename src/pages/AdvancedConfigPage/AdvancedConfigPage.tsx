import { Alert, Button, Card, Form, Select, Space, Tabs, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ListDataPage } from "../ListDataPage/ListDataPage";
import { PreprocessorsPage } from "../PreprocessorsPage/PreprocessorsPage";
import { PublicFieldsPage } from "../PublicFieldsPage/PublicFieldsPage";
import { useMockSession } from "../../session/mockSession";
import { configCenterService } from "../../services/configCenterService";
import type { PlatformRuntimeConfig, SdkArtifactVersion } from "../../types";

type RuntimeConfigForm = Pick<
  PlatformRuntimeConfig,
  "promptStableVersion" | "promptGrayDefaultVersion" | "jobStableVersion" | "jobGrayDefaultVersion"
>;

function PlatformRuntimeConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [artifacts, setArtifacts] = useState<SdkArtifactVersion[]>([]);
  const [form] = Form.useForm<RuntimeConfigForm>();
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const [artifactRows, runtimeConfig] = await Promise.all([
        configCenterService.listSdkArtifactVersions(),
        configCenterService.getPlatformRuntimeConfig()
      ]);
      setArtifacts(artifactRows);
      form.setFieldsValue({
        promptStableVersion: runtimeConfig.promptStableVersion,
        promptGrayDefaultVersion: runtimeConfig.promptGrayDefaultVersion,
        jobStableVersion: runtimeConfig.jobStableVersion,
        jobGrayDefaultVersion: runtimeConfig.jobGrayDefaultVersion
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit() {
    const values = await form.validateFields();
    await configCenterService.updatePlatformRuntimeConfig({
      ...values,
      updatedBy: "person-platform-admin"
    });
    msgApi.success("平台参数已保存");
    await loadData();
  }

  const versionOptions = artifacts.map((artifact) => ({
    label: `${artifact.sdkVersion} (${artifact.notes})`,
    value: artifact.sdkVersion
  }));

  return (
    <Card size="small" title="平台级运行参数">
      {holder}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="正式版本是全平台默认口径，默认灰度版本只用于新建菜单灰度时自动带入。"
      />
      <Form form={form} layout="vertical" disabled={loading}>
        <Card size="small" title="智能提示" style={{ marginBottom: 12 }}>
          <Form.Item
            name="promptStableVersion"
            label="正式版本"
            rules={[{ required: true, message: "请选择智能提示正式版本（必填）" }]}
          >
            <Select showSearch optionFilterProp="label" options={versionOptions} />
          </Form.Item>
          <Form.Item
            name="promptGrayDefaultVersion"
            label="默认灰度版本"
            rules={[
              () => ({
                validator(_, value) {
                  const stableVersion = form.getFieldValue("promptStableVersion");
                  if (!value || !stableVersion || value !== stableVersion) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("默认灰度版本建议与正式版本不同，避免配置时误选"));
                }
              })
            ]}
          >
            <Select allowClear showSearch optionFilterProp="label" options={versionOptions} />
          </Form.Item>
        </Card>

        <Card size="small" title="智能作业" style={{ marginBottom: 12 }}>
          <Form.Item
            name="jobStableVersion"
            label="正式版本"
            rules={[{ required: true, message: "请选择智能作业正式版本（必填）" }]}
          >
            <Select showSearch optionFilterProp="label" options={versionOptions} />
          </Form.Item>
          <Form.Item
            name="jobGrayDefaultVersion"
            label="默认灰度版本"
            rules={[
              () => ({
                validator(_, value) {
                  const stableVersion = form.getFieldValue("jobStableVersion");
                  if (!value || !stableVersion || value !== stableVersion) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("默认灰度版本建议与正式版本不同，避免配置时误选"));
                }
              })
            ]}
          >
            <Select allowClear showSearch optionFilterProp="label" options={versionOptions} />
          </Form.Item>
        </Card>
      </Form>

      <Space>
        <Button type="primary" loading={loading} onClick={() => void handleSubmit()}>
          保存平台参数
        </Button>
      </Space>
    </Card>
  );
}

export function AdvancedConfigPage() {
  const { hasResource } = useMockSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const canConfig = hasResource("/action/common/base/config");

  const tabItems = [
    ...(canConfig ? [{ key: "preprocessors", label: "数据转换", children: <PreprocessorsPage embedded /> }] : []),
    ...(canConfig ? [{ key: "list-data", label: "名单数据", children: <ListDataPage embedded /> }] : []),
    ...(canConfig ? [{ key: "public-fields", label: "公共字段", children: <PublicFieldsPage embedded /> }] : []),
    ...(canConfig ? [{ key: "platform", label: "平台参数", children: <PlatformRuntimeConfigPanel /> }] : [])
  ];

  const activeTab = (() => {
    if (tabItems.length === 0) {
      return "";
    }
    const picked = searchParams.get("tab");
    if (picked && tabItems.some((item) => item.key === picked)) {
      return picked;
    }
    return tabItems[0].key;
  })();

  return (
    <div>
      <Typography.Title level={4}>高级配置</Typography.Title>
      <Typography.Paragraph type="secondary">
        收纳低频复杂能力，默认按角色后置展示。业务人员主路径不需要先进入本页面。
      </Typography.Paragraph>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="修改高级配置前请确认影响范围"
        description="请先确认生效机构和发布时间，再执行高风险改动。"
      />

      {tabItems.length > 0 ? (
        <Card>
          <Tabs
            activeKey={activeTab}
            destroyInactiveTabPane
            onChange={(key) => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set("tab", key);
              setSearchParams(nextParams);
            }}
            items={tabItems}
          />
        </Card>
      ) : (
        <Alert showIcon type="info" message="当前身份暂无可访问的高级配置项" />
      )}
    </div>
  );
}
