import { Button, Card, Divider, Input, Space, Typography, message } from "antd";
import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { prettyJson } from "../utils";

export function PluginSdkPage() {
  const [msgApi, holder] = message.useMessage();
  const exportPluginBundle = useAppStore((s) => s.exportPluginBundle);

  const bundleText = useMemo(() => prettyJson(exportPluginBundle()), [exportPluginBundle]);

  const sdkExample = `import { createPluginRuntime } from "@yxz/plugin-sdk";

const runtime = createPluginRuntime(CONFIG_BUNDLE);
runtime.onDomChange({
  context: { ip, person_id, org_id, menu_scope_id, is_new_employee },
  pageValues: collectPageValuesByXPath()
});`;

  return (
    <div>
      {holder}
      <Typography.Title level={4}>运行时配置包导出</Typography.Title>
      <Typography.Paragraph type="secondary">
        运行时由脚本 SDK 执行，管理端仅导出配置快照供 SDK 加载。
      </Typography.Paragraph>

      <Card title="当前发布配置包">
        <Space style={{ marginBottom: 8 }}>
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(bundleText);
              msgApi.success("配置包已复制。");
            }}
          >
            复制配置文本
          </Button>
        </Space>
        <Input.TextArea value={bundleText} rows={18} readOnly />
      </Card>

      <Divider />

      <Card title="脚本 SDK 接入示例">
        <Input.TextArea value={sdkExample} rows={8} readOnly />
      </Card>
    </div>
  );
}
