﻿# 营小助配置中心架构设计

> 来源：`spec/config-center-product/prd-analysis.md`
> 用户规模：约 10,000
> 架构形态：服务端、前端配置、JSSDK 三端分离
> 部署形态：行内 Docker 部署（三项目独立）
> 更新日期：2026-03-11

## 1. 架构设计（10,000 用户规模，三端分离）

### 1.1 规模假设与设计目标
1. 服务对象约 10,000 内部用户，峰值并发按 8%-12% 估算（800-1,200 在线）。
2. 高峰请求以 JSSDK 规则判定与日志上报为主，配置端为中低并发。
3. 架构目标：控制面与运行面解耦，三端独立发布，日志与指标可观测，支持水平扩展。

### 1.2 三端分离逻辑
1. 前端配置端（Admin Web）：规则配置、接口配置、编排配置、发布生效范围、运营看板。
2. 服务端（Backend）：配置管理 API、运行时决策 API、编排执行、日志采集、指标聚合、权限鉴权。
3. JSSDK 端（Runtime SDK）：DOM 监听、规则触发、提示渲染、作业触发、预览交互、埋点回传。
4. 数据层：PostgreSQL（配置与事务数据）、Redis（缓存与频控）、对象存储（归档日志）、消息队列（异步日志/指标）。
5. 发布与部署：三项目独立构建、独立发布、独立回滚。

### 1.3 项目目录建议（三仓独立）

```text
config-center-backend/
  src/
    api/                          # controller / route / dto
    application/                  # 用例编排、事务边界
    domain/                       # 规则/编排/发布/权限领域模型
    infrastructure/               # db/cache/mq/外部接口适配
    modules/
      auth-rbac/
      config-center/
      runtime-decision/
      orchestration/
      log-ingest/
      metrics/
  migrations/
  scripts/
  Dockerfile

config-center-admin-web/
  src/
    pages/
    features/
      rule-designer/
      orchestration-designer/
      interface-config/
      publish-scope/
      template-center/
    shared/
    api-client/                   # 由 OpenAPI 生成
  nginx/
  Dockerfile

config-center-jssdk/
  src/
    context-collector/
    trigger-engine/
    rule-runtime/
    ui-renderer/
    job-runner/
    telemetry/
  dist/
  scripts/
  Dockerfile                      # 基于 TypeScript + Vite library mode 构建并发布静态资源容器
```

### 1.4 核心模块划分

### 1.4.0 前端技术栈基线（按当前 package.json）
1. 框架：`React 18` + `TypeScript` + `Vite 7`。
2. UI：`antd 5`。
3. 路由：`react-router-dom 6`。
4. 状态管理：`zustand 5`。
5. 样式方案：`styled-components 6`（与 antd 主题能力配合）。
6. 构建脚本：`vite` 开发，`tsc --noEmit && vite build` 生产构建。
7. 架构约束：配置端设计与实现需以上述技术栈为准，不引入平行框架。

### 1.4.1 服务端项目模块（单仓模块化，可按需拆分）
1. `auth-rbac-service`：统一认证、资源授权、发布与生效范围校验。
2. `config-service`：规则、接口子项、编排、模板、发布单管理（控制面）。
3. `runtime-decision-service`：运行时取值、条件计算、命中决策、触发顺序控制（运行面）。
4. `orchestration-service`：编排实例管理、节点串行执行、失败 `STOP`、预览快照生成。
5. `log-ingest-service`：事件日志、条件日志、参数日志、编排日志接入与脱敏。
6. `metrics-service`：按“自然日 + 业务菜单”聚合命中率、采纳率、注入成功率等指标。
7. `gateway-adapter`：限流、熔断、鉴权透传、TraceID 注入、灰度路由（可独立网关或内嵌入口层）。

### 1.4.2 前端配置端模块
1. 向导流引擎：创建规则 -> 绑定作业 -> 设置生效范围 -> 发布。
2. 规则设计器：条件表达式、OR/AND、预处理器链可视化配置。
3. 接口子项管理：状态流转、参数映射、发布前校验、引用关系查看。
4. 编排设计器：节点拖拽编排、输入输出映射、测试运行。
5. 模板中心：高频业务模板、示例、默认值快速填充。
6. 校验与帮助系统：实时校验、错误定位、修复建议。

### 1.4.3 JSSDK 模块
1. `context-collector`：页面上下文采集、菜单识别、角色信息读取。
2. `trigger-engine`：DOM 监听、防抖频控、去重。
3. `rule-runtime`：规则执行、命中判定、触发来源标记。
4. `ui-renderer`：提示弹窗、合窗、悬浮按钮、预览窗口。
5. `job-runner`：作业触发、编排调用、注入仲裁、一次性写入。
6. `telemetry`：埋点日志、链路追踪、异常上报。

### 1.5 数据模型设计（PostgreSQL 主模型）

### 1.5.1 主数据与权限域
| 表名 | 关键字段 | 说明 | 关键索引 |
| --- | --- | --- | --- |
| `user_account` | `id`, `employee_no`, `status` | 平台用户 | `employee_no` 唯一 |
| `role` | `id`, `role_code`, `scope_type` | 角色定义 | `role_code` 唯一 |
| `permission` | `id`, `resource`, `action` | 权限点 | `(resource,action)` 唯一 |
| `user_role_rel` | `user_id`, `role_id` | 用户角色关系 | `(user_id,role_id)` 唯一 |
| `role_permission_rel` | `role_id`, `permission_id` | 角色权限关系 | `(role_id,permission_id)` 唯一 |

### 1.5.2 配置域
| 表名 | 关键字段 | 说明 | 关键索引 |
| --- | --- | --- | --- |
| `rule` | `id`, `rule_code`, `category`, `status` | 规则主表 | `rule_code` 唯一 |
| `rule_version` | `id`, `rule_id`, `version_no`, `is_current` | 规则版本 | `(rule_id,version_no)` 唯一 |
| `rule_scope` | `rule_version_id`, `org_id`, `system_id`, `menu_id`, `role_id` | 生效范围 | `(rule_version_id,org_id,system_id,menu_id,role_id)` |
| `rule_condition` | `id`, `rule_version_id`, `left_source`, `op`, `right_source`, `logic_group` | 条件表达式 | `rule_version_id` |
| `rule_preprocessor` | `condition_id`, `side`, `processor_code`, `order_no` | 左右值预处理链 | `(condition_id,side,order_no)` |
| `smart_job` | `id`, `job_code`, `trigger_mode`, `preview_enabled` | 智能作业定义 | `job_code` 唯一 |
| `job_orchestration_binding` | `job_id`, `orchestration_id` | 一作业一编排 | `job_id` 唯一 |
| `orchestration` | `id`, `orchestration_code`, `status` | 编排定义 | `orchestration_code` 唯一 |
| `orchestration_node` | `id`, `orchestration_id`, `node_type`, `order_no`, `enabled` | 节点定义 | `(orchestration_id,order_no)` |
| `interface_config` | `id`, `interface_id`, `status`, `owner_id`, `version` | 接口子项 | `interface_id` 唯一 |
| `interface_param_mapping` | `interface_id`, `param_name`, `source_type`, `required`, `value_type` | 参数映射 | `(interface_id,param_name)` |
| `config_template` | `id`, `template_code`, `scene_type`, `status` | 高频模板 | `template_code` 唯一 |
| `publish_record` | `id`, `resource_type`, `resource_id`, `version_no`, `scope_snapshot`, `publisher_id` | 发布记录 | `(resource_type,resource_id,version_no)` |

### 1.5.3 运行域与日志域
| 表名 | 关键字段 | 说明 | 关键索引 |
| --- | --- | --- | --- |
| `orchestration_instance` | `id`, `job_id`, `orchestration_id`, `trigger_source`, `status` | 编排实例 | `(job_id,created_at)` |
| `orchestration_node_instance` | `instance_id`, `node_id`, `status`, `input_snapshot`, `output_snapshot` | 节点执行快照 | `(instance_id,node_id)` |
| `event_log` | `id`, `trace_id`, `event_type`, `menu_id`, `user_id`, `occurred_at` | 统一事件日志 | `(menu_id,occurred_at)`, `(trace_id)` |
| `condition_eval_log` | `trace_id`, `rule_version_id`, `condition_id`, `result`, `reason` | 条件判定日志 | `(rule_version_id,occurred_at)` |
| `api_call_log` | `trace_id`, `interface_id`, `request_masked`, `response_masked`, `status_code` | 接口调用日志 | `(interface_id,occurred_at)` |
| `metric_daily_menu` | `stat_date`, `menu_id`, `hit_cnt`, `adopt_cnt`, `inject_success_cnt` | 日聚合指标 | `(stat_date,menu_id)` 唯一 |

### 1.5.4 数据设计关键点
1. 所有配置实体采用“主表 + 版本表 + 发布记录”模式，避免覆盖式更新。
2. 日志表按时间分区（建议按日或按月），支持冷热分层迁移。
3. 所有表统一包含审计字段（强制要求），禁止例外。
4. `scope_snapshot` 使用 JSONB 存储发布时快照，保证可追溯。

### 1.5.5 审计字段规范（全表强制）
1. 适用范围：所有业务主表、关系表、日志表、统计表。
2. 强制字段：
 - `created_at`：创建时间（timestamp, not null）
 - `created_by`：创建人（varchar, not null）
 - `updated_at`：更新时间（timestamp, not null）
 - `updated_by`：更新人（varchar, not null）
3. 约束要求：
 - 禁止物理删除核心配置数据，默认采用软删除。
 - 更新操作必须同时更新 `updated_at/updated_by
4. 索引建议：
 - 高频查询表增加 `(updated_at)` 组合索引。
 - 关系表增加业务唯一键 + `is_deleted` 过滤索引，防止脏重复。

### 1.6 代码规范建议（全栈统一）

### 1.6.1 通用规范
1. 全仓 TypeScript，`strict=true`，禁止 `any`（仅白名单例外）。
2. API 契约先行：REST 使用 OpenAPI，事件使用 AsyncAPI；三仓通过契约版本号对齐。
3. 统一错误码：`{code, message, details, traceId}`，禁止直接抛裸字符串。
4. 日志标准字段：`traceId`, `spanId`, `userId`, `orgId`, `menuId`, `ruleVersion`, `latencyMs`。
5. 提交规范：Conventional Commits；分支建议 `feature/*`, `fix/*`, `refactor/*`。
6. 三仓发布版本建议：`backend`、`admin-web`、`jssdk` 分别独立语义化版本，禁止跨仓隐式依赖未发布变更。

### 1.6.2 服务端规范
1. 采用分层结构：`controller -> application -> domain -> infrastructure`。
2. 事务边界仅在 application 层定义，domain 层保持纯业务逻辑。
3. 配置变更必须走 migration，不允许手工改线上表结构。
4. 关键链路单测覆盖率建议 >= 80%，规则引擎与编排执行需有属性测试/边界测试。

### 1.6.3 前端配置端规范
1. 页面按领域划分目录，组件分为 `page`, `feature`, `shared` 三层。
2. 路由统一基于 `react-router-dom 6`，按业务域拆分路由与懒加载边界。
3. 状态管理默认使用 `zustand`，按领域拆分 store；禁止单一巨型全局 store。
4. 视觉与交互统一基于 `antd` 组件能力，页面定制样式使用 `styled-components`。
5. 表单校验采用 schema 驱动（如 Zod/Yup）并映射到 antd 字段错误态，支持字段级定位。
6. 关键交互埋点必须与后端指标口径一致（自然日 + 菜单维度）。

### 1.6.5 前端目录细化建议（React + Vite + antd）
```text
src/
  app/
    router/                       # react-router 路由入口与守卫
    providers/                    # 全局 Provider（主题、状态、鉴权）
  pages/                          # 页面容器
  features/                       # 业务特性模块（规则设计/接口配置/编排等）
  components/                     # 跨域复用组件
  stores/                         # zustand stores（按领域拆分）
  services/                       # API 请求封装与错误处理
  styles/                         # styled-components 主题与全局样式
  types/                          # 前端本地类型定义
  utils/                          # 工具函数
```

### 1.6.4 JSSDK 规范
1. SDK 对外 API 保持语义化版本管理，禁止破坏性变更直接发布。
2. DOM 操作必须幂等，重复触发必须遵循防抖与频控策略。
3. 页面注入前必须走冲突仲裁器，不允许直接覆盖人工值。
4. SDK 包体与运行时性能纳入 CI 门禁（体积、初始化耗时、长任务监控）。

### 1.7 行内 Docker 部署建议（三项目独立）
1. 镜像产物：
 - `config-center-backend:<version>`（后端 API 容器）
 - `config-center-admin-web:<version>`（Nginx 静态站点容器）
 - `config-center-jssdk:<version>`（Nginx 静态 SDK 资源容器）
2. 运行拓扑：
 - 入口层 Nginx/网关 -> `backend` 多副本容器（建议起步 3 副本）
 - `admin-web` 2 副本容器（静态资源）
 - `jssdk` 2 副本容器（内网静态分发）
 - PostgreSQL / Redis / MQ 使用行内统一中间件服务或独立容器集群
3. 伸缩策略（建议起步）：
 - backend：CPU > 60% 或 P95 超阈值触发扩容
 - admin-web / jssdk：按带宽与连接数扩容
4. 发布策略：
 - 三项目独立流水线，支持独立灰度与独立回滚
 - `jssdk` 必须保留最近 2 个稳定版本，业务系统可按版本锁定

### 1.8 你的落地顺序建议（全栈单人/小团队最优）
1. 先完成 `backend` 的 OpenAPI 契约和核心数据模型（规则/编排/发布）。
2. 再实现 `admin-web` 主流程（向导 + 发布生效范围），API 客户端由契约自动生成。
3. 第三步实现 `jssdk` 主链路并对接 `runtime-decision` 与 `orchestration` API。
4. 最后补齐日志采集、指标聚合、RBAC 细粒度控制，并做 10k 规模压测。
