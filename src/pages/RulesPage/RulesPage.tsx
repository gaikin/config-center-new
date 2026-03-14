import { Alert, Button, Card, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Steps, Table, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { lifecycleLabelMap, lifecycleOptions, promptModeLabelMap } from "../../enumLabels";
import { configCenterService } from "../../services/configCenterService";
import { RulesPageMode, useRulesPageModel } from "./useRulesPageModel";
import { InterfaceInputParamDraft, LOGIC_OPERATOR_WIDTH, deriveMachineKeyFromOutputPath, normalizeOperator, normalizeSourceType, closeModeLabel, contextOptions, operatorOptions, sourceOptions, statusColor, valueTypeOptions } from "./rulesPageShared";
import { OperandPill, InterfaceInputValueEditor } from "./rulesOperandRenderers";
import type { RuleDefinition, RuleLogicType, RuleOperandValueType } from "../../types";

type RulesPageProps = {
  mode?: RulesPageMode;
  embedded?: boolean;
  initialPageResourceId?: number;
  initialTemplateRuleId?: number;
  initialSceneId?: number;
  autoOpenCreate?: boolean;
};

export function RulesPage({
  mode = "PAGE_RULE",
  embedded = false,
  initialPageResourceId,
  initialTemplateRuleId,
  initialSceneId,
  autoOpenCreate
}: RulesPageProps) {
  const {
    holder,
    logicDrawerWidth,
    loading,
    rows,
    templates,
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
    applyTemplate,
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
  } = useRulesPageModel(mode, { initialPageResourceId, initialTemplateRuleId, initialSceneId, autoOpenCreate });
  const isTemplateMode = mode === "TEMPLATE";
  const pageTitle = isTemplateMode ? "模板复用" : "智能提示";
  const pageDescription = isTemplateMode
    ? "沉淀高复用规则模板。模板仅引用公共字段，供业务人员在新建页面规则时快速套用。"
    : "规则配置以页面规则为主；新建时可快速复用模板，自动带入条件与提示配置，无需先专门建立模板。";
  const createButtonLabel = isTemplateMode ? "新建模板" : "新建规则";
  const modalTitle = editing ? (isTemplateMode ? "编辑规则模板" : "编辑规则") : isTemplateMode ? "新建规则模板" : "新建规则";
  const modalAlert = isTemplateMode
    ? {
        message: "模板中心面向高复用规则沉淀。",
        description: "模板只允许使用公共字段，不绑定具体页面；业务人员建规则时可选择模板，自动带入条件逻辑和提示配置。"
      }
    : {
        message: "以页面规则为主，新建时可直接套用模板。",
        description: "模板是快捷来源，不是业务人员的主操作对象；选择模板后会自动带入条件逻辑、提示方式和关闭策略。"
      };
  const [wizardStep, setWizardStep] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ matched: boolean; detail: string } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setWizardStep(0);
    setPreviewResult(null);
  }, [open, editing?.id, isTemplateMode]);

  const stepItems = useMemo(() => {
    if (isTemplateMode) {
      return [];
    }
    return [{ title: "选页面" }, { title: "改内容" }, { title: "预览" }, { title: "保存" }];
  }, [isTemplateMode]);

  async function runWizardPreview() {
    const values = await ruleForm.validateFields([
      "name",
      "ruleSetCode",
      "priority",
      "promptMode",
      "closeMode",
      "hasConfirmButton",
      "status",
      "ownerOrgId",
      ...(ruleForm.getFieldValue("closeMode") === "TIMER_THEN_MANUAL" ? ["closeTimeoutSec"] : []),
      ...(ruleForm.getFieldValue("hasConfirmButton") ? ["sceneId"] : [])
    ]);

    setPreviewLoading(true);
    try {
      if (editing) {
        const result = await configCenterService.previewRule(editing.id);
        setPreviewResult({
          matched: result.matched,
          detail: result.detail
        });
      } else {
        setPreviewResult({
          matched: true,
          detail: `规则「${values.name}」预览通过：已完成字段完整性检查，可继续保存。`
        });
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleWizardNext() {
    if (wizardStep === 0) {
      await ruleForm.validateFields(["pageResourceId"]);
      setWizardStep(1);
      return;
    }
    if (wizardStep === 1) {
      await ruleForm.validateFields([
        "name",
        "ruleSetCode",
        "priority",
        "promptMode",
        "closeMode",
        "hasConfirmButton",
        "status",
        "ownerOrgId",
        ...(ruleForm.getFieldValue("closeMode") === "TIMER_THEN_MANUAL" ? ["closeTimeoutSec"] : []),
        ...(ruleForm.getFieldValue("hasConfirmButton") ? ["sceneId"] : [])
      ]);
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      await runWizardPreview();
      setWizardStep(3);
      return;
    }
    await submitRule();
  }
  return (
    <div>
      {holder}
      {!embedded ? (
        <>
          <Typography.Title level={4}>{pageTitle}</Typography.Title>
          <Typography.Paragraph type="secondary">{pageDescription}</Typography.Paragraph>
        </>
      ) : null}

      <Card
        extra={
          <Tooltip title={createButtonLabel}>
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
            { title: isTemplateMode ? "模板名称" : "规则名称", dataIndex: "name", width: 200 },
            { title: "规则集编码", dataIndex: "ruleSetCode", width: 180 },
            ...(isTemplateMode
              ? [
                  {
                    title: "字段范围",
                    width: 140,
                    render: () => <Tag color="blue">仅公共字段</Tag>
                  }
                ]
              : [
                  {
                    title: "页面资源",
                    width: 160,
                    render: (_: unknown, row: RuleDefinition) =>
                      row.pageResourceName ?? <Typography.Text type="secondary">未绑定页面</Typography.Text>
                  },
                  {
                    title: "来源模板",
                    width: 160,
                    render: (_: unknown, row: RuleDefinition) =>
                      row.sourceRuleName ?? <Typography.Text type="secondary">独立规则</Typography.Text>
                  }
                ]),
            { title: "优先级", dataIndex: "priority", width: 90 },
            {
              title: "提示模式",
              dataIndex: "promptMode",
              width: 100,
              render: (value: RuleDefinition["promptMode"]) => promptModeLabelMap[value]
            },
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
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
            },
            {
              title: "操作",
              width: 360,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>
                    {isTemplateMode ? "编辑模板" : "编辑基础"}
                  </Button>
                  <Button size="small" onClick={() => void openLogic(row)}>
                    {isTemplateMode ? "编辑模板条件" : "高级条件"}
                  </Button>
                  <Popconfirm
                    title={row.status === "ACTIVE" ? `确认停用该${isTemplateMode ? "模板" : "规则"}？` : `确认启用该${isTemplateMode ? "模板" : "规则"}？`}
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
        title={modalTitle}
        open={open}
        onCancel={closeRuleModal}
        width={720}
        footer={
          isTemplateMode
            ? [
                <Button key="cancel" onClick={closeRuleModal}>
                  取消
                </Button>,
                <Button key="save" type="primary" onClick={() => void submitRule()}>
                  保存
                </Button>
              ]
            : [
                <Button
                  key="back"
                  onClick={() => {
                    if (wizardStep === 0) {
                      closeRuleModal();
                      return;
                    }
                    setWizardStep((prev) => Math.max(prev - 1, 0));
                  }}
                >
                  {wizardStep === 0 ? "取消" : "上一步"}
                </Button>,
                <Button key="next" type="primary" loading={wizardStep === 2 && previewLoading} onClick={() => void handleWizardNext()}>
                  {wizardStep === 3 ? "保存规则" : "下一步"}
                </Button>
              ]
        }
      >
        <Form form={ruleForm} layout="vertical">
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {modalAlert.message} {modalAlert.description}
          </Typography.Paragraph>
          <Form.Item hidden name="ruleScope">
            <Input />
          </Form.Item>

          {!isTemplateMode ? <Steps current={wizardStep} size="small" items={stepItems} style={{ marginBottom: 12 }} /> : null}

          {isTemplateMode || wizardStep === 0 ? (
            !editing && !isTemplateMode ? (
              <>
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
                <Form.Item name="templateRuleId" label="场景模板">
                  <Select
                    allowClear
                    showSearch
                    placeholder={templates.length > 0 ? "可选：套用已沉淀模板" : "暂无可复用模板"}
                    optionFilterProp="label"
                    options={templates.map((item) => ({
                      label: `${item.name}（${item.ruleSetCode}）`,
                      value: item.id
                    }))}
                    onChange={(value) => applyTemplate(value as number | undefined)}
                  />
                </Form.Item>
              </>
            ) : !isTemplateMode ? (
              <>
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
                <Form.Item label="来源模板">
                  <Input value={editing?.sourceRuleName ?? "独立规则"} readOnly />
                </Form.Item>
              </>
            ) : (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                模板不绑定页面，只能使用公共字段。需要页面特有字段时，请在页面规则里补充。
              </Typography.Paragraph>
            )
          ) : null}

          {isTemplateMode || wizardStep === 1 ? (
            <>
              <Form.Item name="name" label={isTemplateMode ? "模板名称" : "规则名称"} rules={[{ required: true, message: `请输入${isTemplateMode ? "模板" : "规则"}名称` }]}>
                <Input />
              </Form.Item>
              <Form.Item name="ruleSetCode" label="规则集编码" rules={[{ required: true, message: "请输入规则集编码" }]}>
                <Input placeholder="如：loan_high_risk_prompt" />
              </Form.Item>
              <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                <InputNumber min={1} max={999} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="promptMode" label="提示模式" rules={[{ required: true }]}>
                <Select options={[{ label: promptModeLabelMap.SILENT, value: "SILENT" }, { label: promptModeLabelMap.FLOATING, value: "FLOATING" }]} />
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
                <Select options={lifecycleOptions} />
              </Form.Item>
              <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              {!isTemplateMode ? (
                <Button onClick={() => (editing ? void openLogic(editing) : undefined)} disabled={!editing}>
                  配置高级条件
                </Button>
              ) : null}
            </>
          ) : null}

          {!isTemplateMode && wizardStep === 2 ? (
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Alert
                showIcon
                type={previewResult?.matched ? "success" : "info"}
                message={previewResult?.matched ? "预览通过" : "请执行预览"}
                description={previewResult?.detail ?? "保存前建议先执行一次预览，确认规则表达和触发方式。"}
              />
              <Space>
                <Button loading={previewLoading} type="primary" onClick={() => void runWizardPreview()}>
                  执行预览
                </Button>
                <Button onClick={() => (editing ? void openLogic(editing) : undefined)} disabled={!editing}>
                  编辑高级条件
                </Button>
              </Space>
            </Space>
          ) : null}

          {!isTemplateMode && wizardStep === 3 ? (
            <Card size="small" title="保存确认">
              {(() => {
                const summaryPromptMode = ruleForm.getFieldValue("promptMode") as RuleDefinition["promptMode"] | undefined;
                const summaryCloseMode = ruleForm.getFieldValue("closeMode") as RuleDefinition["closeMode"] | undefined;
                const summaryStatus = ruleForm.getFieldValue("status") as RuleDefinition["status"] | undefined;
                return (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Tag color="blue">{ruleForm.getFieldValue("name")}</Tag>
                <Typography.Text type="secondary">
                  页面：{
                    resources.find((item) => item.id === ruleForm.getFieldValue("pageResourceId"))?.name ?? "未绑定页面"
                  }
                </Typography.Text>
                <Typography.Text type="secondary">
                  提示模式：{summaryPromptMode ? promptModeLabelMap[summaryPromptMode] : "-"} / 关闭方式：
                  {summaryCloseMode ? closeModeLabel[summaryCloseMode] : "-"}
                </Typography.Text>
                <Typography.Text type="secondary">
                  状态：{summaryStatus ? lifecycleLabelMap[summaryStatus] : "-"}，组织范围：{ruleForm.getFieldValue("ownerOrgId")}
                </Typography.Text>
              </Space>
                );
              })()}
            </Card>
          ) : null}
        </Form>
      </Modal>

      <Drawer
        title={currentRule ? `${isTemplateMode ? "模板高级条件" : "高级条件"}: ${currentRule.name}` : isTemplateMode ? "模板高级条件" : "高级条件"}
        placement="right"
        width={logicDrawerWidth}
        open={logicOpen}
        onClose={closeLogicDrawer}
      >
        <Card
          title="高级条件配置（单层）"
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
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            所有条件共用一套“且/或”关系。多个提示同时命中时，会按优先级依次展示。
          </Typography.Paragraph>

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
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {conditionsDraft.map((condition, index) => (
                  <Card
                    key={condition.id}
                    size="small"
                    style={{
                      borderColor:
                        selectedOperand?.conditionId === condition.id ? "var(--cc-source-selected, #84CAFF)" : "#f0f0f0"
                    }}
                    bodyStyle={{ padding: 12 }}
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
                <Typography.Text type="secondary">先在左侧点击要编辑的左值或右值。</Typography.Text>
              ) : (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Typography.Text type="secondary">
                    当前正在编辑：条件 {selectedContext.index + 1} - {selectedContext.side === "left" ? "左值" : "右值"}
                  </Typography.Text>

                  <div>
                    <Typography.Text>来源类型</Typography.Text>
                    <Select
                      style={{ width: "100%", marginTop: 8 }}
                      value={selectedContext.operand.sourceType}
                      options={sourceOptions}
                      onChange={(value) => changeSelectedSourceType(normalizeSourceType(value))}
                    />
                  </div>

                  <div>
                    <Typography.Text>值类型</Typography.Text>
                    {selectedContext.operand.sourceType === "INTERFACE_FIELD" ? (
                      <Input style={{ marginTop: 8 }} value={selectedContext.operand.valueType} readOnly />
                    ) : (
                      <Select
                        style={{ width: "100%", marginTop: 8 }}
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
                        style={{ marginTop: 8 }}
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
                        style={{ width: "100%", marginTop: 8 }}
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
                        style={{ width: "100%", marginTop: 8 }}
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
                          style={{ width: "100%", marginTop: 8 }}
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
                          style={{ width: "100%", marginTop: 8 }}
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
                          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                            当前 API 没有配置入参，可直接继续。
                          </Typography.Paragraph>
                        ) : (
                          <Table<InterfaceInputParamDraft>
                            size="small"
                            style={{ marginTop: 8 }}
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
                      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
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

