import { Alert, Card, Tabs, Typography } from "antd";
import { PreprocessorsPage } from "../PreprocessorsPage/PreprocessorsPage";
import { RolesPage } from "../RolesPage/RolesPage";

export function AdvancedConfigPage() {
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
        description="建议先在发布与灰度页面确认试点机构和生效时间，再执行高风险改动。"
      />

      <Card>
        <Tabs
          destroyInactiveTabPane
          items={[
            { key: "preprocessors", label: "预处理器", children: <PreprocessorsPage embedded /> },
            { key: "roles", label: "权限治理", children: <RolesPage embedded /> },
            {
              key: "platform",
              label: "平台参数",
              children: (
                <Card size="small" title="平台级运行参数（示意）">
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    当前原型阶段先收口到统一入口，后续可按角色拆分为「高级识别参数」「接口高级配置」「底层运行参数」等分区。
                  </Typography.Paragraph>
                </Card>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}
