# 营小助配置中心 API 设计清单（Draft）

> 来源文档：`spec/config-center-product/architecture.md`、`spec/config-center-product/plan.md`、`spec/config-center-product/permission-model.md`  
> 文档目标：沉淀控制面、运行面、管理与审计面的接口边界，作为后续 OpenAPI 设计与联调评审基线  
> 更新日期：2026-03-12
> 数据库基线：TDSQL（默认按 TDSQL-MySQL 兼容版设计）

## 1. 设计范围

本清单覆盖三类 API：

1. 控制面 API：面向 Admin Web，用于页面、规则、作业场景、接口、预处理器、角色和发布控制。
2. 运行面 API：面向 JSSDK，用于页面识别、运行时快照、规则判定、作业执行和提示生命周期管理。
3. 管理与审计面 API：面向管理端与审计端，用于待处理视图、审计日志、触发日志、执行日志和指标查询。

本清单不覆盖：

1. 行内统一认证、SSO 或用户中心接口细节。
2. 外部业务系统接口本身的契约细节。
3. MQ 事件协议和对象存储归档协议细节。

## 2. 通用约定

### 2.1 路径前缀

1. 控制面：`/api/control/*`
2. 运行面：`/api/runtime/*`
3. 管理与审计面：`/api/management/*`

### 2.2 鉴权与上下文

所有 API 统一透传以下上下文：

1. `Authorization`
2. `X-Trace-Id`
3. `X-User-Id`
4. `X-Org-Id`
5. `X-Role-Ids`

控制面与管理与审计面接口由网关完成登录态校验；运行面接口由 JSSDK 使用业务页面会话或短期令牌访问。

### 2.3 统一响应结构

```json
{
  "code": "OK",
  "message": "success",
  "traceId": "4f7a0d4c2f2f4a40a2d2b147b93d4120",
  "data": {}
}
```

错误结构：

```json
{
  "code": "PUBLISH_VALIDATION_FAILED",
  "message": "发布校验未通过",
  "traceId": "4f7a0d4c2f2f4a40a2d2b147b93d4120",
  "details": [
    {
      "type": "FIELD_CONFLICT",
      "target": "loan_apply.amount",
      "reason": "同页同字段存在重复写入"
    }
  ]
}
```

### 2.4 分页与过滤

列表接口统一支持：

1. `pageNo`
2. `pageSize`
3. `keyword`
4. `status`
5. `ownerOrgId`
6. `updatedAtFrom`
7. `updatedAtTo`

管理与审计面接口额外支持：

1. `pendingType`
2. `effectiveDateFrom`
3. `effectiveDateTo`
4. `executionMode`
5. `hasConflict`
6. `needRiskConfirmation`

### 2.5 状态与值域建议

数据库与接口层建议统一使用英文状态值，由前端映射中文展示：

1. `DRAFT`
2. `ACTIVE`
3. `DISABLED`
4. `EXPIRED`

执行方式统一使用：

1. `AUTO_WITHOUT_PROMPT`
2. `AUTO_AFTER_PROMPT`
3. `PREVIEW_THEN_EXECUTE`
4. `FLOATING_BUTTON`

提示方式统一使用：

1. `SILENT`
2. `FLOATING`

提示关闭方式统一使用：

1. `AUTO_CLOSE`
2. `MANUAL_CLOSE`
3. `TIMER_THEN_MANUAL`

## 3. 控制面 API

### 3.1 页面资源中心

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `GET` | `/api/control/page-sites` | 查询站点列表 | 查看 |
| `GET` | `/api/control/page-menus` | 查询专区/菜单树 | 查看 |
| `POST` | `/api/control/page-resources` | 新建页面资源 | 配置 |
| `GET` | `/api/control/page-resources` | 页面资源列表 | 查看 |
| `GET` | `/api/control/page-resources/{pageId}` | 页面资源详情 | 查看 |
| `POST` | `/api/control/page-resources/{pageId}/versions` | 基于当前内容生成待发布版本 | 配置 |
| `PUT` | `/api/control/page-resources/{pageId}/versions/{versionId}` | 更新页面版本草稿 | 配置 |
| `POST` | `/api/control/page-resources/{pageId}/versions/{versionId}/clone` | 从历史版本复制草稿 | 配置 |
| `POST` | `/api/control/page-resources/{pageId}/share` | 发起共享或复制 | 配置 |

新建页面资源请求示例：

```json
{
  "menuId": 1001001,
  "name": "个人贷款申请页",
  "pageDetectRules": [
    {
      "type": "BUSINESS_MARKER",
      "expr": "data-menu-code=loan_apply"
    },
    {
      "type": "URL",
      "expr": "/loan/apply"
    }
  ],
  "elements": [
    {
      "logicName": "customer_no",
      "selectorType": "CSS",
      "selector": "#customerNo"
    }
  ],
  "ownerOrgId": "branch-001"
}
```

### 3.2 规则中心

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `POST` | `/api/control/rules` | 新建规则 | 配置 |
| `GET` | `/api/control/rules` | 规则列表 | 查看 |
| `GET` | `/api/control/rules/{ruleId}` | 规则详情 | 查看 |
| `POST` | `/api/control/rules/{ruleId}/versions` | 新建规则待发布版本 | 配置 |
| `PUT` | `/api/control/rules/{ruleId}/versions/{versionId}` | 更新规则版本 | 配置 |
| `POST` | `/api/control/rules/{ruleId}/versions/{versionId}/preview` | 规则预览 | 校验 |
| `POST` | `/api/control/rules/{ruleId}/versions/{versionId}/bind-scene` | 绑定作业场景 | 配置 |
| `POST` | `/api/control/rules/{ruleId}/versions/{versionId}/unbind-scene` | 解绑作业场景 | 配置 |

规则版本请求核心字段：

```json
{
  "name": "贷款申请风险提示",
  "pageResourceId": 2001001,
  "priority": 900,
  "prompt": {
    "promptMode": "FLOATING",
    "closeMode": "MANUAL_CLOSE",
    "content": "申请金额超过风险阈值，请先复核客户授信信息。"
  },
  "conditionGroups": [
    {
      "logicType": "AND",
      "conditions": [
        {
          "leftSource": {
            "type": "PAGE_FIELD",
            "ref": "apply_amount"
          },
          "operator": "GT",
          "rightSource": {
            "type": "FIXED",
            "value": "500000"
          }
        }
      ]
    }
  ]
}
```

规则预览请求示例：

```json
{
  "manualInputs": {
    "apply_amount": "600000",
    "customer_level": "A"
  }
}
```

规则预览响应重点：

1. 只返回解析结果、条件命中结果和提示/作业联动判断。
2. 明确标识 `previewOnly=true`。
3. 不回填线上样例值、历史值或最近取值结果。

### 3.3 作业场景中心

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `POST` | `/api/control/job-scenes` | 新建作业场景 | 配置 |
| `GET` | `/api/control/job-scenes` | 作业场景列表 | 查看 |
| `GET` | `/api/control/job-scenes/{sceneId}` | 作业场景详情 | 查看 |
| `POST` | `/api/control/job-scenes/{sceneId}/versions` | 新建场景待发布版本 | 配置 |
| `PUT` | `/api/control/job-scenes/{sceneId}/versions/{versionId}` | 更新场景版本 | 配置 |
| `POST` | `/api/control/job-scenes/{sceneId}/versions/{versionId}/validate` | 基础校验 | 校验 |
| `POST` | `/api/control/job-scenes/{sceneId}/versions/{versionId}/risk-confirm` | 自动执行风险确认 | 风险确认 |

场景版本请求核心字段：

```json
{
  "name": "贷款申请自动查数预填",
  "pageResourceId": 2001001,
  "executionMode": "PREVIEW_THEN_EXECUTE",
  "manualDurationSec": 45,
  "nodes": [
    {
      "nodeType": "page_get",
      "orderNo": 1,
      "config": {
        "fields": ["customer_no"]
      }
    },
    {
      "nodeType": "api_call",
      "orderNo": 2,
      "config": {
        "interfaceId": 3001001
      }
    },
    {
      "nodeType": "page_set",
      "orderNo": 3,
      "config": {
        "mappings": [
          {
            "source": "api.credit_amount",
            "target": "credit_amount"
          }
        ]
      }
    }
  ]
}
```

基础校验返回重点：

1. 节点顺序是否合法。
2. 节点输入输出引用是否完整。
3. 页面元素、接口、预处理器引用是否有效。
4. 仅表示配置有效，不代表真实业务环境验证通过。

### 3.3A 名单数据中心

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `POST` | `/api/control/list-datas` | 新建名单对象 | 配置 |
| `GET` | `/api/control/list-datas` | 名单列表 | 查看 |
| `GET` | `/api/control/list-datas/{listId}` | 名单详情 | 查看 |
| `POST` | `/api/control/list-datas/{listId}/versions` | 新建名单待发布版本 | 配置 |
| `PUT` | `/api/control/list-datas/{listId}/versions/{versionId}` | 更新名单版本 | 配置 |
| `POST` | `/api/control/list-datas/{listId}/versions/{versionId}/parse-preview` | 解析导入文件并预览表头 | 校验 |
| `POST` | `/api/control/list-datas/{listId}/versions/{versionId}/build-index` | 构建 ES 检索索引 | 校验 |
| `GET` | `/api/control/list-datas/{listId}/versions/{versionId}/index-status` | 查询 ES 建索引状态 | 查看 |
| `GET` | `/api/control/list-datas/{listId}/references` | 查询规则 / 作业引用关系 | 查看 |

名单版本关键字段建议至少包括：

1. `name`
2. `ownerOrgId`
3. `scope`
4. `effectiveStartAt`
5. `effectiveEndAt`
6. `importFile`
7. `importColumns`：文件解析出的表头字段，供运行时选择匹配列
8. `outputFields`：由上传人员从解析表头中勾选，供规则 / 作业下拉选择返回字段
9. `rowCount`
10. `indexBuildStatus`
11. `activeAlias`

说明约束：

1. 名单数据沿用平台统一生命周期：`DRAFT`、`ACTIVE`、`DISABLED`、`EXPIRED`。
2. 生效中版本不直接修改，任何变更都生成新的待发布版本。
3. 规则与作业只能引用已发布且未过期的名单版本。
4. 名单基础信息、版本状态、引用关系等元数据保存在 TDSQL；实际检索数据按版本写入 Elasticsearch。
5. 发布前必须确认对应版本 ES 索引已构建完成，并可通过别名切换为运行面可读版本。

`build-index` 请求建议至少支持：

1. `buildMode`：`INITIAL_BUILD` / `REBUILD`
2. `forceRebuild`
3. `sourceFileToken`

`index-status` 响应建议至少包含：

1. `indexBuildStatus`
2. `physicalIndexName`
3. `activeAlias`
4. `docCount`
5. `startedAt`
6. `finishedAt`
7. `errorMessage`

`build-index` 请求示例：

```json
{
  "buildMode": "INITIAL_BUILD",
  "forceRebuild": false,
  "sourceFileToken": "oss://config-center/list-data/72001001/v3/import.xlsx"
}
```

`index-status` 响应示例：

```json
{
  "listId": 72001001,
  "listVersionId": 72001003,
  "indexBuildStatus": "READY",
  "physicalIndexName": "cc_list_data_72001001_72001003",
  "activeAlias": "cc_list_data_72001001_active",
  "docCount": 1280,
  "startedAt": "2026-03-15T09:10:00+08:00",
  "finishedAt": "2026-03-15T09:12:18+08:00",
  "errorMessage": ""
}
```

### 3.4 接口定义中心

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `POST` | `/api/control/interfaces` | 新建接口定义 | 配置 |
| `GET` | `/api/control/interfaces` | 接口列表 | 查看 |
| `GET` | `/api/control/interfaces/{interfaceId}` | 接口详情 | 查看 |
| `POST` | `/api/control/interfaces/{interfaceId}/versions` | 新建接口版本 | 配置 |
| `PUT` | `/api/control/interfaces/{interfaceId}/versions/{versionId}` | 更新接口版本 | 配置 |
| `POST` | `/api/control/interfaces/{interfaceId}/versions/{versionId}/validate` | 校验接口定义完整性 | 校验 |
| `GET` | `/api/control/interfaces/{interfaceId}/references` | 查询引用关系 | 查看 |

接口版本关键字段：

1. `method`
2. `url`
3. `requestParams`
4. `responseMappings`
5. `timeoutMs`
6. `retryPolicy`
7. `maskFields`

### 3.5 预处理器中心

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `GET` | `/api/control/preprocessors` | 预处理器列表 | 查看 |
| `POST` | `/api/control/preprocessors` | 新建预处理器定义 | 配置 |
| `PUT` | `/api/control/preprocessors/{processorId}` | 更新预处理器定义 | 配置 |
| `POST` | `/api/control/preprocessors/{processorId}/validate` | 预处理器基础校验 | 校验 |

备注：

1. P0 以平台内置预处理器为主。
2. 自定义脚本类预处理器必须打上 `isScript=true` 标记，走更严格受控路径。

### 3.6 角色管理模块

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `GET` | `/api/control/roles` | 角色列表 | 查看 |
| `POST` | `/api/control/roles` | 新建角色 | 角色授权管理 |
| `GET` | `/api/control/roles/{roleId}` | 角色详情 | 查看 |
| `PUT` | `/api/control/roles/{roleId}` | 更新角色 | 角色授权管理 |
| `POST` | `/api/control/roles/{roleId}/clone` | 复制角色 | 角色授权管理 |
| `POST` | `/api/control/roles/{roleId}/disable` | 停用角色 | 角色授权管理 |
| `POST` | `/api/control/roles/{roleId}/enable` | 恢复角色 | 角色授权管理 |
| `POST` | `/api/control/roles/{roleId}/members:batch-bind` | 批量分配人员 | 角色授权管理 |
| `POST` | `/api/control/roles/{roleId}/actions` | 配置操作类型权限 | 角色授权管理 |
| `POST` | `/api/control/roles/{roleId}/scopes` | 配置组织范围 | 角色授权管理 |

### 3.7 发布与状态动作

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `POST` | `/api/control/publish/validate` | 发布前强校验 | 校验 |
| `POST` | `/api/control/publish/tasks` | 创建发布任务 | 发布 |
| `GET` | `/api/control/publish/tasks/{taskId}` | 发布任务详情 | 查看 |
| `POST` | `/api/control/resources/{resourceType}/{resourceId}/disable` | 停用资源 | 停用 |
| `POST` | `/api/control/resources/{resourceType}/{resourceId}/expire` | 延期或重设失效时间 | 延期 |
| `POST` | `/api/control/resources/{resourceType}/{resourceId}/rollback` | 回滚资源 | 回滚 |

发布前强校验请求示例：

```json
{
  "resourceType": "RULE",
  "resourceId": 4001001,
  "targetVersionId": 4001002
}
```

返回重点：

1. `passed`
2. `blockingItems`
3. `warnings`
4. `conflictSummary`
5. `dependencySummary`

## 4. 运行面 API

### 4.1 页面识别与运行时快照

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/runtime/page-context/resolve` | 根据站点、URL、菜单、业务标识解析页面资源 |
| `GET` | `/api/runtime/pages/{pageId}/bundle` | 获取页面运行时快照包 |

`resolve` 请求示例：

```json
{
  "siteCode": "kaiyang",
  "menuCode": "loan_apply",
  "url": "https://bank-inner/loan/apply",
  "markers": {
    "data-menu-code": "loan_apply"
  }
}
```

`bundle` 响应核心字段：

1. `bundleVersion`
2. `pageResourceId`
3. `etag`
4. `pageFields`
5. `rules`
6. `sceneRefs`
7. `floatingEntryAvailable`

`pageFields` 建议至少包含：

1. `fieldKey`
2. `fieldScope`：`COMMON` / `PAGE_LOCAL`
3. `elementType`：如 `INPUT`、`SELECT`、`TEXTAREA`、`BUTTON`、`READONLY_TEXT`
4. `locator`
5. `readable`
6. `writable`
7. `watchable`
8. `extractor`
9. `normalizers`

### 4.2 运行时数据代理与提示生命周期

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/runtime/data-proxy/query` | 按运行时快照中的接口定义发起受控数据代理请求 |
| `POST` | `/api/runtime/list-lookups/query` | 按已发布名单版本发起受控名单检索 |
| `POST` | `/api/runtime/prompts/{traceId}/close` | 记录提示关闭 |
| `POST` | `/api/runtime/prompts/{traceId}/confirm` | 记录提示确认，并在执行方式要求时承接后续作业启动 |

说明约束：

1. 规则判定默认在 JSSDK 本地执行，运行面不再提供高频后端判定接口。
2. 数据代理接口只服务于快照中声明的接口定义，不接受页面侧自由拼装的任意请求。
3. 名单检索接口只返回最小命中结果，不向浏览器返回原始名单内容。
4. 名单检索接口统一查询已发布 ES 索引或别名，不读取 TDSQL 明细表。
5. 运行面需校验请求中的 `listVersionId` 与当前生效别名实际指向版本一致；不一致时返回 `LIST_VERSION_MISMATCH`。
6. 响应需返回可用于本地缓存控制的元信息，如 `ttlSeconds`、`cacheScope`、`interfaceVersion`。
7. 页面字段结果语义由 JSSDK 按 `ABSENT`、`EMPTY`、`VALUE` 三态处理；运行面日志和执行接口需能承接字段缺失导致的 `INVALID` 信息。

数据代理请求示例：

```json
{
  "interfaceId": 61001001,
  "interfaceVersion": "v3",
  "bundleVersion": "b-20260312-001",
  "pageResourceId": 2001001,
  "params": {
    "customer_no": "C20260001"
  }
}
```

数据代理响应示例：

```json
{
  "requestId": "dp-20260312-0001",
  "interfaceId": 61001001,
  "interfaceVersion": "v3",
  "ttlSeconds": 60,
  "cacheScope": "PAGE_SESSION",
  "data": {
    "creditLevel": "B",
    "grantAmount": "500000"
  }
}
```

名单检索请求示例：

```json
{
  "listId": 72001001,
  "listVersionId": 72001003,
  "bundleVersion": "b-20260312-001",
  "pageResourceId": 2001001,
  "matchers": [
    {
      "matchColumn": "customer_no",
      "lookupValue": "C20260001"
    },
    {
      "matchColumn": "id_no",
      "lookupValue": "310101199901011234"
    }
  ],
  "outputFields": ["risk_level"]
}
```

名单检索响应示例：

```json
{
  "requestId": "ll-20260312-0001",
  "listId": 72001001,
  "listVersionId": 72001003,
  "ttlSeconds": 60,
  "cacheScope": "PAGE_SESSION",
  "data": {
    "matched": true,
    "listName": "高风险客户名单",
    "outputValues": {
      "risk_level": "HIGH"
    },
    "reasonCode": "MATCHED"
  }
}
```

### 4.3 作业执行

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/runtime/executions` | 创建执行实例 |
| `GET` | `/api/runtime/executions/{executionId}` | 查询执行状态 |
| `GET` | `/api/runtime/executions/{executionId}/preview` | 获取预览确认结果 |
| `POST` | `/api/runtime/executions/{executionId}/confirm-write` | 确认写入页面 |
| `POST` | `/api/runtime/executions/{executionId}/cancel` | 取消执行 |
| `POST` | `/api/runtime/executions/{executionId}/retry` | 重试执行，创建新实例 |

创建执行实例请求示例：

```json
{
  "sceneId": 5001001,
  "triggerSource": "PROMPT_CONFIRM",
  "executionMode": "PREVIEW_THEN_EXECUTE",
  "pageResourceId": 2001001,
  "traceId": "rt-20260312-0001",
  "context": {
    "fields": {
      "customer_no": "C20260001"
    }
  }
}
```

执行状态响应重点：

1. `status`
2. `executionMode`
3. `nodeResults`
4. `needPreviewConfirm`
5. `fallbackAvailable`
6. `errorMessage`

约束说明：

1. `executionMode` 由作业场景配置决定，可取 `AUTO_WITHOUT_PROMPT`、`AUTO_AFTER_PROMPT`、`PREVIEW_THEN_EXECUTE`、`FLOATING_BUTTON`。
2. `PROMPT_CONFIRM` 仅是 `triggerSource` 的一种，不代表所有场景都必须经过提示确认。
3. `FLOATING_BUTTON` 场景必须通过悬浮入口显式创建执行实例。

### 4.4 悬浮按钮二次触发

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/runtime/pages/{pageId}/available-scenes` | 查询当前页面可手动触发场景 |
| `POST` | `/api/runtime/pages/{pageId}/floating-trigger` | 通过悬浮按钮触发场景 |

要求：

1. 每次触发必须创建新的执行实例。
2. 不复用旧实例上下文。
3. 若没有可执行场景，则前端不展示悬浮入口。

### 4.5 运行时事件上报

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/runtime/events` | 批量上报运行事件 |

事件类型建议：

1. `PAGE_RESOLVED`
2. `RULE_MATCHED`
3. `PROMPT_CLOSED`
4. `PROMPT_CONFIRMED`
5. `EXECUTION_STARTED`
6. `EXECUTION_SUCCEEDED`
7. `EXECUTION_FAILED`
8. `EXECUTION_FALLBACK`

## 5. 管理与审计面 API

### 5.1 待处理视图与工作台

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `GET` | `/api/management/pending-items` | 查询待处理对象 | 查看 |
| `GET` | `/api/management/pending-summary` | 查询待处理摘要 | 查看 |
| `GET` | `/api/management/resource-timeline` | 查询资源状态时间线 | 查看 |

待处理摘要响应重点：

1. `draftCount`
2. `expiringSoonCount`
3. `validationFailedCount`
4. `conflictCount`
5. `riskConfirmPendingCount`

### 5.2 审计日志

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `GET` | `/api/management/audit-logs` | 查询状态变更日志 | 审计查看 |
| `GET` | `/api/management/audit-logs/{logId}` | 查询状态变更日志详情 | 审计查看 |

### 5.3 触发日志与执行日志

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `GET` | `/api/management/trigger-logs` | 查询触发日志 | 审计查看 |
| `GET` | `/api/management/execution-logs` | 查询执行日志 | 审计查看 |
| `GET` | `/api/management/execution-logs/{executionId}` | 查询执行实例详情 | 审计查看 |

### 5.4 指标看板

| 方法 | 路径 | 说明 | 权限要求 |
| --- | --- | --- | --- |
| `GET` | `/api/management/metrics/overview` | 查询指标总览 | 查看 |
| `GET` | `/api/management/metrics/menus` | 查询菜单维度指标 | 查看 |
| `GET` | `/api/management/metrics/failure-reasons` | 查询失败原因分布 | 查看 |
| `GET` | `/api/management/metrics/expiring` | 查询已失效与即将到期对象 | 查看 |

核心指标字段建议：

1. `executionSuccessRate`
2. `avgSavedSeconds`
3. `failureReasonTopN`
4. `expiredResourceCount`
5. `expiringSoonResourceCount`

## 6. API 与权限矩阵对齐建议

1. 业务配置角色默认拥有查看、配置、校验类接口权限。
2. 业务管理角色默认拥有查看、校验、发布、停用、延期、回滚、风险确认和待处理/审计查询权限，但不默认拥有配置类接口权限。
3. 业务审计角色默认只访问状态变更日志、触发日志、执行日志和只读指标接口。
4. 平台支持角色默认拥有查看、校验和审计查看接口权限，用于排障和支持。
5. 业务超管角色拥有本组织范围内的完整业务管理与角色授权管理接口权限。

## 7. 下一步建议

1. 以本文为基线生成 OpenAPI 目录骨架，先覆盖控制面和运行面关键链路。
2. 优先固化以下接口：
   `page-context/resolve`
   `runtime/pages/{pageId}/bundle`
   `runtime/data-proxy/query`
   `runtime/executions`
   `control/publish/validate`
3. 在接口正式冻结前，和 `tdsql-ddl-draft.md` 做一次字段对齐评审，避免对象名、状态值和版本关系偏差。

