# 配置中心项目设计思想、架构现状与 AI Agent 推进规划（落地版）

> 更新时间：2026-03-13  
> 适用仓库：`config-center-admin-web`（当前工作区）  
> 文档目的：基于“现有代码 + 现有产品文档”形成一份可执行的统一说明，用于后续 AI Agent 协同研发与治理。

## 0. 信息来源

本文件基于以下内容整理：

1. 代码：`src/`、`docs/`、`.github/PULL_REQUEST_TEMPLATE.md`
2. 产品/架构文档：`spec/config-center-product/architecture.md`、`plan.md`、`prd-analysis.md`、`sentinel-prd.md`、`job-prd.md`、`permission-model.md`、`decision-ledger.md`、`api-design.md`
3. 现有 AI 规划草案：`spec/config-center-product/ai-agent-plan.md`

---

## 1. 项目设计思想（Design Philosophy）

### 1.1 核心定位

配置中心不是单点“提示工具”，而是统一的“提示 + 作业 + 治理”平台，目标是打通：

`页面资源 -> 规则触发 -> 提示引导 -> 作业执行 -> 治理审计`

### 1.2 核心原则

1. 业务角色优先：主用户和主治理者是业务角色，技术角色聚焦平台支持。
2. 治理先行：P0 先保证发布前校验、版本替换、审计留痕，再扩展复杂能力。
3. 对象解耦协同：规则回答“何时触发”，作业回答“触发后做什么”，分开建模和治理。
4. 公共底座复用：页面资源、API 注册、预处理器作为统一底座，避免能力散落。
5. 异常可降级：运行失败时必须可回退人工路径，不能阻断业务主流程。
6. 决策可追溯：以 `decision-ledger.md` 作为口径收敛中心，需求和实现必须挂接决策条目。

### 1.3 平台边界

1. 不替代业务系统原生审批流。
2. 不以内置“完整联调测试平台”作为 P0 承诺。
3. 不依赖运行时冲突仲裁作为主防线（冲突应发布前解决）。
4. 不追求高自由脚本平台化，脚本仅作为受控增强。

---

## 2. 当前架构现状（As-Is）

### 2.1 目标架构（文档层）

根据 `architecture.md`，目标为：

1. 三端分离：Admin Web / Backend / JSSDK
2. 三平面解耦：控制面 / 运行面 / 治理面
3. 三能力层协同：公共支撑层 / 智能提示层 / 智能作业层

### 2.2 当前实现架构（代码层）

当前仓库是 **Admin Web 前端原型**，核心特征：

1. 技术栈：React 18 + TypeScript 5 + Vite 7 + antd 5 + styled-components 6 + react-router 6
2. 页面路由完整：总览、页面资源、API 注册、预处理器、规则、作业、治理、审计指标、角色
3. 服务层为内存 Mock：
   - `src/services/configCenterService.ts`
   - `src/services/workflowService.ts`
4. 数据基线由 `src/mock/seeds.ts` 提供
5. `src/store/` 与 `src/runtime/` 目录已预留但暂无实现文件
6. 项目依赖已引入 `zustand`，但当前代码中尚未使用

### 2.3 领域模型与模块映射

统一模型集中在 `src/types.ts`，覆盖：

1. 公共支撑：`PageResource` / `PageElement` / `InterfaceDefinition` / `PreprocessorDefinition`
2. 提示规则：`RuleDefinition` / `RuleConditionGroup` / `RuleCondition`
3. 作业执行：`JobSceneDefinition` / `JobNodeDefinition` / `JobExecutionSummary`
4. 治理审计：`GovernancePendingItem` / `ValidationReport` / `GovernanceAuditLog`
5. 运行观测：`TriggerLogItem` / `ExecutionLogItem` / `FailureReasonMetric`
6. 权限角色：`RoleItem` + `ActionType`

### 2.4 关键行为链路（已在原型中打通）

1. 配置变更进入待处理队列（pending items）。
2. 治理工作台执行校验、发布、延期、回滚、风险确认。
3. 发布前校验覆盖规则冲突、自动执行风险确认、接口超时重试范围等关键口径。
4. 作业支持节点编排、预览确认、手动二次触发、失败回退模拟。
5. 审计与指标页面可查看触发日志、执行日志、失败原因分布。

### 2.5 现状与目标的差距（Gap）

1. 后端与运行面未落地：当前运行逻辑和治理逻辑仍在前端 Mock 层。
2. JSSDK 未接入：页面现场识别与真实注入链路尚未实现。
3. 自动化门禁不足：目前以人工验证为主，未形成系统化 CI 校验链。
4. 文档-代码一致性仍需机器化：依赖人工对齐，漏改风险仍存在。
5. 口径需进一步收敛：规则条件在数据层可见“父子组”，UI 以单层全局逻辑为主，需持续对齐产品口径。

---

## 3. 面向 AI Agent 的下一步规划（To-Be）

### 3.1 目标定位

AI Agent 不替代业务决策，而是承担三件事：

1. 守门：保证跨模块一致性和发布质量底线。
2. 提效：降低重复劳动（文档对齐、联动改造、验收清单生成）。
3. 留痕：让每次变更可追溯、可复盘。

### 3.2 Agent 角色分工（建议最小集）

1. `Decision-Trace Agent`  
   负责需求与 `decision-ledger.md` 的映射，输出受影响模块清单。
2. `Schema-Consistency Agent`  
   检查 `types.ts`、页面表单、service payload、mock 结构的一致性。
3. `Implementation Agent`  
   在已确认口径下完成代码改造（页面 + service + mock 联动）。
4. `Validation Agent`  
   执行构建、关键检索、核心链路 smoke，输出风险报告。
5. `Release-Guard Agent`  
   按 `docs/dev-checklist.md` 和 PR 模板生成发布前检查结果。

### 3.3 标准工作流（需求到发布）

1. 输入需求与目标范围。
2. 绑定决策台账条目（若无则先补决策）。
3. 产出“联动影响面清单”（文档/类型/页面/service/mock）。
4. 执行改造并自动生成变更摘要。
5. 执行门禁校验并产出结构化报告。
6. PR 模板回填校验结果与风险回滚说明。

### 3.4 强制门禁（必须自动执行）

围绕 `docs/dev-checklist.md` 固化 5 项检查：

1. 对象模型是否补齐（types + 数据结构）。
2. 配置 UI 是否全链路覆盖（不是只改一个页面）。
3. 保存与回显结构是否一致（payload + service + mock）。
4. 运行解析是否可识别（预览/执行路径可达）。
5. 验收是否覆盖 5 类场景（可配置/可保存/可回显/可执行/异常阻断）。

### 3.5 路线图（按 3 个阶段推进）

1. Phase A（先守门，1-2 周）  
   完成文档对齐检查 + 构建检查 + 关键字段检索自动化。
2. Phase B（再提效，2-4 周）  
   让 Agent 支持“类型-页面-service-mock”联动修改建议与半自动修复。
3. Phase C（后闭环，4 周+）  
   建立需求到发布的 Agent 流水线与变更审计索引。

### 3.6 近期可执行任务清单（建议立即启动）

1. 新增 `docs/ai-agent-workflow.md`：定义输入、输出、门禁、失败回退模板。
2. 新增 `scripts/consistency-check.ps1`：自动执行关键字段联动检索。
3. 新增 `scripts/pr-gate.ps1`：串联 `rg` 检索 + `npm run build` + 结果汇总。
4. 补充最小 smoke 脚本：覆盖“规则保存->治理校验->发布->日志可见”主链路。
5. 在 PR 模板增加固定区块：`Decision Link`、`Agent Summary`、`Gate Report`。
6. 建立“决策条目 -> 代码模块”索引文档，降低后续改动漏项。

### 3.7 度量指标（建议纳入周报）

1. 联动漏改率（发布前发现的跨模块漏改数）。
2. 需求到可验证版本耗时（从需求确认到可构建通过）。
3. 构建一次通过率。
4. 发布前阻断命中率（拦截的问题是否前移）。
5. 文档-代码一致性缺陷数（每周）。

### 3.8 主要风险与控制

1. 风险：Agent 只改 UI 不改模型。  
   控制：强制执行“五项联动检查”。
2. 风险：文档口径漂移。  
   控制：所有改动必须绑定 `decision-ledger` 条目。
3. 风险：自动改造引入隐性回归。  
   控制：构建门禁 + smoke + 人工抽检。
4. 风险：脚本能力过度放开。  
   控制：脚本类变更必须进入治理审计路径。

---

## 4. 结论

当前项目已具备清晰的产品总纲、较完整的前端原型骨架和治理闭环雏形。下一步引入 AI Agent 的最佳策略是：

1. 先把“检查与对齐”做硬（守门）。
2. 再扩大到“联动改造”提效（提效）。
3. 最后形成“需求-实现-验证-留痕”的标准闭环（运营化）。

该策略可在不牺牲可控性的前提下，持续提高交付速度与质量稳定性。

