# 配置中心后端实施计划（Spring Boot + MyBatis）

> 文档定位：当前仓库 `backend/` 工程的实施基线  
> 技术栈：`Spring Boot` + `MyBatis` + `MySQL`（默认 `H2` 本地模拟）  
> 架构要求：三层结构，统一采用 `controller -> service -> mapper`  
> 更新日期：2026-03-14

## 1. 目标

1. 在现有前端原型基础上落地一套可联调、可扩展的 Java 后端工程。
2. 首版按模块化单体实现控制面、运行面、治理面，不提前拆微服务。
3. 所有模块统一遵循三层结构：接口入口在 `controller`，业务编排在 `service`，数据库访问在 `mapper`。
4. 数据库生产基线使用 `MySQL`，本地开发默认使用 `H2` 模拟，表设计对齐 `spec/config-center-product/tdsql-ddl-draft.md` 的对象模型。
5. 先打通最小链路：`页面资源 -> 规则 -> 发布校验 -> 页面识别 -> 运行时快照 -> 治理查询`。

## 2. 工程结构

```text
backend/
  pom.xml
  db/
    migrations/
  src/
    main/
      java/
        com/configcenter/backend/
          common/
          module/
            control/
            runtime/
            governance/
      resources/
        application.yml
```

三层结构约束：

1. `controller`：处理 HTTP 入参、调用 service、返回统一响应。
2. `service`：承接业务逻辑、事务编排、发布校验、快照装配。
3. `mapper`：通过 MyBatis 访问 MySQL，不写业务判断。

## 3. 模块划分

### 3.1 控制面

1. `page-resource`：页面资源、站点、菜单、版本。
2. `interfaceapi`：API 注册、版本、参数结构。
3. `rule`：规则、版本、预览。
4. `publish`：发布校验、发布任务。

### 3.2 运行面

1. `context`：页面识别与上下文解析。
2. `snapshot`：页面快照包读取。

### 3.3 治理面

1. `governance`：待处理摘要、审计日志、触发日志、执行日志、指标总览。

## 4. 阶段目标

### Phase 0

1. 初始化 Spring Boot 工程、Maven 依赖、全局异常处理、请求上下文过滤器。
2. 配置 MyBatis 包扫描、MySQL 连接参数、统一响应结构。
3. 产出首批 MySQL 建表脚本，并补齐 H2 初始化脚本用于本地模拟。

### Phase 1

1. 完成控制面核心模块骨架：页面资源、接口注册、规则、发布治理。
2. 首批接口返回稳定结构，供前端替换 mock service。
3. 明确 mapper 方法签名，为后续接入真实 SQL 做准备。

### Phase 2

1. 完成运行面主链路：页面解析、快照读取。
2. 将发布与快照生成逻辑在 service 层串联。
3. 为 JSSDK 对接保留稳定接口路径。

### Phase 3

1. 完成治理面查询接口。
2. 接入真实 MyBatis SQL、审计日志、触发日志、执行日志。
3. 将示例数据替换为数据库查询和持久化写入。

## 5. 首批关键接口

1. `GET /api/control/page-resources`
2. `GET /api/control/page-resources/{pageId}`
3. `POST /api/control/interfaces`
4. `GET /api/control/interfaces/{interfaceId}`
5. `POST /api/control/rules`
6. `PUT /api/control/rules/{ruleId}/versions/{versionId}`
7. `POST /api/control/rules/{ruleId}/versions/{versionId}/preview`
8. `POST /api/control/publish/validate`
9. `POST /api/runtime/page-context/resolve`
10. `GET /api/runtime/pages/{pageId}/bundle`

## 6. 数据库落地优先级

第一批：

1. `page_site`
2. `page_menu`
3. `page_resource`
4. `page_resource_version`
5. `interface_definition`
6. `interface_version`
7. `rule_definition`
8. `rule_version`

第二批：

1. `publish_task`
2. `runtime_snapshot`
3. 审计、触发、执行、指标相关表

## 7. 实施原则

1. controller 不直接访问 mapper。
2. service 不直接拼装 HTTP 响应。
3. mapper 不承接业务兜底和状态流转。
4. 所有发布相关逻辑统一放在 service 层处理。
5. 所有列表接口统一遵循 `pageNo`、`pageSize`、`keyword`、`status`、`ownerOrgId` 过滤口径。

## 8. 当前状态

1. `backend/` 已切换为 Maven 工程。
2. 已生成 Spring Boot 启动类、公共异常处理、请求上下文过滤器。
3. 已生成控制面、运行面、治理面的三层骨架类。
4. 已生成首批 MySQL 建表脚本。
5. 当前 service 仍以示例数据返回为主，下一步重点是将 mapper 与真实 SQL 接通。
