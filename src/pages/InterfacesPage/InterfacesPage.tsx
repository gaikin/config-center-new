import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { OrgSelect } from "../../components/DirectoryFields";
import { PublishContinuationAlert } from "../../components/PublishContinuationAlert";
import { ValidationReportPanel } from "../../components/ValidationReportPanel";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { getOrgLabel } from "../../orgOptions";
import { useInterfacesPageModel } from "./useInterfacesPageModel";
import {
  ApiRegisterForm,
  DebugEnv,
  InputTabKey,
  defaultOutputParam,
  statusColor,
  tabLabels,
  valueTypeOptions,
  type StatusFilter
} from "./interfacesPageShared";
import type { ApiOutputParam, ApiValueType, InterfaceDefinition } from "../../types";

const wizardSteps = ["选用途", "基础信息", "参数示例", "在线测试", "保存"];

export function InterfacesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ownerOrgFilter = searchParams.get("ownerOrgId");
  const quickAction = searchParams.get("action");
  const useCase = searchParams.get("useCase");
  const autoOpenCreateRef = useRef(false);
  const [wizardStep, setWizardStep] = useState(0);

  const {
    holder,
    statusFilter,
    setStatusFilter,
    openCreate,
    loading,
    filteredRows,
    openEdit,
    openClone,
    openDebug,
    openDebugDraft,
    switchStatus,
    editing,
    drawerWidth,
    drawerOpen,
    closeDrawer,
    submit,
    form,
    inputTab,
    setInputTab,
    parseBodyTemplate,
    addInputRow,
    inputColumns,
    inputConfig,
    addOutputRow,
    outputSampleJson,
    setOutputSampleJson,
    parseOutputSample,
    outputConfig,
    updateOutputRow,
    openOutputProperty,
    removeOutputRow,
    propertyOpen,
    setPropertyOpen,
    saveOutputProperty,
    setPropertyRows,
    propertyRows,
    debugTarget,
    debugOpen,
    setDebugOpen,
    runDebug,
    debugEnv,
    setDebugEnv,
    debugPayload,
    setDebugPayload,
    debugResult,
    saveValidationReport,
    inputValidationIssues,
    outputValidationIssues,
    publishNotice,
    dismissPublishNotice
  } = useInterfacesPageModel();

  const visibleRows = useMemo(() => {
    if (!ownerOrgFilter) {
      return filteredRows;
    }
    return filteredRows.filter((item) => item.ownerOrgId === ownerOrgFilter);
  }, [filteredRows, ownerOrgFilter]);

  useEffect(() => {
    if (quickAction !== "create" || autoOpenCreateRef.current) {
      return;
    }
    autoOpenCreateRef.current = true;
    openCreate({
      ownerOrgId: ownerOrgFilter ?? "branch-east",
      name: "",
      description: useCase ?? ""
    });
  }, [openCreate, ownerOrgFilter, quickAction, useCase]);

  useEffect(() => {
    if (drawerOpen) {
      setWizardStep(0);
    }
  }, [drawerOpen]);

  async function goNextStep() {
    if (wizardStep === 0) {
      await form.validateFields(["name", "description", "method"]);
    }
    if (wizardStep === 1) {
      await form.validateFields(["testPath", "prodPath", "timeoutMs", "retryTimes", "status", "ownerOrgId"]);
    }
    setWizardStep((prev) => Math.min(prev + 1, wizardSteps.length - 1));
  }

  function useTemplateCreate() {
    openCreate({
      ownerOrgId: ownerOrgFilter ?? "branch-east",
      name: "客户信息查询模板",
      description: "用于表单辅助录入的通用查询接口模板。",
      method: "POST",
      testPath: "/test/customer/profile/query",
      prodPath: "/customer/profile/query"
    });
  }

  return (
    <div>
      {holder}
      <Typography.Title level={4}>API注册</Typography.Title>
      <Typography.Paragraph type="secondary">
        保留 API注册 术语，主流程改为五步向导：选用途 → 填基础信息 → 填参数示例 → 在线测试 → 保存。保存后可前往“发布与灰度”完成发布。
      </Typography.Paragraph>
      {publishNotice ? (
        <PublishContinuationAlert
          objectLabel="API"
          objectName={publishNotice.objectName}
          warningCount={publishNotice.warningCount}
          onGoPublish={() => navigate("/publish")}
          onClose={dismissPublishNotice}
        />
      ) : null}
      {ownerOrgFilter ? (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          message={`已按机构过滤：${getOrgLabel(ownerOrgFilter)}`}
          description="该过滤来自页面管理详情中的“新建关联 API”快捷动作。"
        />
      ) : null}

      <Card
        extra={
          <Space>
            <Segmented
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { label: "全部", value: "ALL" },
                { label: "草稿", value: "DRAFT" },
                { label: "生效", value: "ACTIVE" },
                { label: "停用", value: "DISABLED" },
                { label: "失效", value: "EXPIRED" }
              ]}
            />
            <Button onClick={useTemplateCreate}>从模板创建</Button>
            <Button type="primary" onClick={() => openCreate()}>
              新建 API注册
            </Button>
          </Space>
        }
      >
        <Table<InterfaceDefinition>
          rowKey="id"
          loading={loading}
          dataSource={visibleRows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: ["6", "10", "20"] }}
          columns={[
            { title: "API名称", dataIndex: "name", width: 180 },
            { title: "接口用途", dataIndex: "description", width: 220 },
            {
              title: "方法与路径",
              width: 320,
              render: (_, row) => (
                <Space direction="vertical" size={4}>
                  <Space>
                    <Tag color="geekblue">{row.method}</Tag>
                    <Typography.Text>{row.testPath || "-"}</Typography.Text>
                    <Tag>测试</Tag>
                  </Space>
                  <Space>
                    <Tag color="cyan">{row.method}</Tag>
                    <Typography.Text>{row.prodPath || "-"}</Typography.Text>
                    <Tag color="green">生产</Tag>
                  </Space>
                </Space>
              )
            },
            {
              title: "引用关系",
              width: 240,
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  <Tag>{`页面(${getOrgLabel(row.ownerOrgId)})`}</Tag>
                  <Tag>规则(2)</Tag>
                  <Tag>作业(1)</Tag>
                </Space>
              )
            },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag>
            },
            {
              title: "操作",
              width: 320,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button size="small" onClick={() => openClone(row)}>
                    复制创建
                  </Button>
                  <Button size="small" onClick={() => openDebug(row)}>
                    在线测试
                  </Button>
                  <Button size="small" onClick={() => void switchStatus(row)}>
                    {row.status === "ACTIVE" ? "停用" : "启用"}
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Drawer
        title={editing ? `编辑 API注册：${editing.name}` : "新建 API注册"}
        placement="right"
        width={drawerWidth}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setWizardStep((prev) => Math.max(prev - 1, 0))} disabled={wizardStep === 0}>
              上一步
            </Button>
            {wizardStep < wizardSteps.length - 1 ? (
              <Button type="primary" onClick={() => void goNextStep()}>
                下一步
              </Button>
            ) : (
              <Button type="primary" onClick={() => void submit()}>
                保存接口
              </Button>
            )}
          </Space>
        }
      >
        <Steps
          current={wizardStep}
          size="small"
          style={{ marginBottom: 12 }}
          items={wizardSteps.map((title) => ({ title }))}
        />

        <Form form={form} layout="vertical">
          {wizardStep === 0 ? (
            <ValidationReportPanel report={saveValidationReport} sections={["purpose"]} title="当前步骤还有待处理问题" />
          ) : null}

          {wizardStep === 0 ? (
            <Card title="步骤 1：选用途" size="small">
              <Typography.Paragraph type="secondary">
                先明确接口用途和调用方式，后续再补参数和测试。可先从模板或复制已有 API 创建。
              </Typography.Paragraph>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                <Input maxLength={128} />
              </Form.Item>
              <Form.Item name="description" label="用途说明" rules={[{ required: true, message: "请输入用途说明" }]}>
                <Input.TextArea rows={3} maxLength={300} />
              </Form.Item>
              <Form.Item name="method" label="调用方式" rules={[{ required: true, message: "请选择方法" }]}>
                <Select options={["GET", "POST", "PUT", "DELETE"].map((v) => ({ label: v, value: v }))} />
              </Form.Item>
              <Space>
                <Button onClick={useTemplateCreate}>从常用模板创建</Button>
              </Space>
            </Card>
          ) : null}

          {wizardStep === 1 ? (
            <ValidationReportPanel report={saveValidationReport} sections={["basic"]} title="基础信息还有待处理问题" />
          ) : null}

          {wizardStep === 1 ? (
            <Card title="步骤 2：填基础信息" size="small">
              <Typography.Paragraph type="secondary">
                接口编号和版本由系统自动维护，你只需要填写业务信息。
              </Typography.Paragraph>
              <Row gutter={12}>
                <Col span={24}>
                  <Form.Item name="ownerOrgId" label="机构范围" rules={[{ required: true, message: "请选择机构范围" }]}>
                    <OrgSelect />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="testPath" label="测试环境路径" rules={[{ required: true, message: "请输入测试路径" }]}>
                    <Input placeholder="如 /test/risk/score/query" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="prodPath" label="生产环境路径" rules={[{ required: true, message: "请输入生产路径" }]}>
                    <Input placeholder="如 /risk/score/query" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="timeoutMs" label="超时(ms)" rules={[{ required: true, message: "请输入超时" }]}>
                    <InputNumber min={1} max={5000} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="retryTimes" label="重试次数" rules={[{ required: true, message: "请输入重试次数" }]}>
                    <InputNumber min={0} max={3} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                <Select options={lifecycleOptions} />
              </Form.Item>
              <Form.Item name="maskSensitive" label="敏感字段脱敏" valuePropName="checked">
                <Select options={[{ label: "开启", value: true }, { label: "关闭", value: false }]} />
              </Form.Item>
            </Card>
          ) : null}

          {wizardStep === 2 ? (
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <ValidationReportPanel
                report={saveValidationReport}
                sections={["params"]}
                title="参数示例还有待处理问题"
              />
              <ValidationReportPanel issues={inputValidationIssues} title="请求参数还有待处理问题" />
              <ValidationReportPanel issues={outputValidationIssues} title="返回参数还有待处理问题" />
              <Card title="步骤 3：填参数示例" size="small">
                <Tabs
                  activeKey={inputTab}
                  onChange={(key) => setInputTab(key as InputTabKey)}
                  items={(Object.keys(tabLabels) as InputTabKey[]).map((tab) => ({
                    key: tab,
                    label: tabLabels[tab],
                    children: (
                      <div>
                        {tab === "body" ? (
                          <>
                            <Form.Item name="bodyTemplateJson" label="Body JSON 模板">
                              <Input.TextArea rows={6} placeholder="支持 JSON 解析为 Body 参数" />
                            </Form.Item>
                            <Space style={{ marginBottom: 12 }}>
                              <Button onClick={parseBodyTemplate}>解析 Body JSON</Button>
                              <Button onClick={() => addInputRow("body")}>手动新增 Body 参数</Button>
                            </Space>
                          </>
                        ) : (
                          <Button style={{ marginBottom: 12 }} onClick={() => addInputRow(tab)}>
                            新增{tabLabels[tab]}参数
                          </Button>
                        )}

                        <Table size="small" rowKey="id" pagination={false} columns={inputColumns(tab)} dataSource={inputConfig[tab]} />
                      </div>
                    )
                  }))}
                />
              </Card>

              <Card
                title="返回参数示例"
                size="small"
                extra={
                  <Space>
                    <Button onClick={addOutputRow}>新增出参</Button>
                  </Space>
                }
              >
                <Input.TextArea
                  rows={5}
                  value={outputSampleJson}
                  onChange={(event) => setOutputSampleJson(event.target.value)}
                  placeholder="粘贴返回 JSON 示例"
                />
                <Space style={{ marginTop: 8, marginBottom: 12 }}>
                  <Button onClick={parseOutputSample}>解析返回 JSON</Button>
                </Space>

                <Table<ApiOutputParam>
                  rowKey="id"
                  pagination={false}
                  size="small"
                  dataSource={outputConfig}
                  scroll={{ x: 980 }}
                  columns={[
                    {
                      title: "字段名",
                      width: 170,
                      render: (_, row) => (
                        <Input value={row.name} onChange={(event) => updateOutputRow(row.id, { name: event.target.value })} />
                      )
                    },
                    {
                      title: "路径",
                      width: 260,
                      render: (_, row) => (
                        <Input value={row.path} onChange={(event) => updateOutputRow(row.id, { path: event.target.value })} />
                      )
                    },
                    {
                      title: "描述",
                      width: 160,
                      render: (_, row) => (
                        <Input value={row.description} onChange={(event) => updateOutputRow(row.id, { description: event.target.value })} />
                      )
                    },
                    {
                      title: "类型",
                      width: 120,
                      render: (_, row) => (
                        <Select
                          value={row.valueType}
                          options={valueTypeOptions}
                          onChange={(value) =>
                            updateOutputRow(row.id, {
                              valueType: value as ApiValueType,
                              children: value === "OBJECT" || value === "ARRAY" ? row.children ?? [] : []
                            })
                          }
                        />
                      )
                    },
                    {
                      title: "属性",
                      width: 120,
                      render: (_, row) => (
                        <Button size="small" onClick={() => openOutputProperty(row)}>
                          细化属性
                        </Button>
                      )
                    },
                    {
                      title: "操作",
                      width: 80,
                      render: (_, row) => (
                        <Button danger size="small" onClick={() => removeOutputRow(row.id)}>
                          删除
                        </Button>
                      )
                    }
                  ]}
                />
              </Card>
            </Space>
          ) : null}

          {wizardStep === 3 ? (
            <Card title="步骤 4：在线测试" size="small">
              <Typography.Paragraph type="secondary">
                保存前请执行一次在线测试，确认请求路径、入参与返回结构满足当前用途。
              </Typography.Paragraph>
              <Space>
                <Button type="primary" onClick={openDebugDraft}>
                  使用当前草稿在线测试
                </Button>
                {editing ? (
                  <Button onClick={() => openDebug(editing)}>
                    使用已保存版本测试
                  </Button>
                ) : null}
              </Space>
            </Card>
          ) : null}

          {wizardStep === 4 ? (
            <Card title="步骤 5：保存前确认" size="small">
              <DescriptionsSummary form={form} outputCount={outputConfig.length} report={saveValidationReport} />
            </Card>
          ) : null}
        </Form>
      </Drawer>

      <Modal title="细化对象属性" open={propertyOpen} width={900} onCancel={() => setPropertyOpen(false)} onOk={saveOutputProperty}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          在这里维护对象或数组下的子字段。
        </Typography.Paragraph>
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={() => setPropertyRows((prev) => [...prev, defaultOutputParam()])}>新增属性</Button>
        </Space>
        <Table<ApiOutputParam>
          rowKey="id"
          pagination={false}
          size="small"
          dataSource={propertyRows}
          scroll={{ x: 860 }}
          columns={[
            {
              title: "字段名",
              width: 180,
              render: (_, row) => (
                <Input
                  value={row.name}
                  onChange={(event) =>
                    setPropertyRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)))
                  }
                />
              )
            },
            {
              title: "路径",
              width: 260,
              render: (_, row) => (
                <Input
                  value={row.path}
                  onChange={(event) =>
                    setPropertyRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, path: event.target.value } : item)))
                  }
                />
              )
            },
            {
              title: "描述",
              width: 150,
              render: (_, row) => (
                <Input
                  value={row.description}
                  onChange={(event) =>
                    setPropertyRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, description: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: "类型",
              width: 120,
              render: (_, row) => (
                <Select
                  value={row.valueType}
                  options={valueTypeOptions}
                  onChange={(value) =>
                    setPropertyRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? {
                              ...item,
                              valueType: value as ApiValueType,
                              children: value === "OBJECT" || value === "ARRAY" ? item.children ?? [] : []
                            }
                          : item
                      )
                    )
                  }
                />
              )
            },
            {
              title: "操作",
              width: 80,
              render: (_, row) => (
                <Button danger size="small" onClick={() => setPropertyRows((prev) => prev.filter((item) => item.id !== row.id))}>
                  删除
                </Button>
              )
            }
          ]}
        />
      </Modal>

      <Modal
        title={debugTarget ? `API在线测试：${debugTarget.name}` : "API在线测试"}
        open={debugOpen}
        width={980}
        onCancel={() => setDebugOpen(false)}
        onOk={runDebug}
        okText="执行测试"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Card size="small" title="测试环境">
            <Space>
              <Segmented
                value={debugEnv}
                onChange={(value) => setDebugEnv(value as DebugEnv)}
                options={[
                  { label: "测试环境", value: "TEST" },
                  { label: "生产环境", value: "PROD" }
                ]}
              />
              <Typography.Text type="secondary">
                请求路径：
                {debugTarget ? (debugEnv === "TEST" ? debugTarget.testPath : debugTarget.prodPath) : "-"}
              </Typography.Text>
            </Space>
          </Card>
          <Card size="small" title="请求入参(JSON)">
            <Input.TextArea rows={8} value={debugPayload} onChange={(event) => setDebugPayload(event.target.value)} />
          </Card>
          {debugResult ? (
            <Row gutter={12}>
              <Col span={12}>
                <Card size="small" title="请求预览">
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    耗时：{debugResult.latencyMs} ms
                  </Typography.Paragraph>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify({ path: debugResult.requestPath, body: debugResult.requestBody }, null, 2)}
                  </pre>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="响应预览">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(debugResult.responseBody, null, 2)}</pre>
                </Card>
              </Col>
            </Row>
          ) : (
            <Typography.Text type="secondary">点击“执行测试”后会展示请求和响应结果。</Typography.Text>
          )}
        </Space>
      </Modal>
    </div>
  );
}

function DescriptionsSummary({ form, outputCount, report }: { form: any; outputCount: number; report: any }) {
  const values = form.getFieldsValue() as Partial<ApiRegisterForm>;
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <ValidationReportPanel report={report} title="保存前检查结果" />
      <Alert
        showIcon
        type="info"
        message="确认后保存"
        description="保存后会在列表中展示引用关系，并进入发布与灰度流程。"
      />
      <Space wrap>
        <Tag color="blue">{values.name || "未命名接口"}</Tag>
        <Tag>{values.method || "POST"}</Tag>
        <Tag>{getOrgLabel(values.ownerOrgId)}</Tag>
        <Tag color="purple">出参字段 {outputCount}</Tag>
      </Space>
      <Typography.Text type="secondary">测试路径：{values.testPath || "-"}</Typography.Text>
      <Typography.Text type="secondary">生产路径：{values.prodPath || "-"}</Typography.Text>
    </Space>
  );
}
