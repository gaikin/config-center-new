# 智能提示条件编辑区 UI 规范

> 更新时间：2026-03-12  
> 适用范围：配置中心前端 `RulesPage` 条件编辑抽屉中的“条件链路”区域

## 1. 目标
1. 左值/右值使用固定宽度，避免随容器尺寸自适应造成布局抖动。
2. 逻辑运算符宽度收敛，避免挤占左右值展示空间。
3. 删除操作改为图标并固定在最右侧，不允许溢出卡片边框。
4. 条件行整体禁止出现横向滚动条。

## 2. 条件行布局规范
1. 条件行容器必须为单行 Flex 布局：`display: flex`、`alignItems: center`、`gap: 8`、`flexWrap: nowrap`。
2. 条件行容器必须限制在卡片内容宽度内：`width: 100%`、`minWidth: 0`、`overflow: hidden`。
3. 条件行不允许因为内容增长出现横向滚动条。

## 3. 左值/右值（Operand Pill）规范
1. 左值与右值胶囊统一固定宽度：`width = minWidth = maxWidth = 320px`。
2. 来源标签文本不可压缩：`flexShrink: 0`。
3. 主内容文本使用省略策略：`flex: 1`、`minWidth: 0`、`overflow: hidden`、`textOverflow: ellipsis`、`whiteSpace: nowrap`。
4. 左值与右值在任意窗口宽度下应保持视觉宽度一致。

## 4. 逻辑运算符（Operator）规范
1. 运算符下拉框宽度固定为 `92px`。
2. 运算符下拉框使用固定三值约束：`width = minWidth = maxWidth = 92px`。
3. 运算符控件不得随容器宽度变化而扩展或压缩。

## 5. 删除操作规范
1. 删除控件使用图标按钮，不显示“删除”文字。
2. 图标按钮样式：`type="text"`、`danger`、`size="small"`、`icon=<DeleteOutlined />`。
3. 删除按钮必须固定在条件行最右侧：`marginLeft: auto`。
4. 删除按钮不可被压缩：`flexShrink: 0`。
5. 删除按钮需提供可访问性标签：`aria-label="delete-condition"`。

## 6. 实现锚点
1. 文件：`src/pages/RulesPage.tsx`
2. 关键常量：`OPERAND_PILL_WIDTH = 320`、`LOGIC_OPERATOR_WIDTH = 92`
3. 关键实现点：`renderOperandPill`（左右值固定宽度与省略策略）、条件行渲染区（单行布局与删除图标右对齐）

## 7. 验收清单
1. 条件行在常见桌面宽度下无横向滚动条。
2. 左值与右值显示宽度恒定为 320px。
3. 运算符宽度恒定为 92px，且不会挤压左右值为非预期宽度。
4. 删除图标始终贴右显示，不会超出卡片边框。
5. 右值内容过长时正确省略，不换行、不撑破布局。

