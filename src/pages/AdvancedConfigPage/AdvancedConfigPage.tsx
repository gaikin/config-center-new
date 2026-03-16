import { Alert, Card, Tabs, Typography } from "antd";
import { useSearchParams } from "react-router-dom";
import { ListDataPage } from "../ListDataPage/ListDataPage";
import { PreprocessorsPage } from "../PreprocessorsPage/PreprocessorsPage";
import { PublicFieldsPage } from "../PublicFieldsPage/PublicFieldsPage";
import { RolesPage } from "../RolesPage/RolesPage";
import { useMockSession } from "../../session/mockSession";

export function AdvancedConfigPage() {
  const { hasAction } = useMockSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const canConfig = hasAction("CONFIG");
  const canManageRoles = hasAction("ROLE_MANAGE");

  const tabItems = [
    ...(canConfig ? [{ key: "preprocessors", label: "数据转换", children: <PreprocessorsPage embedded /> }] : []),
    ...(canConfig ? [{ key: "list-data", label: "名单数据", children: <ListDataPage embedded /> }] : []),
    ...(canConfig ? [{ key: "public-fields", label: "公共字段", children: <PublicFieldsPage embedded /> }] : []),
    ...(canManageRoles ? [{ key: "roles", label: "权限管理", children: <RolesPage embedded /> }] : []),
    ...(canConfig
      ? [
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
        ]
      : [])
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
