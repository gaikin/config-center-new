# 配置中心前端 UI 重构计划

> 生成日期: 2026-03-13
> 项目版本: 0.1.0
> 技术栈: React 18 + Ant Design 5 + TypeScript + Vite

---

## 📋 目录

- [项目概述](#项目概述)
- [当前架构分析](#当前架构分析)
- [交互问题清单](#交互问题清单)
- [重构优先级矩阵](#重构优先级矩阵)
- [详细重构方案](#详细重构方案)
- [设计规范建议](#设计规范建议)
- [组件库规划](#组件库规划)
- [实施路线图](#实施路线图)
- [验收标准](#验收标准)

---

## 📊 项目概述

### 应用导航结构

```typescript
const navItems = [
  { key: "/", label: "总览" },
  { key: "/page-resources", label: "页面资源中心" },
  { key: "/interfaces", label: "API注册" },
  { key: "/preprocessors", label: "预处理器中心" },
  { key: "/rules", label: "智能提示" },
  { key: "/job-scenes", label: "智能作业" },
  { key: "/governance", label: "治理工作台" },
  { key: "/audit-metrics", label: "审计与指标中心" },
  { key: "/roles", label: "角色管理" }
];
```

### 页面文件映射

| 页面名称 | 文件路径 | 关键功能 |
|---------|---------|---------|
| 总览 | `DashboardPage.tsx` | 统计概览、阶段计划展示 |
| 页面资源中心 | `PageResourcesPage.tsx` | 页面资源CRUD、元素映射管理 |
| API注册 | `InterfacesPage.tsx` | API配置、入参出参管理、调试 |
| 预处理器中心 | `PreprocessorsPage.tsx` | 预处理器CRUD |
| 智能提示 | `RulesPage.tsx` | 规则配置、条件编辑、展示设置 |
| 智能作业 | `JobScenesPage.tsx` | 场景配置、节点编排、预览确认 |
| 治理工作台 | `GovernancePage.tsx` | 待处理事项、发布审批、审计日志 |
| 审计与指标中心 | `AuditMetricsPage.tsx` | 触发日志、执行日志、失败分析 |
| 角色管理 | `RolesPage.tsx` | 角色CRUD、权限配置、成员管理 |

---

## 🏗️ 当前架构分析

### 通用布局模式

```
┌─────────────────────────────────────────────────────────┐
│ HeaderBar (渐变背景: #0f172a → #1e3a8a → #0ea5a4) │
│ [Logo] Phase 0-5 | WP-A~WP-F 实施导航    [导航]     │
├──────────────────┬──────────────────────────────────────┤
│                  │                                      │
│   Sider (248px) │         ContentWrap                 │
│   [Menu导航]     │         [页面内容]                   │
│                  │                                      │
│                  │         [Card]                      │
│                  │         [Table]                     │
│                  │         [Drawer/Modal]              │
│                  │                                      │
└──────────────────┴──────────────────────────────────────┘
```

### 响应式断点

```css
@media (max-width: 1024px) {
  /* 侧边栏隐藏，使用Drawer代替 */
}
```

### 通用UI模式

#### 模式1: 表格 + 操作栏 + Modal
- 使用页面: PreprocessorsPage, RolesPage, PageResourcesPage (基础CRUD)
- 结构: Card → Table → Modal (编辑/新建)
- 分页: pageSize: 6 (固定)

#### 模式2: 表格 + 操作栏 + Drawer
- 使用页面: InterfacesPage, RulesPage, JobScenesPage, PageResourcesPage (元素映射)
- 结构: Card → Table → Drawer (右侧覆盖式)
- 宽度: `getRightDrawerWidth(Boolean(screens.lg))`

#### 模式3: 统计卡片 + 多表格
- 使用页面: DashboardPage, GovernancePage, AuditMetricsPage
- 结构: Row(Statistic) → Row(Card + Table)

---

## ⚠️ 交互问题清单

### 🔴 高优先级问题 (P0 - 阻断型)

#### P0-1: ID字段可编辑问题
**影响页面**: 所有页面
**问题描述**: ID字段在表单中可手动编辑，但应该由系统自动生成
**代码位置**:
- `InterfacesPage.tsx:840-842`
- `RolesPage.tsx:231-233`
- `PreprocessorsPage.tsx:149-151`
- `PageResourcesPage.tsx:291-293`
- `JobScenesPage.tsx:710`

**影响**:
- 数据一致性问题
- 冲突风险
- 违反ID自增原则

#### P0-2: 统计字段可编辑问题
**影响页面**: 所有页面
**问题描述**: 系统计算的统计字段可手动编辑
**代码位置**:
- `RolesPage.tsx:258-260` (成员数)
- `PreprocessorsPage.tsx:174-176` (被引用次数)
- `PageResourcesPage.tsx:321-323` (元素数量)
- `JobScenesPage.tsx:718` (风险确认状态)

**影响**:
- 数据准确性问题
- 与实际状态不一致

#### P0-3: 缺少操作确认问题
**影响页面**: 所有页面
**问题描述**: 关键操作（删除、状态切换）缺少二次确认
**代码位置**:
- 所有 `switchStatus` / `toggleStatus` 函数
- 删除操作部分有 `Popconfirm`，但状态切换无确认

**影响**:
- 误操作风险
- 生产环境安全隐患

#### P0-4: 表单未保存检测问题
**影响页面**: 所有Modal/Drawer
**问题描述**: 关闭表单时不检测未保存更改
**代码位置**: 所有Modal/Drawer的 `onCancel` 回调

**影响**:
- 数据丢失风险
- 用户体验差

---

### 🟡 中优先级问题 (P1 - 体验型)

#### P1-1: 成员管理交互问题
**影响页面**: `RolesPage.tsx`
**问题描述**:
- 成员分配使用纯文本域 (第273-278行)
- 没有提供成员搜索/选择功能
- 支持格式说明不够明显

**建议改进**:
- 提供成员搜索下拉
- 支持批量成员添加
- 添加成员头像和部门信息

#### P1-2: 权限配置问题
**影响页面**: `RolesPage.tsx`
**问题描述**:
- 操作类型多选没有权限说明 (第248-254行)
- 角色类型切换不触发权限预设

**建议改进**:
- 添加权限说明Tooltip
- 角色类型切换时自动填充推荐权限

#### P1-3: 环境切换引导问题
**影响页面**: `InterfacesPage.tsx`
**问题描述**:
- 测试/生产路径切换需要手动选择
- 没有环境切换视觉提示
- 调试时环境切换不直观

**建议改进**:
- 添加环境切换开关
- 用颜色区分测试/生产环境
- 调试Modal中突出显示当前环境

#### P1-4: 级联筛选重置问题
**影响页面**: `PageResourcesPage.tsx`
**问题描述**:
- 站点切换时菜单筛选没有自动重置
- 代码位置: 第216-220行

**建议改进**:
- 站点切换时自动重置菜单为"全部"
- 添加级联筛选视觉提示

#### P1-5: 弹窗类型不一致问题
**影响页面**: `InterfacesPage.tsx`
**问题描述**:
- 调试功能在Modal中
- 编辑在Drawer中
- 交互不一致

**建议改进**:
- 统一使用Drawer
- 或使用Tab分页Drawer

#### P1-6: 节点编排UI问题
**影响页面**: `JobScenesPage.tsx`
**问题描述**:
- 多个Card区域缺乏视觉层级区分 (第736-897行)
- 节点属性保存按钮位置不明显 (第888行)
- ReactFlow画布和节点库在同一Card内

**建议改进**:
- 使用Steps组件展示流程区域
- 节点属性固定在右侧
- 节点库独立Card

---

### 🟢 低优先级问题 (P2 - 优化型)

#### P2-1: 缺少脚本编辑器
**影响页面**: `PreprocessorsPage.tsx`
**问题描述**: 脚本类型预处理器没有代码编辑能力

**建议改进**:
- 集成 Monaco Editor
- 添加语法高亮和代码补全

#### P2-2: 表格操作过多问题
**影响页面**: `JobScenesPage.tsx` (第692-702行)
**问题描述**: 操作列按钮过多，占用空间大

**建议改进**:
- 超过3个操作时使用Dropdown
- 常用操作保持显示

#### P2-3: 分页大小固定问题
**影响页面**: 所有Table
**问题描述**: 分页pageSize固定为6，无法调整

**建议改进**:
- 提供分页大小选择: [6, 10, 20, 50]
- 记住用户选择

#### P2-4: 异常字段提示缺失
**影响页面**: `JobScenesPage.tsx` (预览确认)
**问题描述**: 异常字段有视觉标记但无悬停提示

**建议改进**:
- 添加Tooltip显示异常原因
- 异常行显示红色背景

#### P2-5: 识别口径构建器缺失
**影响页面**: `PageResourcesPage.tsx`
**问题描述**: 识别口径是纯文本输入

**建议改进**:
- 提供规则构建器
- 支持可视化的选择器组合

---

## 📊 重构优先级矩阵

| 问题类型 | 优先级 | 影响范围 | 改进难度 | 预估工时 | 建议阶段 |
|---------|-------|---------|---------|---------|---------|
| ID字段可编辑 | P0 | 全局 | 低 | 2h | Phase 1 |
| 统计字段可编辑 | P0 | 全局 | 低 | 2h | Phase 1 |
| 缺少操作确认 | P0 | 全局 | 中 | 4h | Phase 1 |
| 表单未保存检测 | P0 | 全局 | 中 | 6h | Phase 1 |
| 成员管理交互 | P1 | RolesPage | 高 | 1d | Phase 2 |
| 权限配置优化 | P1 | RolesPage | 中 | 4h | Phase 2 |
| 环境切换引导 | P1 | InterfacesPage | 中 | 4h | Phase 2 |
| 级联筛选重置 | P1 | PageResourcesPage | 低 | 1h | Phase 2 |
| 弹窗类型统一 | P1 | InterfacesPage | 低 | 2h | Phase 2 |
| 节点编排UI | P1 | JobScenesPage | 高 | 2d | Phase 3 |
| 脚本编辑器 | P2 | PreprocessorsPage | 高 | 2d | Phase 4 |
| 表格操作优化 | P2 | JobScenesPage | 低 | 2h | Phase 4 |
| 分页大小可调 | P2 | 全局 | 低 | 3h | Phase 4 |
| 异常字段提示 | P2 | JobScenesPage | 低 | 2h | Phase 4 |
| 识别口径构建器 | P2 | PageResourcesPage | 高 | 2d | Phase 5 |

---

## 🔧 详细重构方案

### 方案1: 通用组件封装

#### 1.1 ID字段组件
```typescript
// components/form/IDField.tsx
interface IDFieldProps {
  value?: number;
  label?: string;
}

export function IDField({ value, label = "ID" }: IDFieldProps) {
  return (
    <Form.Item name="id" label={label}>
      <InputNumber value={value} disabled style={{ width: "100%" }} />
    </Form.Item>
  );
}
```

#### 1.2 只读统计字段组件
```typescript
// components/form/ReadOnlyField.tsx
interface ReadOnlyFieldProps {
  label: string;
  value: React.ReactNode;
  suffix?: string;
}

export function ReadOnlyField({ label, value, suffix }: ReadOnlyFieldProps) {
  return (
    <Form.Item label={label}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Typography.Text>{value}</Typography.Text>
        {suffix && <Typography.Text type="secondary"> {suffix}</Typography.Text>}
      </div>
    </Form.Item>
  );
}
```

#### 1.3 带确认的状态切换组件
```typescript
// components/buttons/StatusToggleButton.tsx
interface StatusToggleButtonProps {
  currentStatus: "ACTIVE" | "DISABLED";
  onToggle: () => Promise<void>;
  resourceName: string;
}

export function StatusToggleButton({
  currentStatus,
  onToggle,
  resourceName
}: StatusToggleButtonProps) {
  const nextStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
  const msgApi = message.useMessage()[0];

  const handleToggle = async () => {
    try {
      await onToggle();
      msgApi.success(`${resourceName}状态已切换为${nextStatus}`);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  return (
    <Popconfirm
      title={`确认将${resourceName}状态切换为${nextStatus}?`}
      on description={nextStatus === "DISABLED" ? "停用后将不再生效" : "启用后将立即生效"}
      onConfirm={handleToggle}
    >
      <Button size="small">
        {currentStatus === "ACTIVE" ? "停用" : "启用"}
      </Button>
    </Popconfirm>
  );
}
```

#### 1.4 未保存检测组件
```typescript
// hooks/useUnsavedWarning.ts
interface UseUnsavedWarningOptions {
  hasUnsaved: boolean;
  onConfirmLeave: () => void;
  onCancelLeave: () => void;
}

exportable function useUnsavedWarning({
  hasUnsaved,
  onConfirmLeave,
  onCancelLeave
}: UseUnsavedWarningOptions) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const handleClose = useCallback((action: () => void) => {
    if (hasUnsaved) {
      setPendingAction(() => action);
      setConfirmOpen(true);
    } else {
      action();
    }
  }, [hasUnsaved]);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    onConfirmLeave?.();
    pendingAction?.();
  }, [onConfirmLeave, pendingAction]);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
    onCancelLeave?.();
  }, [onCancelLeave]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const ConfirmModal = useMemo(() => {
    if (!confirmOpen) return null;
    return (
      <Modal
        title="确认离开"
        open
        onOk={handleConfirm}
        onCancel={handleCancel}
        okText="离开"
        cancelText="继续编辑"
      >
        <Typography.Paragraph>
          当前有未保存的更改，离开后这些更改将丢失。
        </Typography.Paragraph>
      </Modal>
    );
  }, [confirmOpen, handleConfirm, handleCancel]);

  return { handleClose, ConfirmModal };
}
```

---

### 方案2: 页面级重构

#### 2.1 角色管理页面重构

**当前问题**:
- 成员分配使用纯文本域
- 权限配置说明缺失
- 角色类型无预设

**重构方案**:

```typescript
// pages/RolesPage.tsx (重构版)

// 角色类型预设权限
const roleTypePresets: Record<RoleItem["roleType"], ActionType[]> = {
  BUSINESS_OPERATOR: ["VIEW", "CONFIG"],
  BUSINESS_CONFIG: ["VIEW", "CONFIG", "VALIDATE"],
  BUSINESS_MANAGER: ["VIEW", "CONFIG", "VALIDATE", "PUBLISH"],
  BUSINESS_AUDITOR: ["AUDIT_VIEW", "RISK_CONFIRM"],
  BUSINESS_SUPER_ADMIN: ["VIEW", "CONFIG", "VALIDATE", "PUBLISH", "ROLE_MANAGE"],
  PLATFORM_SUPPORT: ["VIEW", "CONFIG", "VALIDATE", "PUBLISH", "DISABLE", "DEFER", "ROLLBACK"]
};

// 权限说明映射
const permissionDescriptions: Record<ActionType, string> = {
  VIEW: "查看配置详情",
  CONFIG: "配置和编辑",
  VALIDATE: "执行校验",
  PUBLISH: "发布配置",
  DISABLE: "停用配置",
  DEFER: "延期处理",
  ROLLBACK: "回滚操作",
  AUDIT_VIEW: "查看审计日志",
  RISK_CONFIRM: "确认风险",
  ROLE_MANAGE: "角色管理"
};

// 成员选择组件
function MemberSelector({ value, onChange }: MemberSelectorProps) {
  const [searchValue, setSearchValue] = useState("");
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);

  return (
    <div>
      <Select
        mode="multiple"
        value={value}
        onChange={onChange}
        options={availableMembers.map(m => ({
          label: `${m.name} (${m.department})`,
          value: m.id,
          // 支持头像显示
          avatar: m.avatar
        }))}
        showSearch
        onSearch={setSearchValue}
        filterOption={false}
        style={{ width: "100%" }}
      >
        {availableMembers.map(member => (
          <Select.Option key={member.id} value={member.id}>
            <Space>
              <Avatar src={member.avatar} size="small" />
              <span>{member.name}</span>
              <Tag color="blue">{member.department}</Tag>
            </Space>
          </Select.Option>
        ))}
      </Select>
    </div>
  );
}

// 角色表单中应用预设
function RoleForm() {
  const [form] = Form.useForm<RoleForm>();

  const handleRoleTypeChange = (roleType: RoleItem["roleType"]) => {
    const presetPermissions = roleTypePresets[roleType];
    form.setFieldsValue({ actions: presetPermissions });
  };

  return (
    <Form form={form} layout="vertical">
      {/* ... 其他字段 ... */}

      <Form.Item
        name="roleType"
        label="角色类型"
        rules={[{ required: true }]}
      >
        onSelect onChange={handleRoleTypeChange}
        <Select options={/* ... */} />
      </Form.Item>

      <Form.Item
        name="actions"
        label="操作类型"
        rules={[{ required: true }]}
      >
        <Select
          mode="multiple"
          options={allActions.map(action => ({
            label: action,
            value: action,
            // 添加权限说明
            description: permissionDescriptions[action]
          }))}
          optionRender={(option) => (
            <Space>
              <span>{option.data.label}</span>
              <Tooltip title={option.data.description}>
                <InfoCircleOutlined style={{ color: "#1890ff" }} />
              </Tooltip>
            </Space>
          )}
        />
      </Form.Item>

      <Form.Item name="members" label="成员列表">
        <MemberSelector />
      </Form.Item>

      {/* 统计字段改为只读 */}
      <ReadOnlyField label="成员数" value={members.length} suffix="人" />
    </Form>
  );
}
```

---

#### 2.2 API注册页面重构

**当前问题**:
- 环境切换不直观
- 弹窗类型不一致
- 出参路径手动输入

**重构方案**:

```typescript
// pages/InterfacesPage.tsx (重构版)

// 环境切换组件
function EnvironmentSwitcher({
  current,
  onChange
}: EnvironmentSwitcherProps) {
  return (
    <Space>
      <Typography.Text>当前环境:</Typography.Text>
      <Segmented
        value={current}
        onChange={onChange}
        options={[
          { label: "测试环境", value: "TEST" },
          { label: "生产环境", value: "PROD" }
        ]}
      />
      <Tag color={current === "TEST" ? "blue" : "green"}>
        {current === "TEST" ? "TEST" : "PROD"}
      </Tag>
    </Space>
  );
}

// 出参路径选择器
function OutputPathSelector({
  availablePaths,
  value,
  onChange
}: OutputPathSelectorProps) {
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Select
        value={value}
        onChange={onChange}
        options={availablePaths.map(path => ({
          label: path,
          value: path,
          // 显示路径结构
          description: formatPathDescription(path)
        }))}
        showSearch
        style={{ width: "100%" }}
        placeholder="选择输出路径或手动输入"
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        手动输入格式: $.data.字段名 或 $.data.array[0].字段名
      </Typography.Text>
    </Space>
  );
}

// 统一使用Drawer
function InterfaceDrawer() {
  const [drawerMode, setDrawerMode] = useState<"edit" | "debug">("edit");

  return (
    <Drawer
      title={
        <Space>
          <span>{editing ? `编辑API注册：${editing.name}` : "新建API注册"}</span>
          <Segmented
            size="small"
            value={drawerMode}
            onChange={(value) => setDrawerMode(value as "edit" | "debug")}
            options={[
              { label: "编辑", value: "edit" },
              { label: "调试", value: "debug" }
            ]}
          />
        </Space>
      }
      open={drawerOpen}
      onClose={closeDrawer}
      width={drawerWidth}
      destroyOnClose
    >
      {drawerMode === "edit" ? <EditMode /> : <DebugMode />}
    </Drawer>
  );
}
```

---

#### 2.3 智能作业页面重构

**当前问题**:
- 节点编排UI层级不清
- 节点属性保存不显眼

**重构方案**:

```typescript
// pages/JobScenesPage.tsx (重构版)

// 使用Steps展示编排流程
function JobBuilderDrawer() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: "基础信息", description: "场景基础配置" },
    { title: "节点编排", description: "流程节点配置" },
    { title: "预览测试", description: "执行前预览" },
    { title: "风险确认", description: "发布前确认" }
  ];

  return (
    <Drawer
      title="作业编排"
      open={builderOpen}
      onClose={() => setBuilderOpen(false)}
      width="90%"
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        {currentStep === 0 && <BasicInfoStep />}
        {currentStep === 1 && <Node编排Step />}
        {currentStep === 2 && <PreviewStep />}
        {currentStep === 3 && <RiskConfirmStep />}
      </Space>

      <Drawer.Footer>
        <Space>
          <Button
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            上一步
          </Button>
          <Button
            type="primary"
            disabled={currentStep === steps.length - 1}
            onClick={() => setCurrentStep(currentStep + 1)}
          >
            下一步
          </Button>
        </Space>
      </Drawer.Footer>
    </Drawer>
  );
}

// 节点编排区域优化
function Node编排Step() {
  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 300px)" }}>
      {/* 节点库独立 */}
      <Card
        title="节点库"
        style={{ width: 200 }}
        bodyStyle={{ display: "flex", flexDirection: "column" }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {nodeLibrary.map(node => (
            <NodeLibraryButton
              key={node.nodeType}
              node={node}
              onAdd={() => addNodeFromLibrary(node.nodeType)}
            />
          ))}
        </Space>
      </Card>

      {/* 流程画布 */}
      <Card title="流程编排" style={{ flex: 1 }} bodyStyle={{ padding: 0 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          /* ... */
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </Card>

      {/* 节点属性固定右侧 */}
      <Card
        title="节点属性"
        style={{ width: 320 }}
        bodyStyle={{ overflowY: "auto" }}
      >
        {!selectedNode ? (
          <Empty description="请选择节点编辑属性" />
        ) : (
          <NodePropertyForm
            node={selectedNode}
            onSave={saveSelectedNode}
            onDelete={removeSelectedNode}
          />
        )}
      </Card>
    </div>
  );
}

// 节点属性表单优化
function NodePropertyForm({ node, onSave, onDelete }: NodePropertyFormProps) {
  const [form] = Form.useForm<NodeDetailForm>();
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const handleValuesChange = () => {
    setHasUnsaved(true);
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Alert
        message={`编辑节点: ${node.name}`}
        description={`类型: ${nodeTypeLabel[node.nodeType]}`}
        type="info"
        showIcon
      />

      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        initialValues={buildFormValuesFromNode(node)}
      >
        <Form.Item name="name" label="节点名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        {/* 类型特定字段 */}

        <Form.Item name="enabled" label="启用状态" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
      </Form>

      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Button
            type="primary"
            block
            onClick={onSave}
            icon={hasUnsaved && <ExclamationCircleOutlined />}
          >
            {hasUnsaved ? "保存属性" : "属性已保存"}
          </Button>
          <Popconfirm
            title="确认删除此节点?"
            onConfirm={onDelete}
          >
            <Button danger block>
              删除节点
            </Button>
          </Popconfirm>
        </Space>
      </div>
    </Space>
  );
}
```

---

## 🎨 设计规范建议

### 4.1 颜色系统

```typescript
const colors = {
  // 主色调
  primary: "#1890ff",
  success: "#52c41a",
  warning: "#faad14",
  error: "#f5222d",
  info: "#1890ff",

  // 环境标识
  environment: {
    test: "#1890ff",
    prod: "#52c41a"
  },

  // 状态颜色
  status: {
    active: "#52c41a",
    disabled: "#faad14",
    draft: "#d9d9d9",
    expired: "#f5222d"
  },

  // 优先级颜色
  priority: {
    high: "#f5222d",
    medium: "#faad14",
    low: "#52c41a"
  },

  // 渐变
  gradient: {
    header: "linear-gradient(95deg, #0f172a 0%, #1e3a8a 55%, #0ea5a4 100%)"
  }
};
```

### 4.2 间距系统

```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};
```

### 4.3 圆角系统

```typescript
const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16
};
```

### 4.4 阴影系统

```typescript
const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px rgba(0, 0, 0, 0.1)",
  lg: "0 12px 30px rgba(15, 23, 42, 0.08)",
  xl: "0 20px 40px rgba(0, 0, 0, 0.15)"
};
```

### 4.5 表格规范

```typescript
interface TableConfig {
  pageSizeOptions: number[];
  defaultPageSize: number;
  showSizeChanger: boolean;
  showQuickJumper: boolean;
  showTotal: boolean;
}

const defaultTableConfig: TableConfig = {
  pageSizeOptions: [6, 10, 20, 50],
  defaultPageSize: 10,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: true
};
```

### 4.6 表单规范

```typescript
// 只读字段标识
const readOnlyFieldStyle = {
  backgroundColor: "#f5f5f5",
  cursor: "not-allowed",
  border: "1px dashed #d9d9d9"
};

// 必填字段标识
const requiredMark = "*";

// 字段验证规则示例
const validationRules = {
  name: [
    { required: true, message: "请输入名称" },
    { max: 128, message: "名称不能超过128字符" }
  ],
  id: [
    { required: true, message: "ID不能为空" },
    { type: "number", message: "ID必须是数字" }
  ],
  url: [
    { required: true, message: "请输入URL" },
    { type: "url", message: "请输入有效的URL" }
  ]
};
```

### 4.7 反馈规范

```typescript
// 消息提示
const messages = {
  success: (text: string) => message.success(text, 3),
  error: (text: string) => message.error(text, 5),
  warning: (text: string) => message.warning(text, 3),
  info: (text: string) => message.info(text, 3)
};

// 确认对话框
const confirmDialogs = {
  delete: (itemName: string, onConfirm: () => void) => {
    Modal.confirm({
      title: "确认删除",
      content: `确认删除 ${itemName}? 此操作不可恢复。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: onConfirm
    });
  },
  statusToggle: (itemName: string, newStatus: string, onConfirm: () => void) => {
    Modal.confirm({
      title: "确认状态切换",
      content: `确认将 ${itemName} 状态切换为 ${newStatus}?`,
      okText: "确认",
      cancelText: "取消",
      onOk: onConfirm
    });
  }
};
```

---

## 📦 组件库规划

### 5.1 基础组件 (src/components/common)

| 组件名 | 用途 | Props |
|--------|------|-------|
| `IDField` | 只读ID字段 | `value, label` |
| `ReadOnlyField` | 只读统计字段 | `label, value, suffix` |
| `StatusTag` | 状态标签 | `status` |
| `EnvironmentSwitcher` | 环境切换 | `current, onChange` |
| `StatusToggleButtonTab` | 状态切换按钮 | `currentStatus, onToggle, resourceName` |
| `UnsavedWarning` | 未保存警告 | `hasUnsaved, onConfirm, onCancel` |

### 5.2 表单组件 (src/components/form)

| 组件名 | 用途 | Props |
|--------|------|-------|
| `MemberSelector` | 成员选择器 | `value, onChange, availableMembers` |
| `OutputPathSelector` | 出参路径选择 | `value, onChange, availablePaths` |
| `PathBuilder` | 路径构建器 | `value, onChange, fields` |
| `CodeEditor` | 代码编辑器 | `value, onChange, language` |

### 5.3 表格组件 (src/components/table)

| 组件名 | 用途 | Props |
|--------|------|-------|
| `ActionTable` | 带操作列的表格 | `dataSource, columns, actions` |
| `EditableTable` | 可编辑表格 | `dataSource, columns, onSave` |
| `ExpandableTable` | 可展开表格 | `dataSource, columns, expandedContent` |

### 5.4 布局组件 (src/components/layout)

| 组件名 | 用途 | Props |
|--------|------|-------|
| `PageHeader` | 页面头部 | `title, description, extra` |
| `FilterBar` | 筛选栏 | `filters, onFilterChange` |
| `ActionBar` | 操作栏 | `actions` |
| `ContentCard` | 内容卡片 | `title, children, extra` |

### 5.5 业务组件 (src/components/business)

| 组件名 | 用途 | Props |
|--------|------|-------|
| `RuleConditionBuilder` | 规则条件构建器 | `value, onChange, availableFields` |
| `NodeLibrary` | 节点库 | `nodes, onAddNode` |
| `FlowCanvas` | 流程画布 | `nodes, edges, onChange` |
| `PropertyPanel` | 属性面板 | `item, onChange` |
| `PreviewPanel` | 预览面板 | `data, onConfirm` |

### 5.6 Hooks (src/hooks)

| Hook名 | 用途 | 返回值 |
|--------|------|--------|
| `useForm` | 表单状态管理 | `values, setValues, reset, submit` |
| `useTable` | 表格状态管理 | `data, loading, pagination, refresh` |
| `useModal` | Modal状态管理 | `open, openModal, closeModal` |
| `useDrawer` | Drawer状态管理 | `open, openDrawer, closeDrawer` |
| `useConfirmation` | 确认对话框 | `confirmDelete, confirmToggle` |
| `useUnsavedWarning` | 未保存警告 | `hasUnsaved, confirmLeave` |

---

## 🗺️ 实施路线图

### Phase 1: 基础重构 (2周)

**目标**: 解决P0级阻断问题

#### Week 1
- [ ] 创建通用组件库
  - [ ] `IDField` 组件
  - [ ] `ReadOnlyField` 组件
  - [ ] `StatusToggleButton` 组件
  - [ ] `useUnsavedWarning` hook

- [ ] 修复ID字段问题
  - [ ] InterfacesPage
  - [ ] RolesPage
  - [ ] PreprocessorsPage
  - [ ] PageResourcesPage
  - [ ] JobScenesPage

#### Week 2
- [ ] 修复统计字段问题
  - [ ] RolesPage - 成员数
  - [ ] PreprocessorsPage - 被引用次数
  - [ ] PageResourcesPage - 元素数量
  - [ ] JobScenesPage - 风险确认状态

- [ ] 添加操作确认
  - [ ] 实现统一确认对话框组件
  - [ ] 应用到所有状态切换操作
  - [ ] 应用到所有删除操作

- [ ] 实现未保存检测
  - [ ] 集成到所有Modal/Drawer
  - [ ] 添加beforeunload事件处理

---

### Phase 2: 体验优化 (3周)

**目标**: 解决P1级体验问题

#### Week 3
- [ ] 角色管理页面优化
  - [ ] 实现成员选择器组件
  - [ ] 添加权限说明Tooltip
  - [ ] 实现角色类型权限预设

- [ ] API注册页面优化
  - [ ] 实现环境切换组件
  - [ ] 添加环境视觉标识

#### Week 4
- [ ] 页面资源中心优化
  - [ ] 实现级联筛选重置逻辑
  - [ ] 添加筛选视觉提示

- [ ] API注册页面继续优化
  - [ ] 统一弹窗类型为Drawer
  - [ ] 实现Tab分页模式

#### Week 5
- [ ] 智能作业页面优化 (部分)
  - [ ] 优化节点编排区域布局
  - [ ] 改进节点属性面板

- [ ] 测试与修复
  - [ ] Phase 1-2 功能测试
  - [ ] 修复发现的问题

---

### Phase 3: 复杂功能优化 (2周)

**目标**: 完成JobScenesPage深度优化

#### Week 6
- [ ] 智能作业页面重构
  - [ ] 实现Steps流程导航
  - [ ] 分离节点库和画布
  - [ ] 固定节点属性面板
  - [ ] 优化保存按钮位置

#### Week 7
- [ ] 预览确认优化
  - [ ] 添加异常字段Tooltip
  - [ ] 改进视觉反馈

- [ ] 悬浮按钮触发优化
  - [ ] 添加操作确认
  - [ ] 改进触发提示

---

### Phase 4: 增强功能 (3周)

**目标**: 实现P2级增强功能

#### Week 8
- [ ] 脚本编辑器集成
  - [ ] 集成 Monaco Editor
  - [ ] 配置语法高亮
  - [ ] 实代码补全
  - [ ] 应用到PreprocessorsPage

#### Week 9
- [ ] 表格功能增强
  - [ ] 实现表格操作Dropdown
  - [ ] 添加分页大小选择
  - [ ] 记住用户偏好

#### Week 10
- [ ] 识别口径构建器
  - [ ] 设计构建器UI
  - [ ] 实现可视化组合
  - [ ] 应用到PageResourcesPage

---

### Phase 5: 收尾与优化 (1周)

**目标**: 整体测试与优化

#### Week 11
- [ ] 全面测试
  - [ ] 功能测试
  - [ ] 性能测试
  - [ ] 兼容性测试

- [ ] 文档更新
  - [ ] 组件使用文档
  - [ ] 设计规范文档
  - [ ] 变更日志

- [ ] 上线准备
  - [ ] 代码审查
  - [ ] 灰度发布
  - [ ] 监控配置

---

## ✅ 验收标准

### 功能验收

- [ ] ID字段在所有页面均为只读
- [ ] 统计字段在所有页面均为只读
- [ ] 所有关键操作都有确认对话框
- [ ] 所有表单关闭前检测未保存更改
- [ ] 成员管理使用选择器而非文本域
- [ ] 权限配置有说明文字
- [ ] 环境切换有视觉反馈
- [ ] 级联筛选正确重置
- [ ] 弹窗类型统一为Drawer
- [ ] 节点编排UI层级清晰
- [ ] 表格支持分页大小调整
- [ ] 异常字段有悬停提示

### 性能验收

- [ ] 页面首屏加载 < 2s
- [ ] 表格渲染 1000条数据 < 1s
- [ ] 表单提交响应 < 500ms
- [ ] 组件重新渲染次数最小化

### 兼容性验收

- [ ] Chrome 最新版 ✓
- [ ] Firefox 最新版 ✓
- [ ] Safari 最新版 ✓
- [ ] Edge 最新版 ✓

### 可访问性验收

- [ ] 所有交互元素有键盘支持
- [ ] 表单字段有正确的label关联
- [ ] 错误信息有屏幕阅读器支持
- [ ] 颜色对比度符合WCAG 2.0 AA标准

---

## 📚 附录

### A. 相关文件清单

```
src/
├── components/
│   ├── AppShell.tsx              # 应用外壳组件
│   ├── common/                   # 通用组件 (新增)
│   ├── form/                     # 表单组件 (新增)
│   ├── table/                    # 表格组件 (新增)
│   ├── layout/                   # 布局组件 (新增)
│   └── business/                 # 业务组件 (新增)
├── hooks/                       # 自定义Hooks (新增)
├── pages/
│   ├── DashboardPage.tsx          # 总览页面
│   ├── PageResourcesPage.tsx      # 页面资源中心
│   ├── InterfacesPage.tsx         # API注册
│   ├── PreprocessorsPage.tsx      # 预处理器中心
│   ├── RulesPage.tsx             # 智能提示
│   ├── JobScenesPage.tsx         # 智能作业
│   ├── GovernancePage.tsx         # 治理工作台
│   ├── AuditMetricsPage.tsx       # 审计与指标中心
│   └── RolesPage.tsx             # 角色管理
├── services/
│   ├── configCenterService.ts     # 配置中心服务
│   └── workflowService.ts         # 工作流服务
├── types/
│   └── index.ts                  # 类型定义
└── utils/
    └── index.ts                  # 工具函数
```

### B. 技术债务清单

| 债务项 | 优先级 | 预估工时 | 备注 |
|--------|-------|---------|------|
| 移除内联样式 | P2 | 2d | 统一使用styled-components |
| 拆分大组件 | P2 | 3d | RulesPage、JobScenesPage过大 |
| 添加单元测试 | P2 | 1w | 覆盖率目标80% |
| 国际化支持 | P3 | 2w | 添加i18多语言 |
| 主题定制 | P3 | 1w | 支持暗色模式 |
| 性能优化 | P2 | 3d | 虚拟滚动、懒加载 |

### C. 参考资料

- [Ant Design 5 文档](https://ant.design/components/overview-cn/)
- [React 官方文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Web Content Accessibility Guidelines (WCAG 2.0)](https://www.w3.org/TR/WCAG20/)
- [React Flow 文档](https://reactflow.dev/)

---

**文档版本**: v1.0
**最后更新**: 2026-03-13
**维护者**: Frontend Team
