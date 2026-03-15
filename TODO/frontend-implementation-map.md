# 前端实施落点清单

> 当前代码进展补充：
>
> - `src/types.ts`、`src/validation/formRules.ts`、`src/services/configCenterService.ts` 的统一错误模型与结构化返回已落地
> - `RulesPage`、`InterfacesPage`、`JobScenesPage` 已接入保存校验结果、编辑态问题提示与“保存后继续发布”承接提示
> - `PublishPage` 已接入“发布时自动校验”、结构化阻断展示、影响范围/风险项/批量结果汇总

## 1. 目标

将“智能提示校验分层改造”落实到具体前端文件，优先完成以下目标：

1. 配置页前移实时校验与保存校验提示。
2. 发布动作自动触发最终校验，弱化独立“校验按钮”流程感。
3. 前端统一错误模型，支持字段级、区域级、对象级阻断展示。
4. 保持配置流程与发布流程职责分离，但在交互上串成一条连续链路。

## 2. 总入口与共享层

### `src/App.tsx`

改动建议：

- [ ] 保持 `/prompts`、`/jobs`、`/interfaces`、`/publish` 四个主入口不变。
- [ ] 保持“配置页”和“发布页”分路由存在，不合并成单页。
- [ ] 若后续增加统一发布入口提示，可在路由层保留从配置完成跳转到 `/publish` 的承接能力。

### `src/validation/formRules.ts`

改动建议：

- [ ] 补齐路径、编码、名称、时间、JSON、数值范围等共享规则。
- [ ] 抽出“必填 + 格式 + 范围”通用规则，减少各页面内联重复校验。
- [ ] 为规则、作业、接口三个模块补可复用校验函数。

### `src/types.ts`

改动建议：

- [ ] 在现有 `ValidationItem` / `ValidationReport` 基础上补充更细粒度前端错误模型。
- [ ] 新增字段级、区域级、对象级错误结构，供保存失败与发布失败共用。
- [ ] 区分“保存校验结果”和“发布校验结果”，避免全都挤进同一个 `ValidationReport`。
- [ ] 为前端表单页预留 `blocking` / `warning` 两类结果。

建议新增类型：

- [ ] `FieldValidationIssue`
- [ ] `SectionValidationIssue`
- [ ] `ObjectValidationIssue`
- [ ] `SaveValidationReport`
- [ ] `PublishValidationReport`

### `src/services/configCenterService.ts`

改动建议：

- [ ] 从“页面内自己兜底校验”逐步收口到服务层返回结构化错误。
- [ ] 为保存动作补充结构化错误返回模型，而不是只抛字符串错误。
- [ ] 为发布动作补充“自动校验 + 返回阻断项”结果。
- [ ] 保留 `validatePendingItem`，但前端不再依赖用户手工先点它。
- [ ] `publishPendingItem` 返回可区分“发布成功 / 校验阻断 / 跳过风险项”的结果对象。

建议新增或调整的方法：

- [ ] `saveRuleDraft(...) -> { success, report }`
- [ ] `saveJobSceneDraft(...) -> { success, report }`
- [ ] `saveInterfaceDraft(...) -> { success, report }`
- [ ] `publishPendingItem(...) -> { success, report }`

## 3. 智能提示相关页面

### `src/pages/PromptsPage/PromptsPage.tsx`

改动建议：

- [ ] 保持“规则列表 / 模板复用”双 Tab，不调整信息架构。
- [ ] 从页面管理带参进入时，增加“当前为页面规则配置链路”的提示文案。
- [ ] 当规则保存后需要发布时，增加跳转发布页或提示“继续发布”的承接入口。

### `src/pages/RulesPage/RulesPage.tsx`

改动建议：

- [ ] 将“选页面 -> 改内容 -> 预览 -> 保存”继续作为主向导。
- [ ] 在步骤 1、2 中增加更完整的实时校验展示，不只依赖 `Form.Item rules`。
- [ ] 在“保存确认”步骤展示保存校验摘要，而不只是基础字段摘要。
- [ ] 高级条件抽屉中，为左右值、来源切换、接口出参路径、预处理器绑定增加局部即时校验。
- [ ] 对来源切换后的脏配置清理结果提供更明确提示。
- [ ] 若保存失败，弹窗中直接回显字段级/区域级错误，不只 toast。

重点改动区域：

- [ ] 规则基础表单
- [ ] 规则向导步骤切换逻辑
- [ ] 保存确认卡片
- [ ] 高级条件抽屉
- [ ] API 入参映射表格
- [ ] 预处理器绑定列表

### `src/pages/RulesPage/useRulesPageModel.tsx`

改动建议：

- [ ] 将 `submitRule()` 从“直接保存”改为“先聚合前端校验，再请求保存”。
- [ ] 将 `validateOperand()` 升级为可返回结构化错误集合，而不是只返回第一条字符串。
- [ ] 保存高级条件时，支持按条件编号、左右值、参数项精确定位错误。
- [ ] 增加规则保存后的 `SaveValidationReport` 状态。
- [ ] 为向导步骤增加 `canProceed` / `stepIssues` 之类的状态，支持跨步骤提示。

重点改动函数：

- [ ] `submitRule`
- [ ] `validateOperand`
- [ ] `saveConditionLogic`
- [ ] `changeSelectedSourceType`
- [ ] `updateInterfaceInputValue`

建议新增状态：

- [ ] `saveValidationReport`
- [ ] `logicValidationIssues`
- [ ] `wizardStepIssues`

### `src/pages/RulesPage/rulesPageShared.ts`

改动建议：

- [ ] 抽出条件编辑专用校验工具。
- [ ] 补来源切换、输出路径、入参映射、预处理器绑定的共享校验函数。
- [ ] 统一“空值”“脏配置”“未解析引用”的判定口径。

### `src/pages/RulesPage/rulesOperandRenderers.tsx`

改动建议：

- [ ] 为接口入参取值控件增加错误态渲染。
- [ ] 为选项缺失、引用失效、未绑定输出路径增加局部错误提示。

## 4. 智能作业相关页面

### `src/pages/JobScenesPage/JobScenesPage.tsx`

改动建议：

- [ ] 场景基础表单增加实时校验：页面资源、执行模式、人工基准时长、节点数。
- [ ] 在“校验与发布区”中展示更细的发布门禁摘要，而不是只显示风险确认状态。
- [ ] 预览确认弹窗中，将异常字段区分为“阻断写入”和“可忽略告警”。
- [ ] 若场景保存成功但未满足发布门禁，应明确提示“已保存草稿，尚不可发布”。

### `src/pages/JobScenesPage/useJobScenesPageModel.ts`

改动建议：

- [ ] `submitScene()` 改为支持保存校验结果回传。
- [ ] `openPreview()` / `executePreview()` 区分预览异常和发布阻断，不混用文案。
- [ ] 在场景编辑、节点编排、预览确认三处统一错误模型。
- [ ] 节点属性保存支持字段级错误提示，而不只 message 提示。

重点改动函数：

- [ ] `submitScene`
- [ ] `saveSelectedNode`
- [ ] `openPreview`
- [ ] `executePreview`

建议新增状态：

- [ ] `sceneSaveValidationReport`
- [ ] `nodeValidationIssues`
- [ ] `previewValidationIssues`

## 5. API 注册相关页面

### `src/pages/InterfacesPage/InterfacesPage.tsx`

改动建议：

- [ ] 五步向导继续保留，但第 2、3 步增加更完整的实时校验提示。
- [ ] 第 4 步“在线测试”与“保存校验”要明确区分：在线测试不是保存前唯一校验手段。
- [ ] 第 5 步“保存前确认”增加保存校验摘要，如路径、超时、重试、出参结构、必填入参完整性。
- [ ] 出参配置表格与对象属性弹窗增加字段级错误态。
- [ ] Body JSON / 返回 JSON 解析失败时，支持错误定位到具体区域。

### `src/pages/InterfacesPage/useInterfacesPageModel.tsx`

改动建议：

- [ ] `submit()` 改为返回结构化保存校验结果。
- [ ] `parseBodyTemplate()` / `parseOutputSample()` 增加解析失败详情，而不是只给通用错误文案。
- [ ] 输入参数和输出参数配置支持统一校验函数。
- [ ] 在线测试结果与保存校验结果分开存储。

重点改动函数：

- [ ] `submit`
- [ ] `parseBodyTemplate`
- [ ] `parseOutputSample`
- [ ] `openDebugDraft`
- [ ] `runDebug`

建议新增状态：

- [ ] `saveValidationReport`
- [ ] `inputValidationIssues`
- [ ] `outputValidationIssues`

## 6. 发布页面

### `src/pages/PublishPage/PublishPage.tsx`

改动建议：

- [ ] 保留发布页作为正式发布入口。
- [ ] 将“校验”按钮降级为可选查看动作，不再作为发布前必经步骤。
- [ ] `发布` 按钮点击后自动触发最终校验；若失败，直接弹出阻断项弹窗。
- [ ] 发布结果页/弹窗展示三类信息：阻断项、风险确认项、影响范围。
- [ ] 批量发布时，明确展示“已发布 / 被阻断 / 因风险确认缺失被跳过”的结果分类。

重点改动区域：

- [ ] 待发布列表操作列
- [ ] 单条发布逻辑
- [ ] 批量发布向导
- [ ] 发布前校验结果弹窗

建议调整交互：

- [ ] “校验通过并发布”改为“发布时自动校验”
- [ ] 保留“查看校验结果”作为辅助动作
- [ ] 批量发布完成后展示结果汇总而不是仅 toast

## 7. 名单数据页面

### `src/pages/ListDataPage/ListDataPage.tsx`

改动进展：

- [x] 名单编辑弹窗已改为“导入文件 -> 解析表头 -> 选择输出字段”的主路径
- [x] 导入字段已改成解析结果只读预览，不再允许业务手工录入
- [x] 输出字段已改成从解析表头中下拉多选，供规则 / 作业继续引用
- [x] 导入文件名变更后，已增加“必须重新解析表头后再保存”的门禁

后续建议：

- [ ] 将导入文件控件从文本输入升级为拟真上传控件
- [ ] 为解析结果补充字段属性展示，例如是否可检索 / 是否可输出
- [ ] 为重新解析导致的输出字段失效补充更显式的差异提示

### `src/services/configCenterService.ts`

改动进展：

- [x] 已补充名单导入预览方法，用于模拟文件解析后的表头和数据条数返回

后续建议：

- [ ] 将当前基于文件名推断的原型逻辑替换为更贴近真实返回结构的 mock 数据

### `src/validation/formRules.ts`

改动进展：

- [x] 已增加名单保存校验：输出字段必须来自解析表头

## 8. 推荐实施顺序

### P0

- [ ] 先补 `src/types.ts` 的统一错误模型
- [ ] 再补 `src/services/configCenterService.ts` 的结构化返回
- [ ] 然后改 `useRulesPageModel.tsx`
- [ ] 再改 `useInterfacesPageModel.tsx`
- [ ] 再改 `useJobScenesPageModel.ts`
- [ ] 最后改 `PublishPage.tsx`

### P1

- [ ] 补 `formRules.ts` 共享规则沉淀
- [ ] 优化 `RulesPage.tsx` / `InterfacesPage.tsx` / `JobScenesPage.tsx` 的错误展示
- [ ] 增加页面间“保存后继续发布”的承接提示

## 9. 验收检查

- [ ] 规则页在保存前能定位到条件级错误
- [ ] 场景页在保存前能定位到表单级和节点级错误
- [ ] API 注册页在保存前能定位到参数级和 JSON 结构错误
- [ ] 发布页点击“发布”后会自动触发最终校验
- [ ] 用户不需要先手工点“校验”才能发布
- [ ] 发布失败时能看到结构化阻断项，而不是只看到一条字符串报错
