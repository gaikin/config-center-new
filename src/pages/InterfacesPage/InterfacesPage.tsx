import { Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import { useInterfacesPageModel } from "./useInterfacesPageModel";
import { defaultOutputParam, DebugEnv, InputTabKey, statusColor, StatusFilter, tabLabels, valueTypeOptions } from "./interfacesPageShared";
import type { ApiInputParam, ApiOutputParam, ApiValueType, InterfaceDefinition } from "../../types";

export function InterfacesPage() {
  const { holder, statusFilter, setStatusFilter, openCreate, loading, filteredRows, openEdit, openDebug, switchStatus, editing, drawerWidth, drawerOpen, closeDrawer, submit, form, inputTab, setInputTab, parseBodyTemplate, addInputRow, inputColumns, inputConfig, addOutputRow, outputSampleJson, setOutputSampleJson, parseOutputSample, outputConfig, updateOutputRow, openOutputProperty, removeOutputRow, propertyOpen, setPropertyOpen, saveOutputProperty, setPropertyRows, propertyRows, debugTarget, debugOpen, setDebugOpen, runDebug, debugEnv, setDebugEnv, debugPayload, setDebugPayload, debugResult } = useInterfacesPageModel();
  return (
    <div>
      {holder}
      <Typography.Title level={4}>API注册</Typography.Title>
      <Typography.Paragraph type="secondary">
        API注册统一复用于智能提示与智能作业。支持测试/生产路径分离、入参四分栏配置、Body/出参 JSON 解析及列表调试。
      </Typography.Paragraph>

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
            <Button type="primary" onClick={openCreate}>
              新建API注册
            </Button>
          </Space>
        }
      >
        <Table<InterfaceDefinition>
          rowKey="id"
          loading={loading}
          dataSource={filteredRows}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "API名称", dataIndex: "name", width: 180 },
            {
              title: "方法与路径",
              width: 320,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
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
            { title: "入参概览", dataIndex: "paramSourceSummary", width: 230 },
            { title: "出参路径", dataIndex: "responsePath", width: 180 },
            {
              title: "状态",
              width: 100,
              render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag>
            },
            {
              title: "操作",
              width: 260,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button size="small" onClick={() => openDebug(row)}>
                    调试
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
        title={editing ? `编辑API注册：${editing.name}` : "新建API注册"}
        placement="right"
        width={drawerWidth}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeDrawer}>取消</Button>
            <Button type="primary" onClick={() => void submit()}>
              保存接口
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} lg={9}>
              <Card title="基本信息" style={{ marginBottom: 12 }}>
                <Form.Item name="id" label="ID" rules={[{ required: true, message: "请输入 ID" }]}>
                  <InputNumber style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                  <Input maxLength={128} />
                </Form.Item>
                <Form.Item name="description" label="描述" rules={[{ required: true, message: "请输入描述" }]}>
                  <Input.TextArea rows={3} maxLength={300} />
                </Form.Item>
                <Form.Item name="method" label="方法" rules={[{ required: true, message: "请选择方法" }]}>
                  <Select options={["GET", "POST", "PUT", "DELETE"].map((v) => ({ label: v, value: v }))} />
                </Form.Item>
                <Form.Item name="testPath" label="测试环境路径" rules={[{ required: true, message: "请输入测试环境路径" }]}>
                  <Input placeholder="如 /test/risk/score/query" />
                </Form.Item>
                <Form.Item name="prodPath" label="生产环境路径" rules={[{ required: true, message: "请输入生产环境路径" }]}>
                  <Input placeholder="如 /risk/score/query" />
                </Form.Item>
                <Form.Item name="timeoutMs" label="超时(ms)" rules={[{ required: true, message: "请输入超时" }]}>
                  <InputNumber min={1} max={5000} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="retryTimes" label="重试次数" rules={[{ required: true, message: "请输入重试次数" }]}>
                  <InputNumber min={0} max={3} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="maskSensitive" label="敏感字段脱敏" valuePropName="checked">
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
                <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
                  <Select
                    options={[
                      { label: "DRAFT", value: "DRAFT" },
                      { label: "ACTIVE", value: "ACTIVE" },
                      { label: "DISABLED", value: "DISABLED" },
                      { label: "EXPIRED", value: "EXPIRED" }
                    ]}
                  />
                </Form.Item>
                <Form.Item name="ownerOrgId" label="组织范围" rules={[{ required: true, message: "请输入组织范围" }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="currentVersion" label="当前版本" rules={[{ required: true, message: "请输入版本" }]}>
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Card>
            </Col>

            <Col xs={24} lg={15}>
              <Card title="输入参数配置" style={{ marginBottom: 12 }}>
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

                        <Table<ApiInputParam>
                          rowKey="id"
                          pagination={false}
                          size="small"
                          columns={inputColumns(tab)}
                          dataSource={inputConfig[tab]}
                          scroll={{ x: 960 }}
                          locale={{ emptyText: "暂无参数，点击上方按钮添加" }}
                        />
                      </div>
                    )
                  }))}
                />
              </Card>

              <Card
                title="输出参数配置"
                extra={
                  <Space>
                    <Button onClick={addOutputRow}>新增出参</Button>
                  </Space>
                }
              >
                <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  支持直接解析返回 JSON，也支持手动补充。对象/数组类型可继续细化属性。
                </Typography.Paragraph>
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
                  scroll={{ x: 980 }}
                  dataSource={outputConfig}
                  locale={{ emptyText: "暂无出参，点击新增或解析 JSON" }}
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
                        <Input
                          value={row.description}
                          onChange={(event) => updateOutputRow(row.id, { description: event.target.value })}
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
            </Col>
          </Row>
        </Form>
      </Drawer>

      <Modal
        title="细化对象属性"
        open={propertyOpen}
        width={900}
        onCancel={() => setPropertyOpen(false)}
        onOk={saveOutputProperty}
      >
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
                    setPropertyRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item))
                    )
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
                    setPropertyRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, path: event.target.value } : item))
                    )
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
        title={debugTarget ? `API调试：${debugTarget.name}` : "API调试"}
        open={debugOpen}
        width={980}
        onCancel={() => setDebugOpen(false)}
        onOk={runDebug}
        okText="执行调试"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Card size="small" title="调试环境">
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
            <Input.TextArea
              rows={8}
              value={debugPayload}
              onChange={(event) => setDebugPayload(event.target.value)}
              placeholder="输入调试请求 JSON"
            />
          </Card>

          {debugResult ? (
            <Row gutter={12}>
              <Col span={12}>
                <Card size="small" title="请求预览">
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    耗时：{debugResult.latencyMs} ms
                  </Typography.Paragraph>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(
                      {
                        path: debugResult.requestPath,
                        body: debugResult.requestBody
                      },
                      null,
                      2
                    )}
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
            <Typography.Text type="secondary">点击“执行调试”后会展示请求和响应结果。</Typography.Text>
          )}
        </Space>
      </Modal>
    </div>
  );
}
