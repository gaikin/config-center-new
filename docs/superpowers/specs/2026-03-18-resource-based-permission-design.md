# 资源化权限模型设计

> 日期：2026-03-18
> 适用范围：`config-center` 前端原型中的权限模型、角色管理、会话判权、页面入口与按钮级权限控制

## 1. 背景

当前系统采用的是“动作枚举权限”模型：

1. 角色直接持有 `ActionType[]`
2. 用户通过角色继承动作权限
3. 页面和按钮通过 `hasAction()` 判权

当前模型的问题：

1. 菜单、页面、按钮不是统一资源，权限心智分裂。
2. 菜单入口和页面按钮无法用同一套模型授权。
3. 权限管理页只能配置动作点，无法表达“可见哪些菜单、可进哪些页面、可点哪些按钮”。
4. 后续若增加更多业务动作，`ActionType` 会持续膨胀。

本次设计目标是将菜单、页面、按钮、业务动作全部统一为资源，并以“角色分配资源、用户绑定角色”的方式完成权限模型切换。

## 2. 目标

本次设计目标：

1. 取消 `ActionType` 作为正式权限来源。
2. 建立统一资源模型，覆盖：
   - 菜单
   - 页面
   - 按钮
   - 业务动作
3. 权限链路统一为：
   `用户 -> 角色 -> 资源`
4. 前端判权统一为 `hasResource(resourcePath)`
5. 提供独立资源管理入口，维护资源定义。
6. 改造角色页，使其从“配置动作点”切换为“配置资源集合”。

## 3. 设计结论

### 3.1 总体原则

1. 所有菜单、页面、按钮、业务动作都统一资源化。
2. 不兼容旧的 `ActionType` 判权模型。
3. 角色不再直接持有动作权限，只持有资源集合。
4. 角色类型只保留为角色分类与推荐模板来源，不再直接决定权限。

### 3.2 模型形态

采用“平铺资源表 + 路径表达结构”的方案：

1. 资源表不使用树形 `parentId`。
2. 不额外维护 `moduleCode`、`groupCode` 之类的组织字段。
3. 通过 `resourcePath` 表达资源层级、归属与语义。

选择该方案的原因：

1. 模型更轻，数据结构简单。
2. 通过路径前缀仍可做分组、折叠、批量授权。
3. 适合当前前端原型快速落地。

## 4. 数据模型

### 4.1 资源定义

建议新增统一资源对象：`PermissionResource`

```ts
type ResourceType = "MENU" | "PAGE" | "ACTION";

type PermissionResource = {
  id: number;
  resourceCode: string;
  resourceName: string;
  resourceType: ResourceType;
  resourcePath: string;
  pagePath?: string;
  status: "ACTIVE" | "DISABLED";
  orderNo: number;
  description?: string;
  updatedAt: string;
};
```

字段说明：

1. `resourceCode`：资源编码，供内部引用。
2. `resourceName`：资源名称，供页面展示。
3. `resourceType`：资源类型，区分菜单、页面、动作。
4. `resourcePath`：资源路径，承载模块归属和业务语义。
5. `pagePath`：仅页面类资源可配置，对应路由路径。
6. `status`：资源状态。
7. `orderNo`：资源排序。

### 4.2 角色

角色对象保留基本信息，但移除 `actions`：

```ts
type RoleItem = {
  id: number;
  name: string;
  roleType: "CONFIG_OPERATOR" | "PERMISSION_ADMIN" | "TECH_SUPPORT";
  status: "ACTIVE" | "DISABLED";
  orgScopeId: string;
  memberCount: number;
  updatedAt: string;
};
```

### 4.3 角色资源授权

建议新增：`RoleResourceGrant`

```ts
type RoleResourceGrant = {
  id: number;
  roleId: number;
  resourceCode: string;
  createdAt: string;
};
```

角色通过该对象获得资源集合。

### 4.4 用户角色绑定

建议显式化用户与角色关系：`UserRoleBinding`

```ts
type UserRoleBinding = {
  id: number;
  userId: string;
  roleId: number;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
};
```

虽然当前原型已通过“角色成员”表达类似含义，但后续在模型语义上应收口为“用户绑定角色”。

## 5. 资源路径规范

### 5.1 路径总规则

`resourcePath` 采用固定前缀 + 业务域 + 具体语义的表达方式。

约束：

1. 使用英文短语。
2. 统一使用 kebab-case。
3. 用业务语义命名，不暴露实现细节。
4. 页面入口和动作资源必须分开。

### 5.2 菜单资源

格式：

```text
/menu/<domain>
```

示例：

```text
/menu/dashboard
/menu/page-management
/menu/prompts
/menu/jobs
/menu/interfaces
/menu/advanced-config
```

### 5.3 页面资源

格式：

```text
/page/<domain>/<view>
```

示例：

```text
/page/prompts/list
/page/prompts/editor
/page/jobs/list
/page/jobs/editor
/page/roles/list
/page/sdk-version-center/list
```

### 5.4 动作资源

格式：

```text
/action/<domain>/<scope>/<verb>
```

示例：

```text
/action/prompts/list/create
/action/prompts/editor/save
/action/prompts/editor/publish
/action/jobs/list/create
/action/jobs/editor/save
/action/page-management/detail/request-open
/action/roles/list/create
/action/roles/editor/assign-user
```

### 5.5 组织与展示方式

虽然底层是平铺资源表，但 UI 层应基于路径前缀做组织：

1. 按 `/menu/*`、`/page/*`、`/action/*` 分区。
2. 按业务域前缀聚合：
   - `/menu/prompts/*`
   - `/page/prompts/*`
   - `/action/prompts/*`
3. 支持按前缀批量勾选。

## 6. 授权规则

### 6.1 基本规则

菜单、页面、动作资源独立授权：

1. 拥有菜单资源，不代表自动拥有页面资源。
2. 拥有页面资源，不代表自动拥有动作资源。
3. 拥有动作资源，也不代表自动拥有页面资源。

### 6.2 前端判权规则

建议统一为：

```ts
hasResource(resourcePath: string): boolean
```

判权使用方式：

1. 菜单显示：检查 `/menu/...`
2. 页面访问：检查 `/page/...`
3. 按钮与业务动作：检查 `/action/...`

### 6.3 无权限时的表现

1. 无菜单资源：不展示导航入口。
2. 无页面资源：禁止进入页面或展示无权限提示。
3. 无动作资源：按钮隐藏或禁用。

### 6.4 不做自动继承

本次设计不做隐式继承：

1. 不做“拥有菜单即自动拥有页面”。
2. 不做“拥有页面即自动拥有按钮”。
3. 不做“角色类型自动拥有固定权限”。

原因：

1. 隐式规则后期难解释。
2. 容易产生误授权。
3. 不利于审计和排障。

### 6.5 推荐模板允许保留

虽然不做自动继承，但可以保留“推荐授权模板”能力：

1. 角色类型可对应一组推荐资源集合。
2. 用户可以一键填充后再手动调整。

这只是授权效率工具，不应成为真实权限来源。

## 7. 会话与前端改造

### 7.1 会话模型

当前 `useMockSession()` 聚合的是 `actions`。

改造后应改为聚合 `resourceCodes` 或 `resourcePaths`，并提供：

```ts
hasResource(resourcePath: string): boolean
```

### 7.2 全量移除旧判权

本次不保留旧的 `ActionType` 兼容层。

应直接下线：

1. `ActionType`
2. `RoleItem.actions`
3. `hasAction()`
4. 依赖动作枚举的默认权限逻辑

### 7.3 页面改造范围

至少包括：

1. 导航菜单渲染
2. 页面访问控制
3. 页面内主要按钮和业务动作
4. 角色管理页
5. 模拟登录与会话聚合逻辑

## 8. 资源管理页

建议新增独立页面：`资源管理`

### 8.1 页面职责

1. 维护资源定义
2. 查看资源路径
3. 管理资源状态
4. 提供角色授权页所需的可选资源清单

### 8.2 列表字段

建议字段：

1. 资源名称
2. 资源类型
3. 资源路径
4. 页面路由
5. 状态
6. 描述

### 8.3 筛选能力

建议支持按以下维度筛选：

1. 资源类型
2. 路径前缀
3. 关键词

### 8.4 辅助能力

建议增加：

1. 路径复制
2. 重复路径检测
3. 未被任何角色引用的资源提示
4. 按路径前缀折叠展示

### 8.5 管控原则

资源定义应尽量由平台侧或权限管理侧维护，不建议业务用户自由高频新增，否则路径规范会快速失控。

## 9. 角色管理页改造

### 9.1 页面结构

建议 `RolesPage` 调整为三块：

1. 角色基本信息
   - 角色名称
   - 角色类型
   - 组织范围
   - 状态
2. 资源授权
3. 成员绑定

### 9.2 资源授权交互

不建议只是简单多选。

建议支持：

1. 按资源类型分组
2. 按路径前缀折叠
3. 关键词搜索
4. 批量勾选同前缀资源
5. 查看已授权资源摘要

示例摘要：

1. 智能提示 8 项
2. 智能作业 6 项
3. 权限管理 3 项

### 9.3 推荐授权

保留“按角色类型填充推荐资源”，替代现在的“按角色类型重置默认权限”。

## 10. 约束与校验

### 10.1 资源定义约束

1. `resourcePath` 全局唯一。
2. `resourcePath` 必须符合前缀规范：
   - `/menu/...`
   - `/page/...`
   - `/action/...`
3. 资源类型与路径前缀必须一致。

### 10.2 权限模型约束

1. 角色不得直接持有动作枚举。
2. 页面和按钮判权只认资源。
3. 角色类型不再作为真实权限来源。

### 10.3 状态约束

1. 资源停用后，依赖该资源的入口和按钮应自动失效。
2. 角色停用后，用户通过该角色获得的资源自动失效。
3. 用户角色绑定停用后，该绑定不再生效。

## 11. 风险与规避

### 11.1 主要风险

1. 资源数量会快速增长。
2. 角色授权页可能因资源过多而难用。
3. 全量替换 `hasAction()` 会带来较大改造面。
4. 若资源维护职责过宽，路径会逐渐失控。

### 11.2 规避策略

1. 强制路径规范和唯一校验。
2. 新增独立资源管理页。
3. 角色授权页按前缀分组并支持批量勾选。
4. 统一封装 `hasResource()`，减少页面散落判权逻辑。

## 12. 非目标

本次设计不包含：

1. 树形资源继承模型。
2. 动作枚举兼容层。
3. 复杂的动态策略表达式权限。
4. 后端组织架构权限联动细节。

## 13. 验收标准

### 13.1 资源定义

1. 可维护菜单、页面、动作三类资源。
2. 资源路径可保存、回显、搜索。
3. 重复路径能被拦截。

### 13.2 角色授权

1. 角色可配置资源集合。
2. 角色页支持搜索、分组、批量勾选。
3. 用户可通过角色继承资源。

### 13.3 前端判权

1. 无菜单资源时不显示菜单入口。
2. 无页面资源时不可进入页面。
3. 无动作资源时按钮不可用。

### 13.4 旧模型下线

1. `ActionType` 不再作为正式权限来源。
2. `hasAction()` 不再用于页面与按钮判权。
3. 角色模型中不再保存 `actions`。

## 14. 推荐实施顺序

1. 新增资源模型、角色资源授权模型、用户角色绑定模型。
2. 建立资源管理页。
3. 改造角色页为资源授权模式。
4. 改造会话层为 `hasResource()`。
5. 替换菜单、页面、按钮判权逻辑。
6. 下线旧的 `ActionType` 与 `hasAction()`。
