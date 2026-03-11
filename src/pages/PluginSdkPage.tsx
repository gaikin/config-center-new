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
      <Typography.Title level={4}>Plugin SDK 交付</Typography.Title>
      <Typography.Paragraph type="secondary">
        运行时闭环由插件端负责。管理端仅导出配置快照，供插件 SDK 加载执行。
      </Typography.Paragraph>

      <Card title="配置快照（可供插件端加载）">
        <Space style={{ marginBottom: 8 }}>
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(bundleText);
              msgApi.success("配置快照已复制");
            }}
          >
            复制 JSON
          </Button>
        </Space>
        <Input.TextArea value={bundleText} rows={18} readOnly />
      </Card>

      <Divider />

      <Card title="插件端接入示例">
        <Input.TextArea value={sdkExample} rows={8} readOnly />
      </Card>
    </div>
  );
}
