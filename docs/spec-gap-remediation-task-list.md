# Spec 差异整改任务清单

> 更新时间：2026-03-14  
> 适用范围：`config-center` 当前前端原型仓库  
> 基线来源：`spec/config-center-product/*` 与 `src/*` 差异分析结果  
> 目标：将当前仓库从“可演示原型”收口为“与 spec 一致的前端实现基线”

## 1. 执行原则

1. 先收口对象模型，再调整页面表单与服务逻辑，避免 UI 改完后模型再次返工。
2. 先统一状态源和日志链路，再补治理视图与指标页，避免出现页面可操作但治理侧不可见。
3. 每项整改都执行 `docs/dev-checklist.md` 的五项联动检查：对象模型、配置 UI、保存结构、运行解析、验收用例。
4. 本轮不扩 scope 到真实后端实现，只做前端仓库内的规范对齐与对接预留。

## 2. P0 必做任务

### 2.1 对象模型收口

- [ ] 收口规则模型为单层条件结构，移除嵌套条件组语义。  
  文件：
  - `src/types.ts`
  - `src/services/workflowService.ts`
  - `src/mock/seeds.ts`
- [ ] 将页面资源识别规则从 `detectRulesSummary` 文本摘要升级为结构化字段。  
  文件：
  - `src/types.ts`
  - `src/pages/PageResourcesPage/PageResourcesPage.tsx`
  - `src/services/configCenterService.ts`
- [ ] 将 API 注册输入输出配置从 `inputConfigJson/outputConfigJson` 字符串升级为前端强类型结构。  
  文件：
  - `src/types.ts`
  - `src/pages/InterfacesPage/interfacesPageShared.ts`
  - `src/pages/InterfacesPage/useInterfacesPageModel.tsx`
  - `src/services/configCenterService.ts`

### 2.2 状态源与日志链路统一

- [ ] 合并 `configCenterService` 与 `workflowService` 的分离 store，建立统一仓储。  
  文件：
  - `src/services/configCenterService.ts`
  - `src/services/workflowService.ts`
- [ ] 打通作业执行、预览执行、悬浮按钮触发到治理日志/执行日志/指标源。  
  文件：
  - `src/services/configCenterService.ts`
  - `src/services/workflowService.ts`
  - `src/pages/JobScenesPage/useJobScenesPageModel.ts`
  - `src/pages/AuditMetricsPage/AuditMetricsPage.tsx`

### 2.3 原型字段下线

- [ ] 下线正式模型中的原型调试字段，如节点配置中的 `forceFail`。  
  文件：
  - `src/pages/JobScenesPage/jobScenesPageShared.ts`
  - `src/pages/JobScenesPage/JobScenesPage.tsx`
- [ ] 将系统生成字段统一改为只读展示，不允许手工维护。  
  字段：
  - `id`
  - `currentVersion`
  - `usedByCount`
  - `memberCount`
  文件：
  - `src/pages/InterfacesPage/InterfacesPage.tsx`
  - `src/pages/PageResourcesPage/PageResourcesPage.tsx`
  - `src/pages/PreprocessorsPage/PreprocessorsPage.tsx`
  - `src/pages/RolesPage/RolesPage.tsx`

## 3. P1 页面整改任务

### 3.1 智能提示

- [ ] 规则保存逻辑只产出单层条件模型，不再保留嵌套组兼容逻辑。  
  文件：
  - `src/pages/RulesPage/useRulesPageModel.tsx`
  - `src/services/workflowService.ts`
- [ ] 接入规则预览/校验结果，确保 API 输出路径缺失、必填入参缺失时阻断保存。  
  文件：
  - `src/pages/RulesPage/RulesPage.tsx`
  - `src/pages/RulesPage/useRulesPageModel.tsx`
  - `src/services/workflowService.ts`

### 3.2 页面资源中心

- [ ] 将“识别口径”改为结构化规则编辑，而不是自由文本输入。  
  文件：
  - `src/pages/PageResourcesPage/PageResourcesPage.tsx`
- [ ] 元素编辑时锁定所属页面上下文，不允许手工修改 `pageResourceId`。  
  文件：
  - `src/pages/PageResourcesPage/PageResourcesPage.tsx`

### 3.3 API 注册

- [ ] 保留双栏 + 四 Tab 交互，但改为直接操作结构化 draft。  
  文件：
  - `src/pages/InterfacesPage/InterfacesPage.tsx`
  - `src/pages/InterfacesPage/useInterfacesPageModel.tsx`
  - `src/pages/InterfacesPage/interfacesPageShared.ts`
- [ ] 调试流程继续保留，但与结构化输入输出配置保持同源。  
  文件：
  - `src/pages/InterfacesPage/useInterfacesPageModel.tsx`

### 3.4 智能作业

- [ ] 预览确认执行、悬浮按钮触发、风险确认后的状态变化需联动治理与审计。  
  文件：
  - `src/pages/JobScenesPage/useJobScenesPageModel.ts`
  - `src/services/configCenterService.ts`
  - `src/services/workflowService.ts`
- [ ] 保留 ReactFlow 编排，但从业务配置中移除模拟失败语义。  
  文件：
  - `src/pages/JobScenesPage/JobScenesPage.tsx`
  - `src/pages/JobScenesPage/jobScenesPageShared.ts`

## 4. P2 治理与运营补齐

### 4.1 治理工作台

- [ ] 补充资源治理时间线视图。  
  文件：
  - `src/pages/GovernancePage/GovernancePage.tsx`
  - `src/services/configCenterService.ts`
- [ ] 补充更完整筛选条件：组织范围、责任人、生效时间、失效时间、执行方式、自动执行标识。  
  文件：
  - `src/pages/GovernancePage/GovernancePage.tsx`

### 4.2 审计与指标

- [ ] 增加指标总览、菜单维度指标、失效/即将到期对象指标。  
  文件：
  - `src/pages/AuditMetricsPage/AuditMetricsPage.tsx`
  - `src/services/configCenterService.ts`
- [ ] 执行成功率、失败原因、节省时长统一从同一份执行数据计算。  
  文件：
  - `src/services/configCenterService.ts`
  - `src/services/workflowService.ts`

### 4.3 角色与预处理器

- [ ] 为角色管理补充授权变更审计展示入口。  
  文件：
  - `src/pages/RolesPage/RolesPage.tsx`
  - `src/pages/GovernancePage/GovernancePage.tsx`
- [ ] 为脚本型预处理器补充更强治理提示与受控发布约束。  
  文件：
  - `src/pages/PreprocessorsPage/PreprocessorsPage.tsx`
  - `src/services/configCenterService.ts`

## 5. 建议实施顺序

### 第一批

1. `src/types.ts`
2. `src/mock/seeds.ts`
3. `src/services/configCenterService.ts`
4. `src/services/workflowService.ts`

### 第二批

1. `src/pages/RulesPage/*`
2. `src/pages/PageResourcesPage/PageResourcesPage.tsx`
3. `src/pages/InterfacesPage/*`

### 第三批

1. `src/pages/JobScenesPage/*`
2. `src/pages/GovernancePage/GovernancePage.tsx`
3. `src/pages/AuditMetricsPage/AuditMetricsPage.tsx`

### 第四批

1. `src/pages/RolesPage/RolesPage.tsx`
2. `src/pages/PreprocessorsPage/PreprocessorsPage.tsx`
3. `docs/dev-checklist.md`

## 6. 每项任务完成定义

每项整改完成后，至少满足以下条件：

1. 类型定义、页面表单、service payload、mock 数据同步更新。
2. 关键字段可保存、可回显、可执行、异常可阻断。
3. 本地构建通过：

```powershell
npm run build
```

4. 关键字段全局检索无遗漏：

```powershell
rg -n "<关键字段名>" src spec docs
```

5. 在 PR 描述补充“联动影响面清单”。

## 7. 备注

1. 当前仓库仍是 Admin Web 原型前端，后续若接入真实后端，应优先在 service 层抽象 repository/api client，而不是在页面层直接替换。
2. 若进入下一阶段，可在本清单基础上继续拆成“按周任务包”或“按模块任务包”。
