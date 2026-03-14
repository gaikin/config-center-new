import { Alert, Button, Card, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useRulesPageModel } from "./useRulesPageModel";
import { InterfaceInputParamDraft, LOGIC_OPERATOR_WIDTH, deriveMachineKeyFromOutputPath, normalizeOperator, normalizeSourceType, closeModeLabel, contextOptions, operatorOptions, sourceOptions, statusColor, valueTypeOptions } from "./rulesPageShared";
import { OperandPill, InterfaceInputValueEditor } from "./rulesOperandRenderers";
import type { RuleDefinition, RuleLogicType, RuleOperandValueType } from "../../types";

export function RulesPage() {
  const {
    holder,
    logicDrawerWidth,
    loading,
    rows,
    resources,
    scenes,
    preprocessors,
    interfaces,
    open,
    editing,
    ruleForm,
    logicOpen,
    currentRule,
    globalLogicType,
    setGlobalLogicType,
    pageFieldOptions,
    conditionsDraft,
    selectedOperand,
    setSelectedOperand,
    savingQuery,
    closeRuleModal,
    closeLogicDrawer,
    openCreate,
    openEdit,
    submitRule,
    switchStatus,
    openLogic,
    addCondition,
    removeCondition,
    selectedContext,
    changeSelectedSourceType,
    addPreprocessorBinding,
    updatePreprocessorBinding,
    removePreprocessorBinding,
    saveConditionLogic,
    selectedOutputPathOptions,
    selectedInterfaceInputParams,
    selectedInterfaceInputConfig,
    updateInterfaceInputValue,
    updateCondition,
    updateSelectedOperand
  } = useRulesPageModel();
  return (
    <div>
      {holder}
      <Typography.Title level={4}>智能提示</Typography.Title>
      <Typography.Paragraph type="secondary">
        智能提示主链路：规则配置、条件命中、提示展示、关闭/确认联动。支持共享规则复用公共字段，页面规则补充页面特有字段。
      </Typography.Paragraph>

      <Card
        extra={
          <Tooltip title="新建规则">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} aria-label="create-rule" />
          </Tooltip>
        }
      >
        <Table<RuleDefinition>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: [6, 10, 20] }}
          columns={[
            { title: "规则名称", dataIndex: "name", width: 200 },
            {
              title: "适用范围",
              width: 120,
              render: (_, row) => <Tag color={row.ruleScope === "SHARED" ? "blue" : "geekblue"}>{row.ruleScope === "SHARED" ? "共享规则" : "页面专用"}</Tag>
            },
            { title: "规则集编码", dataIndex: "ruleSetCode", width: 180 },
            {
              title: "页面资源",
              width: 160,
              render: (_, row) => row.pageResourceName ?? <Typography.Text type="secondary">共享规则</Typography.Text>
            },
            { title: "优先级", dataIndex: "priority", width: 90 },
            { title: "提示模式", dataIndex: "promptMode", width: 100 },
            {
              title: "关闭方式",
              width: 200,
              render: (_, row) =>
                row.closeMode === "TIMER_THEN_MANUAL"
                  ? `${closeModeLabel[row.closeMode]}(${row.closeTimeoutSec ?? "-"}秒)`
                  : closeModeLabel[row.closeMode]
            },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag>
            },
            {
              title: "操作",
              width: 360,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>
                    编辑基础
                  </Button>
                  <Button size="small" onClick={() => void openLogic(row)}>
                    条件编辑
                  </Button>
                  <Popconfirm
                    title={row.status === "ACTIVE" ? "确认停用该规则？" : "确认启用该规则？"}
                    onConfirm={() => void switchStatus(row)}
                  >
                    <Button size="small">{row.status === "ACTIVE" ? "停用" : "启用"}</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editing ? "编辑规则" : "新建规则"}
        open={open}
        onCancel={closeRuleModal}
        onOk={() => void submitRule()}
        width={680}
      >
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ruleSetCode" label="规则集编码" rules={[{ required: true, message: "请输入规则集编码" }]}>
            <Input placeholder="如：loan_high_risk_prompt" />
          </Form.Item>
          <Form.Item name="ruleScope" label="适用范围" rules={[{ required: true, message: "请选择适用范围" }]}>
            <Select
              options={[
                { label: "共享规则（仅公共字段）", value: "SHARED" },
                { label: "页面专用规则（公共字段 + 页面字段）", value: "PAGE_RESOURCE" }
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              ruleForm.getFieldValue("ruleScope") === "PAGE_RESOURCE" ? (
                <Form.Item
                  name="pageResourceId"
                  label="页面资源"
                  rules={[{ required: true, message: "请选择页面资源" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={resources.map((item) => ({ label: item.name, value: item.id }))}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <InputNumber min={1} max={999} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="promptMode" label="提示模式" rules={[{ required: true }]}>
            <Select options={[{ label: "静默", value: "SILENT" }, { label: "浮窗", value: "FLOATING" }]} />
          </Form.Item>
          <Form.Item name="closeMode" label="关闭方式" rules={[{ required: true }]}>
            <Select options={Object.entries(closeModeLabel).map(([value, label]) => ({ label, value }))} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              ruleForm.getFieldValue("closeMode") === "TIMER_THEN_MANUAL" ? (
                <Form.Item
                  name="closeTimeoutSec"
                  label="关闭超时(秒)"
                  rules={[
                    { required: true, message: "超时后关闭必须填写关闭超时时间" },
                    { type: "number", min: 1, message: "关闭超时时间需大于0" }
                  ]}
                >
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="hasConfirmButton" label="确认按钮">
            <Select options={[{ label: "开启", value: true }, { label: "关闭", value: false }]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              ruleForm.getFieldValue("hasConfirmButton") ? (
                <Form.Item name="sceneId" label="关联作业场景">
                  <Select allowClear options={scenes.map((scene) => ({ label: scene.name, value: scene.id }))} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={["DRAFT", "ACTIVE", "DISABLED", "EXPIRED"].map((value) => ({ label: value, value }))} />
          </Form.Item>
          <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={currentRule ? `条件编辑: ${currentRule.name}` : "条件编辑"}
        placement="right"
        width={logicDrawerWidth}
        open={logicOpen}
        onClose={closeLogicDrawer}
      >
        <Card
          title="条件配置（单层）"
          extra={
            <Space>
              <Tooltip title="新增条件">
                <Button icon={<PlusOutlined />} onClick={addCondition} />
              </Tooltip>
              <Button type="primary" loading={savingQuery} onClick={() => void saveConditionLogic()}>
                保存条件逻辑
              </Button>
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            message="全部条件共用一个 AND/OR 关系；多提示命中采用串行策略，按优先级依次展示。"
            style={{ marginBottom: 12 }}
          />

          <Space style={{ marginBottom: 12 }}>
            <Typography.Text strong>整体逻辑</Typography.Text>
            <Select
              style={{ width: 180 }}
              value={globalLogicType}
              options={[
                { label: "AND（全部满足）", value: "AND" },
                { label: "OR（满足任一）", value: "OR" }
              ]}
              onChange={(value) => setGlobalLogicType(value as RuleLogicType)}
            />
          </Space>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 12, alignItems: "start" }}>
            <Card size="small" title="条件链路">
              <Space direction="vertical" style={{ width: "100%" }} size={10}>
                {conditionsDraft.map((condition, index) => (
                  <Card
                    key={condition.id}
                    size="small"
                    style={{
                      borderColor:
                        selectedOperand?.conditionId === condition.id ? "var(--cc-source-selected, #84CAFF)" : "#f0f0f0"
                    }}
                    bodyStyle={{ padding: 10 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", width: "100%", minWidth: 0, overflow: "hidden" }}>
                      <Tag color="blue">条件 {index + 1}</Tag>
                      <OperandPill conditionId={condition.id} side="left" operand={condition.left} selectedOperand={selectedOperand} onSelect={setSelectedOperand} />
                      <Select
                        style={{ width: LOGIC_OPERATOR_WIDTH, minWidth: LOGIC_OPERATOR_WIDTH, maxWidth: LOGIC_OPERATOR_WIDTH }}
                        value={condition.operator}
                        options={operatorOptions}
                        onChange={(value) =>
                          updateCondition(condition.id, (previous) => ({ ...previous, operator: normalizeOperator(value) }))
                        }
                      />
                      {condition.operator === "EXISTS" ? (
                        <Tag>无需右值</Tag>
                      ) : (
                        <OperandPill conditionId={condition.id} side="right" operand={condition.right} selectedOperand={selectedOperand} onSelect={setSelectedOperand} />
                      )}
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        aria-label="delete-condition"
                        style={{ marginLeft: "auto", flexShrink: 0 }}
                        onClick={() => removeCondition(condition.id)}
                      />
                    </div>
                  </Card>
                ))}
              </Space>
            </Card>

            <Card
              size="small"
              title={
                selectedContext ? `${selectedContext.side === "left" ? "左值" : "右值"}属性面板` : "属性面板"
              }
            >
              {!selectedContext ? (
                <Alert type="info" showIcon message="请先选中左值或右值，再在此面板编辑属性。" />
              ) : (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Alert
                    type="info"
                    showIcon
                    message={`当前编辑：条件 ${selectedContext.index + 1} - ${selectedContext.side === "left" ? "左值" : "右值"}`}
                  />

                  <div>
                    <Typography.Text>来源类型</Typography.Text>
                    <Select
                      style={{ width: "100%", marginTop: 6 }}
                      value={selectedContext.operand.sourceType}
                      options={sourceOptions}
                      onChange={(value) => changeSelectedSourceType(normalizeSourceType(value))}
                    />
                  </div>

                  <div>
                    <Typography.Text>值类型</Typography.Text>
                    {selectedContext.operand.sourceType === "INTERFACE_FIELD" ? (
                      <Input style={{ marginTop: 6 }} value={selectedContext.operand.valueType} readOnly />
                    ) : (
                      <Select
                        style={{ width: "100%", marginTop: 6 }}
                        value={selectedContext.operand.valueType}
                        options={valueTypeOptions}
                        onChange={(value) => updateSelectedOperand({ valueType: value as RuleOperandValueType })}
                      />
                    )}
                  </div>

                  {selectedContext.operand.sourceType === "CONST" ? (
                    <div>
                      <Typography.Text>值</Typography.Text>
                      <Input
                        style={{ marginTop: 6 }}
                        placeholder="请输入固定值"
                        value={selectedContext.operand.displayValue}
                        onChange={(event) =>
                          updateSelectedOperand({
                            displayValue: event.target.value,
                            machineKey: event.target.value
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {selectedContext.operand.sourceType === "PAGE_FIELD" ? (
                    <div>
                      <Typography.Text>值（页面字段）</Typography.Text>
                      <Select
                        showSearch
                        allowClear
                        style={{ width: "100%", marginTop: 6 }}
                        placeholder="请选择页面字段"
                        value={selectedContext.operand.displayValue || undefined}
                        optionFilterProp="label"
                        options={pageFieldOptions}
                        onChange={(value) =>
                          updateSelectedOperand({
                            displayValue: (value as string) ?? "",
                            machineKey: (value as string) ?? ""
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {selectedContext.operand.sourceType === "CONTEXT" ? (
                    <div>
                      <Typography.Text>值（上下文变量）</Typography.Text>
                      <Select
                        showSearch
                        allowClear
                        style={{ width: "100%", marginTop: 6 }}
                        placeholder="请选择上下文变量"
                        value={selectedContext.operand.displayValue || undefined}
                        options={contextOptions.map((item) => ({ label: item, value: item }))}
                        onChange={(value) =>
                          updateSelectedOperand({
                            displayValue: (value as string) ?? "",
                            machineKey: (value as string) ?? ""
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {selectedContext.operand.sourceType === "INTERFACE_FIELD" ? (
                    <>
                      <div>
                        <Typography.Text>值（API）</Typography.Text>
                        <Select
                          showSearch
                          allowClear
                          style={{ width: "100%", marginTop: 6 }}
                          placeholder="请选择 API"
                          value={selectedContext.operand.interfaceId}
                          options={interfaces.map((item) => ({ label: item.name, value: item.id }))}
                          onChange={(value) => {
                            const picked = interfaces.find((item) => item.id === value);
                            updateSelectedOperand({
                              interfaceId: value as number | undefined,
                              interfaceName: picked?.name,
                              outputPath: "",
                              machineKey: "",
                              displayValue: "",
                              interfaceInputConfig: "",
                              valueType: "STRING"
                            });
                          }}
                        />
                      </div>

                      <div>
                        <Typography.Text>输出值路径</Typography.Text>
                        <Select
                          showSearch
                          allowClear
                          style={{ width: "100%", marginTop: 6 }}
                          placeholder="请选择API输出路径"
                          value={selectedContext.operand.outputPath || undefined}
                          options={selectedOutputPathOptions}
                          onChange={(value, option) => {
                            const picked = option as { valueType?: RuleOperandValueType } | undefined;
                            const nextPath = (value as string) ?? "";
                            updateSelectedOperand({
                              outputPath: nextPath,
                              machineKey: deriveMachineKeyFromOutputPath(nextPath),
                              valueType: picked?.valueType ?? selectedContext.operand.valueType
                            });
                          }}
                        />
                      </div>

                      <div>
                        <Typography.Text>入参配置（按 API注册定义）</Typography.Text>
                        {selectedInterfaceInputParams.length === 0 ? (
                          <Alert type="info" showIcon style={{ marginTop: 6 }} message="当前API未定义入参或尚未配置。" />
                        ) : (
                          <Table<InterfaceInputParamDraft>
                            size="small"
                            style={{ marginTop: 6 }}
                            rowKey={(row) => `${row.tab}:${row.name}`}
                            pagination={false}
                            dataSource={selectedInterfaceInputParams}
                            columns={[
                              {
                                title: "参数",
                                width: 220,
                                render: (_, row) => (
                                  <Space size={4}>
                                    <Typography.Text>{row.name}</Typography.Text>
                                    {row.required ? <Tag color="error">必填</Tag> : <Tag>可选</Tag>}
                                  </Space>
                                )
                              },
                              {
                                title: "来源",
                                width: 140,
                                render: (_, row) => <Tag>{row.sourceType}</Tag>
                              },
                              {
                                title: "值类型",
                                width: 120,
                                render: (_, row) => <Tag color="blue">{row.valueType}</Tag>
                              },
                              {
                                title: "取值",
                                render: (_, row) => (
                                  <InterfaceInputValueEditor
                                    param={row}
                                    pageFieldOptions={pageFieldOptions}
                                    selectedInterfaceInputConfig={selectedInterfaceInputConfig}
                                    updateInterfaceInputValue={updateInterfaceInputValue}
                                  />
                                )
                              }
                            ]}
                          />
                        )}
                      </div>

                      <Alert
                        type={selectedContext.operand.outputPath?.trim() ? "success" : "warning"}
                        showIcon
                        message={`${selectedContext.operand.interfaceName || "API名称"}.${selectedContext.operand.outputPath || "(未绑定输出值)"}`}
                      />
                    </>
                  ) : null}

                  <div>
                    <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                      <Typography.Text>预处理器</Typography.Text>
                      <Tooltip title="添加预处理器">
                        <Button size="small" icon={<PlusOutlined />} onClick={addPreprocessorBinding} />
                      </Tooltip>
                    </Space>

                    {selectedContext.operand.preprocessors.length === 0 ? (
                      <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                        暂无预处理器
                      </Typography.Paragraph>
                    ) : (
                      <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
                        {selectedContext.operand.preprocessors.map((binding) => (
                          <Space key={binding.id} style={{ width: "100%" }} align="start">
                            <Select
                              showSearch
                              allowClear
                              placeholder="选择预处理器"
                              style={{ flex: 1 }}
                              value={binding.preprocessorId}
                              options={preprocessors.map((item) => ({ label: item.name, value: item.id }))}
                              onChange={(value) => updatePreprocessorBinding(binding.id, { preprocessorId: value as number | undefined })}
                            />
                            <Input
                              style={{ flex: 1 }}
                              placeholder="参数（可选）"
                              value={binding.params}
                              onChange={(event) => updatePreprocessorBinding(binding.id, { params: event.target.value })}
                            />
                            <Tooltip title="删除预处理器">
                              <Button danger icon={<DeleteOutlined />} onClick={() => removePreprocessorBinding(binding.id)} />
                            </Tooltip>
                          </Space>
                        ))}
                      </Space>
                    )}
                  </div>
                </Space>
              )}
            </Card>
          </div>
        </Card>
      </Drawer>
    </div>
  );
}
