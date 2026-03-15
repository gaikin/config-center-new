# 营小助配置中心 JSSDK 实施计划（Plan）

> 基线文档：  
> [../prd-analysis.md](../prd-analysis.md)（平台总纲）  
> [../architecture.md](../architecture.md)（总体架构）  
> [../api-design.md](../api-design.md)（运行面 API 设计）  
> [../jssdk-design.md](../jssdk-design.md)（JSSDK 专题设计）  
> [../sentinel-prd.md](../sentinel-prd.md)（智能提示专题）  
> [../job-prd.md](../job-prd.md)（智能作业专题）  
> [../decision-ledger.md](../decision-ledger.md)（已冻结决策）  
> 目标：将 JSSDK 从“设计完备但尚未工程化”的状态推进到“可独立构建、可最小运行、可按阶段扩展”的实施状态  
> 版本：V1.0-Draft  
> 更新日期：2026-03-14

## 1. 文档定位

本文只回答“JSSDK 现在如何开始做、先做什么、每一阶段交付什么、如何验收”的实施问题。

本文不替代：

1. `jssdk-design.md` 中对职责边界、运行模型、模块拆分和降级策略的完整设计。
2. `api-design.md` 中对运行面接口契约的正式定义。
3. `architecture.md` 中对 Admin Web / Backend / JSSDK 三端关系的总体说明。

本文的作用是把既有设计收敛成可执行工作包，供后续直接按阶段落地。

## 2. 当前状态判断

### 2.1 当前可开工结论

当前已具备启动 JSSDK 的文档前提，但尚不具备“一步做到完整生产版”的工程前提。

原因如下：

1. JSSDK 的职责、模块、生命周期、缓存、提示与作业链路已有较完整设计，可支撑工程拆解。
2. 运行面关键 API 已定义到可用于前后端并行的粒度。
3. 当前仓库仍以 Admin Web 原型为主，JSSDK 尚未形成独立包、独立构建链和独立调试入口。
4. Admin Web 侧的部分对象模型仍在收口，若不先冻结运行时契约，JSSDK 实现容易返工。

### 2.2 实施原则

1. 先做独立包，再做业务能力，不把 JSSDK 直接塞进当前 Admin 主包。
2. 先做最小可运行闭环，再逐步补作业、预览、缓存容灾和发布分发。
3. 先冻结运行时契约，再开始编码，避免“设计未冻、代码先飞”。
4. 规则坚持本地判定，不回退到高频后端判定接口。
5. 不引入自由脚本执行、`eval`、任意页面写值能力等违背既有设计边界的实现。

## 3. 目标与非目标

### 3.1 本计划目标

1. 在当前仓库内落地一个独立的 `packages/jssdk` 子包。
2. 形成 `loader/core/prompt/job/preview` 的分阶段实现路线，但只在前两阶段先交付 MVP 所需最小模块。
3. 先交付以下最小闭环：
   - 初始化
   - 页面识别
   - 运行时索引与快照拉取
   - 本地规则判定
   - 提示展示
   - 关闭/确认上报
   - 最小事件留痕
4. 为后续 `job`、`preview`、缓存回退、灰度版本解析和生产接入保留扩展位。

### 3.2 本计划非目标

1. 不在第一阶段交付完整生产级 CDN 发布体系。
2. 不在第一阶段解决跨域 iframe、复杂自定义组件、极端页面框架兼容。
3. 不在第一阶段交付完整作业编排执行器。
4. 不在第一阶段把 Admin Web 的全部模型问题一并修完。
5. 不将 JSSDK 做成浏览器自动化工具或页面脚本平台。

## 4. 实施范围

### 4.1 P0 范围（必须）

1. 建立 JSSDK 独立目录、包配置和构建脚本。
2. 冻结并落地 MVP 运行时类型：
   - `manifest`
   - `sdk-release-index`
   - `page-index`
   - `page-config`
   - `scene-config`（先定义类型，P0 可不完整消费）
3. 实现 `bootstrap / refresh / destroy / getStatus` 最小对外接口。
4. 实现页面解析、页面索引命中与页面快照拉取。
5. 实现字段基线采样与本地规则初次判定。
6. 实现最小 `prompt` 模块与提示关闭/确认链路。
7. 实现基础 telemetry 事件上报。
8. 提供本地 mock host 页面或最小接入示例，支撑联调前自测。

### 4.2 P1 范围（建议随后）

1. 增量重算与依赖索引。
2. 数据代理客户端与 TTL/in-flight 去重。
3. `job` 模块预热与执行实例承接。
4. `preview` 模块按需加载。
5. 持久缓存、ETag 校验和 fallback。
6. 更细粒度错误码、诊断事件和降级面板。

### 4.3 P2 范围（后续增强）

1. 菜单级版本槽位解析的完整线上形态。
2. 多 tab 缓存复用。
3. 复杂组件写值白名单扩展。
4. 更完整的 host integration harness。

## 5. 前置冻结项

进入编码前，以下事项必须先冻结；未冻结时只允许写类型草案和 mock，不进入稳定实现。

### 5.1 运行时契约冻结

1. `manifest` 字段集合与版本号策略。
2. `sdk-release-index` 的解析键、回退顺序和槽位字段。
3. `page-index` 的最小字段集合。
4. `page-config` 中 `pageFields`、`rules`、`watchFields`、`requiredModules` 的结构。
5. `scene-config` 中执行方式、预览模板、写入约束的最小字段。

### 5.2 模型冻结

1. 规则运行时模型采用单层条件结构或明确的编译后 AST/IR，不再直接复用当前 Admin 原型中的嵌套条件组存储。
2. 页面字段模型冻结：
   - `fieldScope`
   - `elementType`
   - `locator`
   - `readable/writable/watchable`
   - `extractor/normalizers`
3. 字段结果语义固定为 `ABSENT / EMPTY / VALUE`。
4. JSSDK 不消费脚本型预处理器，不执行 `js_script` 节点。

### 5.3 接入冻结

1. `authProvider` 返回值形态固定。
2. `pageContextProvider` 的字段边界固定。
3. 自动初始化与手工初始化的优先级固定。
4. 宿主页面注入配置 `window.__CC_SDK_CONFIG__` 的字段命名固定。

### 5.4 文档口径冻结

1. `architecture.md` 中“提交上下文判定请求”的旧口径需与“规则本地判定”统一。
2. `api-design.md` 中运行面不提供高频后端判定接口的口径作为正式实现基线。
3. 后续实现评审只以冻结后的专题文档和本计划为准，不再混用旧方案。

## 6. 工程落地策略

### 6.1 目录策略

当前建议在现仓库内新增：

```text
packages/
  jssdk/
    package.json
    tsconfig.json
    vite.config.ts
    src/
      index.ts
      loader/
      bootstrap/
      core/
      client/
      context/
      detect/
      bundle/
      engine/
      prompt/
      telemetry/
      cache/
      types/
      shared/
    demo/
```

### 6.2 构建策略

默认建议：

1. 继续复用 `TypeScript + Vite`，避免引入新的构建工具链。
2. 使用 library mode 或多入口构建，逐步产出：
   - `cc-sdk-loader.js`
   - `cc-sdk-core.js`
   - `cc-sdk-prompt.js`
   - `cc-sdk-job.js`
   - `cc-sdk-preview.js`
3. `core` 不依赖 React/Ant Design。
4. `prompt` 优先采用轻量 DOM 渲染，不把 Admin Web 的 UI 依赖带到宿主页。

### 6.3 与当前 Admin Web 的关系

1. 当前 Admin Web 继续负责控制面原型和 mock 数据。
2. JSSDK 作为独立子包开发，不复用 Admin 页面层代码。
3. 允许在 mock/service 层复用一部分运行时 JSON 样例，但不直接复用页面组件与状态管理。
4. 两端只通过“冻结后的运行时契约”和“示例快照”对齐。

## 7. 阶段计划

### 7.1 Phase 0：契约冻结与工程建模

目标：把 JSSDK 从“只有设计”推进到“可以稳定编码”的状态。

交付物：

1. JSSDK 运行时 JSON schema 草案。
2. 对外初始化接口与状态机类型定义。
3. 目录结构与构建方式定稿。
4. MVP 范围清单、非目标清单、验收清单。
5. 文档口径差异清单与修正文案。

退出条件：

1. 运行时契约字段冻结。
2. 初始化参数与宿主注入方式冻结。
3. 规则本地判定口径冻结。
4. 允许开始包结构和基础类型编码。

### 7.2 Phase 1：包骨架与最小宿主

目标：让 JSSDK 能被独立构建和初始化，但暂不要求完成业务闭环。

交付物：

1. `packages/jssdk` 子包骨架。
2. `bootstrap(config)`、`refresh()`、`destroy()`、`getStatus()` 接口。
3. 全局单例控制。
4. 最小 logger、错误边界和状态机。
5. demo host 页面和本地启动方式。

退出条件：

1. 子包可独立构建。
2. demo 页面可完成手工初始化。
3. 状态流转可观测。

### 7.3 Phase 2：页面识别与快照拉取

目标：让 SDK 能识别页面、命中索引并拿到可执行快照。

交付物：

1. `runtimeApiClient`
2. `page-context/resolve` 调用封装
3. `page-index` 拉取与命中判断
4. `page-config` 拉取
5. 基础 bundle cache 与 ETag 占位
6. 识别失败与拉取失败的降级态

退出条件：

1. 指定页面可稳定拿到 `page-config`。
2. 页面未命中时进入待机态，不误触发。
3. 网络失败时有明确日志和降级分支。

### 7.4 Phase 3：字段采样与本地规则引擎

目标：完成最小判定闭环。

交付物：

1. 页面字段读取器
2. `ABSENT / EMPTY / VALUE` 结果语义
3. 基线采样逻辑
4. 单层条件本地判定引擎
5. `INIT_ONCE`、`INIT_AND_REACTIVE`、`MANUAL_REFRESH` 三类基础运行策略
6. 首次命中去重与单会话一次触发限制

退出条件：

1. demo 页面可基于页面字段完成规则命中。
2. 未命中、字段缺失、字段空值可正确区分。
3. 不依赖后端高频判定接口。

### 7.5 Phase 4：提示模块与事件上报（MVP 完成）

目标：完成对业务可见的最小运行闭环。

交付物：

1. `prompt` 动态加载或最小占位模块
2. 静默提示 / 浮窗提示最小实现
3. 提示关闭与确认链路
4. `runtime/events` 批量上报
5. `PROMPT_SHOWN / PROMPT_CLOSED / PROMPT_CONFIRMED / RULE_MATCHED` 等基础事件
6. 页面切换、销毁、重复命中时的提示清理

退出条件：

1. 规则命中后可展示提示。
2. 关闭/确认会打点且不重复触发。
3. 页面销毁或切换后不会残留旧提示。

### 7.6 Phase 5：数据代理、增量重算与缓存增强

目标：提升真实可用性，准备接入更复杂规则。

交付物：

1. `data-proxy-client`
2. TTL、in-flight 去重、`stale-while-revalidate`
3. 字段依赖索引
4. 指定字段变化触发的增量重算
5. 去抖与串行判定队列
6. `BUNDLE_FALLBACK_USED` 等容灾事件

退出条件：

1. 高频字段变化不会引发全量重算风暴。
2. 数据代理具备最小缓存控制能力。
3. 具备基本网络波动容灾。

### 7.7 Phase 6：作业与预览承接

目标：从“智能提示 SDK”升级到“完整运行面 SDK”。

交付物：

1. `job` 模块预热与按需加载
2. `executions` 创建、查询、取消、重试封装
3. `preview` 模块按需加载
4. 预览确认页最小实现
5. 页面写值适配器最小白名单
6. 悬浮按钮二次触发

退出条件：

1. 至少一条作业链路可从提示确认进入执行。
2. 预览确认和手工回退路径可用。
3. 写值失败可感知、可留痕、可降级。

### 7.8 Phase 7：发布分发与生产化加固

目标：让 SDK 具备进入真实灰度环境的最低可运维能力。

交付物：

1. `loader -> manifest -> sdk-release-index -> core` 完整链路
2. 版本兼容校验
3. 资源 URL 版本化与缓存策略
4. 最近稳定快照回退
5. 构建产物清单与发布校验脚本
6. 接入文档与常见问题说明

退出条件：

1. 可按菜单灰度解析出目标版本。
2. 旧版本与新快照不兼容时可拒绝运行并留痕。
3. 具备最小发布回滚能力。

## 8. 工作分解（WBS）

### 8.1 WP-A 契约与类型层

任务：

1. 定义初始化配置类型。
2. 定义运行状态机类型。
3. 定义运行时 JSON schema。
4. 定义字段、规则、提示、事件、执行的核心类型。

产出：

1. `src/types/*`
2. schema 示例 JSON
3. mock fixture

### 8.2 WP-B 宿主与生命周期

任务：

1. 单例控制
2. 启动时序
3. `refresh/destroy`
4. 状态机与错误边界

产出：

1. `src/bootstrap/*`
2. `src/core/runtime.ts`

### 8.3 WP-C 页面识别与上下文采集

任务：

1. 宿主上下文读取
2. 页面识别优先级实现
3. DOM 稳定等待与防抖
4. 页面切换重建会话

产出：

1. `src/context/*`
2. `src/detect/*`

### 8.4 WP-D 快照与缓存

任务：

1. `manifest / release-index / page-index / page-config` 拉取
2. 内存缓存
3. ETag 占位
4. fallback 策略

产出：

1. `src/client/*`
2. `src/bundle/*`
3. `src/cache/*`

### 8.5 WP-E 规则引擎

任务：

1. 字段读取与归一化
2. 条件求值
3. 命中去重
4. 指定字段变化触发

产出：

1. `src/engine/*`
2. `src/shared/field-value.ts`

### 8.6 WP-F 提示与交互

任务：

1. 最小提示 UI
2. 关闭/确认交互
3. 提示队列
4. 页面销毁清理

产出：

1. `src/prompt/*`

### 8.7 WP-G 事件与诊断

任务：

1. 事件模型
2. 批量上报
3. 关键失败即时上报
4. debug 模式日志

产出：

1. `src/telemetry/*`

### 8.8 WP-H 作业与预览

任务：

1. 作业实例承接
2. 预览确认
3. 页面写值
4. 悬浮入口

产出：

1. `src/job/*`
2. `src/preview/*`
3. `src/io/*`

## 9. 建议 PR 拆分

为降低风险，建议按以下顺序提交：

1. PR-1：`packages/jssdk` 骨架、构建配置、公共类型、初始化接口
2. PR-2：页面识别、运行时 client、`page-index/page-config` 拉取
3. PR-3：字段采样、本地规则引擎、状态机联动
4. PR-4：提示模块、关闭/确认、telemetry 最小链路
5. PR-5：缓存、增量重算、数据代理、降级增强
6. PR-6：`job/preview`、页面写值、悬浮入口
7. PR-7：发布分发、版本兼容、接入文档、生产化脚本

每个 PR 必须满足：

1. 类型定义、实现代码、demo 示例同步更新。
2. 至少一个正向用例和一个失败/降级用例可验证。
3. 不引入对 Admin Web 页面层的直接依赖。

## 10. 验收口径

### 10.1 MVP 验收

1. 宿主页可通过自动或手工方式初始化 SDK。
2. SDK 可识别当前页面并命中 `page-index`。
3. SDK 可拉取 `page-config` 并建立字段基线。
4. SDK 可在本地完成至少一条规则的命中判定。
5. SDK 可展示提示并完成关闭/确认留痕。
6. 页面切换、字段缺失、接口失败时可降级，不阻断业务页面。

### 10.2 P1 验收

1. 指定字段变化可触发增量重算。
2. 数据代理具备最小缓存控制能力。
3. 快照可在短时失败时使用 fallback。
4. 关键运行事件可查询、可定位。

### 10.3 完整运行面验收

1. 作业可从提示确认或悬浮入口进入执行。
2. 预览确认链路可用。
3. 页面写值失败能给出明确原因并回退人工路径。
4. 版本灰度与资源分发链路可独立验证。

## 11. 主要风险与缓解

| 风险 | 影响 | 缓解措施 |
| --- | --- | --- |
| 运行时 schema 频繁变化 | 代码返工、前后端联调失真 | 先冻结 schema，再进入稳定编码 |
| 文档口径不一致 | 实现方向偏差 | Phase 0 先修正文档差异，统一以本计划和专题文档为准 |
| 直接复用 Admin 原型模型 | JSSDK 被原型历史包袱拖累 | 运行时模型单独定义，不直接复用页面层存储模型 |
| 引入重 UI 依赖 | 宿主页体积和耦合失控 | `core/prompt` 默认不依赖 React/Ant Design |
| 页面差异过大 | 识别和取值不稳定 | P0 先限制白名单页面与字段类型，逐步扩面 |
| 过早实现 job/preview | MVP 延迟 | 严格按阶段推进，先完成提示闭环 |
| 认证与宿主注入不明确 | 无法真实接入 | 先冻结 `authProvider` 与 `pageContextProvider` |

## 12. 启动清单（可直接执行）

1. 确认本计划作为 JSSDK 实施基线。
2. 补齐并冻结运行时 JSON schema 示例。
3. 补齐并冻结初始化参数与宿主注入字段。
4. 修正“本地判定 vs 提交判定请求”的文档口径差异。
5. 新建 `packages/jssdk` 目录与基础构建配置。
6. 准备至少 2 个 `page-config` mock：
   - 一个命中提示场景
   - 一个不命中/降级场景
7. 准备最小 demo host 页面，验证自动初始化与手工初始化。
8. 按 `PR-1 -> PR-4` 顺序推进 MVP，不提前进入 `job/preview`。

## 13. 第一批直接任务（建议本周执行）

1. 建立 `packages/jssdk` 子包。
2. 定义以下核心类型：
   - `ConfigCenterSdkInit`
   - `SdkStatus`
   - `PageIndexEntry`
   - `PageBundle`
   - `FieldValue`
   - `RuntimeEvent`
3. 定义 `runtimeApiClient` 接口草案。
4. 搭建 `bootstrap/config/status` 最小宿主。
5. 准备 `resolve -> page-index -> page-config` 的 mock 通路。
6. 完成一条“页面字段 > 规则命中 > 提示展示 > 关闭打点”的演示链路。

## 14. 完成定义（Definition of Done）

当以下条件全部满足时，视为 JSSDK MVP 阶段完成：

1. 有独立子包、独立构建和独立 demo。
2. 有冻结后的运行时类型与示例 JSON。
3. 有最小初始化、页面识别、快照拉取、本地规则判定、提示展示和事件上报链路。
4. 至少覆盖命中、未命中、字段缺失、页面切换、网络失败五类场景。
5. 不依赖后端高频判定接口，不执行任意脚本，不破坏业务页面主流程。
