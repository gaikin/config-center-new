import { Alert, Card, Tabs, Typography } from "antd";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { RulesPage } from "../RulesPage/RulesPage";

export function PromptsPage() {
  const [searchParams] = useSearchParams();
  const pageResourceId = Number(searchParams.get("pageResourceId") ?? "");
  const templateRuleId = Number(searchParams.get("templateRuleId") ?? "");
  const sceneId = Number(searchParams.get("sceneId") ?? "");
  const action = searchParams.get("action");
  const hasPresetPage = Number.isFinite(pageResourceId) && pageResourceId > 0;
  const hasPresetTemplate = Number.isFinite(templateRuleId) && templateRuleId > 0;
  const hasPresetScene = Number.isFinite(sceneId) && sceneId > 0;
  const autoOpenCreate = action === "create";

  const tips = useMemo(() => {
    if (!hasPresetPage) {
      return null;
    }
    return `已从页面管理带入页面 ID：${pageResourceId}。`;
  }, [hasPresetPage, pageResourceId]);

  return (
    <div>
      <Typography.Title level={4}>智能提示</Typography.Title>
      <Typography.Paragraph type="secondary">
        规则列表是主入口；模板复用仅作快捷来源。新建流程按「选页面 → 改内容 → 预览 → 保存」推进，复杂逻辑放到高级条件。
      </Typography.Paragraph>

      {tips ? <Alert type="info" showIcon message={tips} style={{ marginBottom: 12 }} /> : null}

      <Card>
        <Tabs
          destroyInactiveTabPane
          items={[
            {
              key: "rules",
              label: "规则列表",
              children: (
                <RulesPage
                  embedded
                  mode="PAGE_RULE"
                  initialPageResourceId={hasPresetPage ? pageResourceId : undefined}
                  initialTemplateRuleId={hasPresetTemplate ? templateRuleId : undefined}
                  initialSceneId={hasPresetScene ? sceneId : undefined}
                  autoOpenCreate={autoOpenCreate}
                />
              )
            },
            {
              key: "templates",
              label: "模板复用",
              children: <RulesPage embedded mode="TEMPLATE" />
            }
          ]}
        />
      </Card>
    </div>
  );
}
