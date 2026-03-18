# 后端全量重构设计

> 日期：2026-03-18
> 适用范围：`config-center` 后端整体架构、模块迁移方式、`MyBatis-Plus` 持久化方案、资源权限与平台治理优先落地顺序

## 1. 背景

当前后端同时存在两套状态：

1. `backend/src/main/java` 已承载当前 Spring Boot + MyBatis 的主要实现。
2. `backend/apps/api-server` 与 `backend/packages/*` 已预留目标结构目录，但尚未成为正式运行架构。

当前状态带来的问题：

1. 架构目标与实际代码分离，目录语义和真实职责不一致。
2. 现有 `controller -> service -> mapper` 模式偏脚手架，公共能力和业务边界尚未收口。
3. 最新文档需求已经开始要求权限模型、平台治理等能力演进，但旧结构不利于持续迁移。
4. 若继续在旧结构中增量追加功能，后续再切到新架构的成本会越来越高。

因此，本次设计不再只做单模块补丁式调整，而是明确以后端新结构为唯一正式结构，采用分阶段方式完成整个 backend 的全量重构。

## 2. 目标

本次设计目标：

1. 以 `apps + packages` 作为后端唯一正式结构。
2. 彻底淘汰 `backend/src/main/java` 作为正式业务实现目录。
3. 引入 `MyBatis-Plus` 作为数据库访问主方案。
4. 统一公共基座，避免每个模块各自维护响应、异常、上下文、分页、审计逻辑。
5. 以分阶段迁移方式完成整个 backend 的重构，而不是一次性大爆炸。
6. 优先在新架构中落地：
   - 资源化权限
   - 平台级 JSSDK 版本治理
7. 后续将页面、接口、规则、发布、运行时模块全部迁入新结构。

## 3. 设计结论

### 3.1 总体原则

1. 新结构是唯一正式结构，不保留旧结构作为长期过渡主干。
2. 采用“分批迁移、每批可运行、每批可验证”的实施方式。
3. 新代码必须遵守清晰分层，而不是只更换目录位置。
4. 数据访问以 `MyBatis-Plus` 为主，复杂查询允许在基础设施层保留定制 SQL。
5. 资源权限与平台治理作为第二批业务迁移内容，优先验证新架构可行性。

### 3.2 目标目录结构

正式目标结构如下：

```text
backend/
  apps/
    api-server/
      src/main/java/...
      src/main/resources/...
  packages/
    domain-models/
      src/main/java/...
    application/
      src/main/java/...
    infrastructure-db/
      src/main/java/...
      src/main/resources/...
    infrastructure-cache/
      src/main/java/...
    infrastructure-mq/
      src/main/java/...
    test-kit/
      src/main/java/...
      src/test/java/...
```

`backend/src/main/java` 不再承担正式业务代码，迁移完成后删除。

### 3.3 构建策略

本次重构优先采用“单 Maven 工程 + 多源码目录”的方式，不立即拆分为 Maven reactor 多模块。

原因：

1. 先完成架构落地和业务迁移，比先拆构建系统更重要。
2. 能降低同时改造 Spring Boot、编译配置、模块边界的叠加风险。
3. 待架构稳定后，可再评估是否进一步升级为多模块构建。

## 4. 分层职责

### 4.1 `apps/api-server`

职责：

1. Spring Boot 启动类
2. Controller
3. HTTP 请求/响应 DTO
4. 参数校验
5. Spring 装配配置

限制：

1. 不直接依赖数据库 mapper
2. 不编写业务规则
3. 不承担多仓储聚合逻辑

### 4.2 `packages/domain-models`

职责：

1. 领域实体
2. 值对象
3. 枚举
4. 领域层仓储接口
5. 稳定的业务语义模型

限制：

1. 不引入 Spring 注解
2. 不引入 `MyBatis-Plus` 注解
3. 不耦合数据库字段细节

### 4.3 `packages/application`

职责：

1. 用例编排
2. 事务边界
3. 跨仓储聚合
4. 业务校验
5. 输出应用层 DTO

这里是主要业务入口。Controller 通过 application service 执行业务。

### 4.4 `packages/infrastructure-db`

职责：

1. 数据库 DO/PO
2. `MyBatis-Plus` mapper
3. 仓储实现
4. 自定义 SQL 查询
5. 数据持久化相关配置

限制：

1. 不承载接口层逻辑
2. 不暴露 `BaseMapper` 给 application 层

### 4.5 `packages/infrastructure-cache`

第一阶段只保留标准接入点，不提前构建复杂缓存逻辑。后续用于运行时快照、配置缓存等能力扩展。

### 4.6 `packages/infrastructure-mq`

第一阶段只保留标准接入点，后续用于发布流水线、异步通知、事件驱动扩展。

### 4.7 `packages/test-kit`

职责：

1. H2 测试基座
2. 集成测试引导
3. 测试数据构造器
4. 通用断言与测试辅助能力

## 5. `MyBatis-Plus` 使用方案

### 5.1 使用边界

`MyBatis-Plus` 只出现在 `infrastructure-db` 中：

1. DO/PO 使用 `@TableName`、`@TableId`、`@TableField`
2. Mapper 继承 `BaseMapper<T>`
3. 简单 CRUD 使用 `LambdaQueryWrapper`
4. 复杂聚合查询保留自定义 SQL

`domain-models` 与 `application` 不直接依赖 `MyBatis-Plus`。

### 5.2 查询策略

1. 简单增删改查：优先使用 `MyBatis-Plus`
2. 跨表但语义清晰的查询：封装成仓储方法
3. 复杂运行时聚合：由 application 层调用多个仓储组合完成

避免将完整业务决策塞进单条 SQL 或 mapper 中。

### 5.3 公共数据能力

重构后统一收口以下能力：

1. 审计字段：
   - `createdAt`
   - `createdBy`
   - `updatedAt`
   - `updatedBy`
   - `isDeleted`
2. 分页查询
3. 逻辑删除
4. 自动填充
5. H2 / MySQL 双环境兼容

## 6. 公共基座优先迁移项

在开始业务模块迁移前，先迁移以下公共能力：

1. `ApiResponse`
2. `PageResponse`
3. `BizException`
4. `GlobalExceptionHandler`
5. `RequestContext`
6. `RequestContextHolder`
7. `RequestContextFilter`
8. 数据源与 `MyBatis-Plus` 配置
9. 分页与查询基类
10. 测试启动与 H2 初始化基座

这样后续模块迁移可以共享统一规范，而不是边迁移边重复建设。

## 7. 分阶段迁移顺序

### 7.1 第一批：公共基座迁移

范围：

1. Spring Boot 启动入口迁到 `apps/api-server`
2. 公共响应、异常、上下文能力迁到新结构
3. `MyBatis-Plus` 配置接入
4. H2 / MySQL 配置与测试基座重建
5. 审计字段、分页能力、逻辑删除能力统一

阶段完成标准：

1. 应用能从新结构启动
2. 新结构已能承载后续业务模块
3. 旧公共实现不再作为正式入口

### 7.2 第二批：权限与治理模块迁移

范围：

1. 资源化权限模块
2. 平台级 JSSDK 版本治理模块

该批次的目标是用最新设计文档要求来验证新架构的可用性与稳定性。

#### 7.2.1 权限模块范围

包含：

1. 资源管理
2. 角色管理
3. 角色资源授权
4. 用户角色绑定
5. 当前会话判权快照

采用模型：

1. `PermissionResource`
2. `Role`
3. `RoleResourceGrant`
4. `UserRoleBinding`

后端正式废弃旧 `ActionType` 口径，不再兼容 `role.actions`。

推荐 API：

1. `GET /api/permissions/resources`
2. `POST /api/permissions/resources`
3. `PUT /api/permissions/resources/{id}`
4. `GET /api/permissions/roles`
5. `POST /api/permissions/roles`
6. `PUT /api/permissions/roles/{id}`
7. `GET /api/permissions/roles/{roleId}/resource-grants`
8. `PUT /api/permissions/roles/{roleId}/resource-grants`
9. `GET /api/permissions/roles/{roleId}/members`
10. `PUT /api/permissions/roles/{roleId}/members`
11. `GET /api/permissions/session/me`

会话判权链路统一为：

```text
RequestContext.userId -> 用户角色绑定 -> 有效角色 -> 角色资源授权 -> 资源集合
```

前端判权统一使用 `resourcePaths` 实现 `hasResource(resourcePath)`。

#### 7.2.2 平台治理模块范围

包含：

1. `PlatformRuntimeConfig`
2. `MenuSdkPolicy`

推荐 API：

1. `GET /api/governance/platform-runtime-config`
2. `PUT /api/governance/platform-runtime-config`
3. `GET /api/governance/menu-sdk-policies`
4. `POST /api/governance/menu-sdk-policies`
5. `PUT /api/governance/menu-sdk-policies/{id}`

平台治理的核心规则：

1. 正式版本由平台统一维护
2. 菜单级只允许灰度覆盖
3. 灰度按能力、菜单、机构、时间窗配置
4. 同菜单同能力同时间窗不允许存在冲突策略

### 7.3 第三批：配置控制主链路迁移

范围：

1. `page-resource`
2. `interface-registry`
3. `rule`
4. `publish`

该批迁移完成后，控制台主业务链路全部迁入新架构。

### 7.4 第四批：运行时与收尾迁移

范围：

1. `runtime/context`
2. `runtime/snapshot`
3. H2 seed 重建
4. README 更新
5. 旧 `backend/src/main/java` 删除
6. 旧 demo 数据路径清理

该批完成后，整个 backend 只保留新结构。

## 8. 模块级编码约束

### 8.1 禁止项

1. Controller 直接依赖 mapper
2. Application 直接依赖 `BaseMapper`
3. Domain model 引入 Spring 或 `MyBatis-Plus` 注解
4. 基础设施层承载 HTTP 协议细节
5. 继续把 demo 数据作为正式业务返回来源

### 8.2 推荐项

1. 每个业务接口对应清晰应用用例
2. 跨仓储聚合放在 application 层
3. 派生字段优先查询计算
4. Repository 暴露业务语义方法，而不是暴露表查询细节
5. 公共能力统一复用，不在模块内重复封装

## 9. 测试策略

### 9.1 第一层：应用层测试

重点覆盖：

1. 业务校验
2. 聚合逻辑
3. 授权覆盖写入
4. 会话资源快照构建
5. 平台治理规则校验

### 9.2 第二层：Controller 冒烟测试

重点验证：

1. 主要接口可访问
2. 参数校验正确
3. 错误响应结构一致

### 9.3 第三层：集成测试

基于 H2 执行：

1. repository 持久化验证
2. 查询组合验证
3. 关键迁移模块回归验证

## 10. 风险与控制

### 10.1 风险

1. 旧结构代码量已存在，迁移过程中容易出现新旧实现混杂。
2. 同时切换新结构与 `MyBatis-Plus`，会提升基础设施调整复杂度。
3. 前端已有部分页面仍依赖旧动作权限口径，需要与后端资源化权限同步切换。
4. 若不控制批次边界，重构会扩散为不可收敛的大范围返工。

### 10.2 控制措施

1. 严格按批次迁移，每批只处理明确模块范围。
2. 每批完成后都保证可启动、可测试、可联调。
3. 同一业务域一旦迁入新结构，旧实现立即淘汰。
4. 先迁公共基座，再迁业务模块，避免重复建设。

## 11. 非目标

本次设计不包含以下内容：

1. 立即拆分为 Maven 多模块 reactor 工程
2. 立即接入真实缓存中间件
3. 立即接入真实消息中间件
4. 前端全部页面在同一轮内完成 API 对接
5. 发布流水线、制品仓库、部署平台的额外工程化改造

## 12. 验收标准

完成本次重构设计后，应满足：

1. 新结构成为后端唯一正式实现结构。
2. `MyBatis-Plus` 在新基础设施层稳定运行。
3. 权限模块与平台治理模块能在新架构中优先落地。
4. 控制、运行时等剩余模块有清晰迁移顺序与收口规则。
5. 团队可在此设计基础上继续编写实现计划并分阶段执行。
