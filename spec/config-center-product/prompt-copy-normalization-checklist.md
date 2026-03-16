# 页面提示性话语扫描与术语归一清单（待确认）

## 1. 扫描范围与结果

1. 扫描范围：`src/pages/**`、`src/components/**`
2. 关键词：`建议/提醒/请先/可继续/可前往/下一步/上线/说明/当前/阻断/确认` 等提示性话语
3. 命中总量：`351` 条
4. 高密度页面（Top 10）：
   - `src/pages/PublishPage/PublishPage.tsx`（47）
   - `src/pages/JobScenesPage/JobScenesPage.tsx`（44）
   - `src/pages/RulesPage/RulesPage.tsx`（42）
   - `src/pages/PageManagementPage/PageManagementPage.tsx`（30）
   - `src/pages/PageResourcesPage/PageResourcesPage.tsx`（28）
   - `src/pages/ListDataPage/ListDataPage.tsx`（23）
   - `src/pages/InterfacesPage/InterfacesPage.tsx`（23）
   - `src/pages/JobScenesPage/useJobScenesPageModel.ts`（16）
   - `src/pages/RulesPage/useRulesPageModel.tsx`（13）
   - `src/pages/SdkVersionCenterPage/SdkVersionCenterPage.tsx`（12）

> 全量命中明细见：`tmp_prompt_copy_scan.txt`

## 2. 术语归一规则（建议）

1. 禁用过渡期引导词：`建议`、`推荐`、`下一步`（仅保留在步骤按钮如“下一步”）。
2. 强制动作用语：
   - 前置条件：`请先...`
   - 可选动作：`可...`
   - 结果承接：`保存后可前往“发布与灰度”`
3. 统一发布相关词：
   - `上线` -> `发布生效`
   - `完成上线` -> `完成发布`
4. 统一风险提示分级：
   - `阻断`：不可继续
   - `待处理`：可继续但建议后续处理
   - 避免混用 `提醒建议处理`
5. 统一说明类表头：
   - 表格优先用 `说明` 或 `描述`，避免同页混用
6. 统一状态主语：
   - 菜单/页面状态优先使用 `已开通/待开通/开通中`
   - 避免 `处理中/可直接配置/需申请开通` 等过渡命名

## 3. 高优先待清洗文案（建议改写）

1. `src/components/PublishContinuationAlert.tsx:30`
   - 当前：`当前配置已进入待发布列表，建议继续完成发布与灰度。`
   - 建议：`当前配置已进入待发布列表，可前往“发布与灰度”完成发布。`
2. `src/components/ValidationReportPanel.tsx:63`
   - 当前：`有 X 个提醒建议处理`
   - 建议：`有 X 个待处理项（不阻断继续）`
3. `src/components/ValidationReportPanel.tsx:109`
   - 当前：`处理建议：...`
   - 建议：`处理方式：...`
4. `src/pages/DashboardPage/DashboardPage.tsx:116`
   - 当前：`建议复核规则和发布变更`
   - 建议：`请复核规则与发布变更`
5. `src/pages/InterfacesPage/InterfacesPage.tsx:500`
   - 当前：`建议保存前先执行一次在线测试`
   - 建议：`保存前请执行一次在线测试`
6. `src/pages/InterfacesPage/useInterfacesPageModel.tsx:384`
   - 当前：`另有 X 个提醒可继续处理`
   - 建议：`另有 X 个待处理项，可继续后续发布`
7. `src/pages/JobScenesPage/JobScenesPage.tsx:153`
   - 当前：`...保存后可继续到“发布与灰度”完成上线。`
   - 建议：`...保存后可前往“发布与灰度”完成发布。`
8. `src/pages/JobScenesPage/JobScenesPage.tsx:290`
   - 当前：`...保存后可继续到“发布与灰度”上线。`
   - 建议：`...保存后可前往“发布与灰度”发布生效。`
9. `src/pages/JobScenesPage/JobScenesPage.tsx:604`
   - 当前：`有异常字段，建议先取消勾选再执行。`
   - 建议：`有异常字段，请先取消勾选后再执行。`
10. `src/pages/JobScenesPage/useJobScenesPageModel.ts:317`
    - 当前：`建议先取消勾选异常字段，再执行写入。`
    - 建议：`请先取消勾选异常字段，再执行写入。`
11. `src/pages/PromptsPage/PromptsPage.tsx:31`
    - 当前：`...保存后继续到“发布与灰度”完成上线。`
    - 建议：`...保存后可前往“发布与灰度”完成发布。`
12. `src/pages/RulesPage/useRulesPageModel.tsx:429`
    - 当前：`另有 X 个提醒可继续处理`
    - 建议：`另有 X 个待处理项，可继续后续发布`
13. `src/pages/PublishPage/PublishPage.tsx:864`
    - 当前：`下一步`（发布向导按钮）
    - 建议：保留（步骤按钮例外）
14. `src/pages/PublishPage/PublishPage.tsx:744`
    - 当前：`检查通过，可继续正式发布`
    - 建议：`检查通过，可执行正式发布`
15. `src/pages/AdvancedConfigPage/AdvancedConfigPage.tsx:29`
    - 当前：`建议先在发布与灰度页面确认...`
    - 建议：`请先在“发布与灰度”确认...`

## 4. 待你确认的落地策略

1. 仅清洗“建议/推荐/上线/提醒建议处理”等高风险词（低风险最小改动）。
2. 同时统一全站“提醒”分级（`阻断` / `待处理`）并同步组件文案。
3. 一次性全量替换（覆盖所有页面，改动最大）。
