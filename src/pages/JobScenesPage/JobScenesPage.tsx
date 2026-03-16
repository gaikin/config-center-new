import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PublishContinuationAlert } from "../../components/PublishContinuationAlert";
import { ValidationReportPanel } from "../../components/ValidationReportPanel";
import { lifecycleLabelMap, lifecycleOptions } from "../../enumLabels";
import { useJobScenesPageModel } from "./useJobScenesPageModel";
import { executionLabel, nodeTypeLabel, StatusFilter } from "./jobScenesPageShared";
import type { JobSceneDefinition, JobScenePreviewField } from "../../types";

export function JobScenesPage() {
  const navigate = useNavigate();
  const {
    holder,
    statusFilter,
    setStatusFilter,
    filteredRows,
    openCreate,
    openEdit,
    switchStatus,
    openBuilder,
    openPreview,
    triggerFloating,
    confirmRisk,
    loading,
    linkedRulesByScene,
    open,
    closeSceneModal,
    submitScene,
    form,
    resources,
    editing,
    builderOpen,
    closeBuilder,
    savingFlow,
    saveFlowLayout,
    autoLayoutNodes,
    builderScene,
    setSelectedNodeId,
    flowNodes,
    flowEdges,
    onFlowNodesChange,
    onFlowEdgesChange,
    onConnect,
    setReactFlowInstance,
    nodeLibrary,
    addNodeFromLibrary,
    selectedNode,
    selectedNodeListData,
    listDatas,
    nodeDetailForm,
    watchedNodeType,
    saveSelectedNode,
    removeSelectedNode,
    previewOpen,
    setPreviewOpen,
    previewScene,
    previewRows,
    previewSelectedKeys,
    setPreviewSelectedKeys,
    previewLoading,
    previewExecuting,
    executePreview,
    drawerWidth,
    statusColor,
    autoOpenCreateRef,
    sceneSaveValidationReport,
    nodeValidationIssues,
    previewValidationIssues,
    publishNotice,
    dismissPublishNotice
  } = useJobScenesPageModel();
  const [searchParams] = useSearchParams();
  const pageResourceFilter = Number(searchParams.get("pageResourceId") ?? "");
  const executionModeParam = searchParams.get("executionMode");
  const sceneNameParam = searchParams.get("sceneName");
  const quickAction = searchParams.get("action");
  const hasPageFilter = Number.isFinite(pageResourceFilter) && pageResourceFilter > 0;
  const presetPageName = resources.find((item) => item.id === pageResourceFilter)?.name;
  const presetExecutionMode = (
    executionModeParam === "AUTO_WITHOUT_PROMPT" ||
    executionModeParam === "AUTO_AFTER_PROMPT" ||
    executionModeParam === "PREVIEW_THEN_EXECUTE" ||
    executionModeParam === "FLOATING_BUTTON"
  )
    ? executionModeParam
    : undefined;

  useEffect(() => {
    if (!hasPageFilter || quickAction !== "create" || autoOpenCreateRef.current) {
      return;
    }
    autoOpenCreateRef.current = true;
    openCreate({
      pageResourceId: pageResourceFilter,
      executionMode: presetExecutionMode,
      name: sceneNameParam ?? undefined
    });
  }, [autoOpenCreateRef, hasPageFilter, openCreate, pageResourceFilter, presetExecutionMode, quickAction, sceneNameParam]);

  const visibleRows = useMemo(() => {
    if (!hasPageFilter) {
      return filteredRows;
    }
    return filteredRows.filter((item) => item.pageResourceId === pageResourceFilter);
  }, [filteredRows, hasPageFilter, pageResourceFilter]);

  const sceneCards = [
    {
      key: "query-fill",
      title: "查询并回填",
      desc: "适合根据页面字段查外部数据并自动回填。",
      mode: "AUTO_AFTER_PROMPT" as const
    },
    {
      key: "multi-assist",
      title: "多字段辅助录入",
      desc: "适合录入前批量补全、格式修正和风险标记。",
      mode: "FLOATING_BUTTON" as const
    },
    {
      key: "preview-confirm",
      title: "预览确认后执行",
      desc: "先预览拟写入值，再确认执行，降低误操作风险。",
      mode: "PREVIEW_THEN_EXECUTE" as const
    }
  ];
  return (
    <div>
      {holder}
      <Typography.Title level={4}>智能作业</Typography.Title>
      <Typography.Paragraph type="secondary">
        从页面上下文进入场景配置，优先表达业务场景与触发方式，再进入高级编排与节点细节。保存后可前往“发布与灰度”完成发布。
      </Typography.Paragraph>
      {publishNotice ? (
        <PublishContinuationAlert
          objectLabel="作业场景"
          objectName={publishNotice.objectName}
          warningCount={publishNotice.warningCount}
          onGoPublish={() => navigate("/publish")}
          onClose={dismissPublishNotice}
        />
      ) : null}
      {hasPageFilter ? (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          message={`已切换到页面：${presetPageName ?? "当前页面"}`}
          description="你可以直接新建该页面的作业配置，系统会自动带入页面；保存后可前往“发布与灰度”完成发布。"
        />
      ) : null}

      <Card title="场景类型（业务视角）" style={{ marginBottom: 12 }}>
        <Space size={[8, 8]} wrap>
          {sceneCards.map((item) => (
            <Card key={item.key} size="small" style={{ width: 300 }} title={item.title}>
              <Space direction="vertical">
                <Typography.Text type="secondary">{item.desc}</Typography.Text>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    openCreate({
                      pageResourceId: hasPageFilter ? pageResourceFilter : undefined,
                      executionMode: item.mode,
                      name: sceneNameParam ?? `${item.title}-${new Date().getTime()}`
                    })
                  }
                >
                  按该场景创建
                </Button>
              </Space>
            </Card>
          ))}
        </Space>
      </Card>

      <Card
        extra={
          <Space>
            <Segmented
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { label: "全部", value: "ALL" },
                { label: "草稿", value: "DRAFT" },
                { label: "启用", value: "ACTIVE" },
                { label: "停用", value: "DISABLED" },
                { label: "过期", value: "EXPIRED" }
              ]}
            />
            <Tooltip title="新建场景">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  openCreate({
                    pageResourceId: hasPageFilter ? pageResourceFilter : undefined,
                    executionMode: presetExecutionMode,
                    name: sceneNameParam ?? undefined
                  })
                }
                aria-label="create-scene"
              />
            </Tooltip>
          </Space>
        }
      >
        <Table<JobSceneDefinition>
          rowKey="id"
          loading={loading}
          dataSource={visibleRows}
          pagination={{ pageSize: 6, showSizeChanger: true, pageSizeOptions: [6, 10, 20] }}
          columns={[
            { title: "场景名称", dataIndex: "name", width: 220 },
            { title: "所属页面", dataIndex: "pageResourceName", width: 160 },
            { title: "执行模式", width: 170, render: (_, row) => <Tag color="blue">{executionLabel[row.executionMode]}</Tag> },
            {
              title: "触发关联",
              width: 240,
              render: (_, row) => {
                const linkedRules = linkedRulesByScene.get(row.id) ?? [];
                if (linkedRules.length === 0) {
                  return <Typography.Text type="secondary">未关联规则</Typography.Text>;
                }
                return (
                  <Space size={[4, 4]} wrap>
                    {linkedRules.map((rule) => (
                      <Tag key={rule.id} color="processing">
                        {rule.name}
                      </Tag>
                    ))}
                  </Space>
                );
              }
            },
            { title: "节点数", dataIndex: "nodeCount", width: 80 },
            { title: "人工基准(秒)", dataIndex: "manualDurationSec", width: 120 },
            { title: "风险确认", width: 100, render: (_, row) => row.riskConfirmed ? <Tag color="green">已确认</Tag> : <Tag color="orange">待确认</Tag> },
            { title: "状态", width: 100, render: (_, row) => <Tag color={statusColor[row.status]}>{lifecycleLabelMap[row.status]}</Tag> },
            {
              title: "操作",
              width: 520,
              render: (_, row) => (
                <Space wrap>
                  <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
                  <Button size="small" onClick={() => void openBuilder(row)}>作业编排</Button>
                  <Button size="small" onClick={() => void openPreview(row)}>预览确认</Button>
                  <Popconfirm title="确认触发悬浮按钮执行？" onConfirm={() => void triggerFloating(row)}>
                    <Button size="small">悬浮触发</Button>
                  </Popconfirm>
                  {!row.riskConfirmed ? <Button size="small" onClick={() => void confirmRisk(row)}>确认风险</Button> : null}
                  <Popconfirm
                    title={row.status === "ACTIVE" ? "确认停用该场景？" : "确认启用该场景？"}
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

      <Modal title={editing ? "编辑场景" : "新建场景"} open={open} onCancel={closeSceneModal} onOk={() => void submitScene()} width={680}>
        <Form form={form} layout="vertical">
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            场景编号和版本由系统自动维护，你只需要关注页面、执行方式和风险控制。保存后可前往“发布与灰度”发布生效。
          </Typography.Paragraph>
          <ValidationReportPanel report={sceneSaveValidationReport} title="保存前检查结果" />
          <Alert
            type={editing?.riskConfirmed ? "success" : "warning"}
            showIcon
            style={{ marginBottom: 12 }}
            message={editing?.riskConfirmed ? "风险确认：已确认（只读）" : "风险确认：未确认（只读）"}
          />
          <Form.Item name="name" label="场景名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="pageResourceId" label="页面资源" rules={[{ required: true }]}><Select options={resources.map((r) => ({ label: r.name, value: r.id }))} /></Form.Item>
          <Form.Item name="executionMode" label="执行模式" rules={[{ required: true }]}><Select options={Object.entries(executionLabel).map(([value, label]) => ({ label, value }))} /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={lifecycleOptions} /></Form.Item>
          <Form.Item name="nodeCount" label="节点数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="manualDurationSec" label="人工基准(秒)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={builderScene ? `作业编排: ${builderScene.name}` : "作业编排"}
        placement="right"
        width={drawerWidth}
        open={builderOpen}
        onClose={closeBuilder}
        extra={
          <Space>
            <Button onClick={autoLayoutNodes}>自动排版</Button>
            <Button loading={savingFlow} onClick={() => void saveFlowLayout()}>保存编排</Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Card title="场景基础信息区" size="small">
            {builderScene ? (
              <Space size={[8, 8]} wrap>
                <Tag>{builderScene.name}</Tag>
                <Tag color="blue">{executionLabel[builderScene.executionMode]}</Tag>
                <Tag>节点数 {builderScene.nodeCount}</Tag>
                <Tag>人工基准 {builderScene.manualDurationSec}s</Tag>
                <Tag color={builderScene.riskConfirmed ? "green" : "orange"}>
                  {builderScene.riskConfirmed ? "风险已确认" : "风险待确认"}
                </Tag>
              </Space>
            ) : null}
          </Card>

          <Card title="触发关联信息区" size="small">
            {builderScene ? (
              (linkedRulesByScene.get(builderScene.id) ?? []).length > 0 ? (
                <Space size={[8, 8]} wrap>
                  {(linkedRulesByScene.get(builderScene.id) ?? []).map((rule) => (
                    <Tag key={rule.id} color="processing">
                      触发规则：{rule.name}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">当前场景未绑定规则触发。</Typography.Text>
              )
            ) : null}
          </Card>

          <Card title="执行方式与预览配置区" size="small">
            <Space align="center" wrap>
              <Typography.Text>当前执行方式：</Typography.Text>
              <Tag color="blue">{builderScene ? executionLabel[builderScene.executionMode] : "-"}</Tag>
              <Button size="small" disabled={!builderScene} onClick={() => (builderScene ? void openPreview(builderScene) : undefined)}>
                打开预览确认
              </Button>
              <Popconfirm
                title="确认触发悬浮按钮执行？"
                onConfirm={() => (builderScene ? void triggerFloating(builderScene) : undefined)}
                disabled={!builderScene}
              >
                <Button size="small" disabled={!builderScene}>
                  悬浮按钮触发（新实例）
                </Button>
              </Popconfirm>
            </Space>
          </Card>

          <Card title="发布检查" size="small">
            <Alert
              type={builderScene?.riskConfirmed ? "success" : "warning"}
              showIcon
              message={
                builderScene?.riskConfirmed
                  ? "风险确认已完成：保存后可直接进入“发布与灰度”，系统会自动完成最终检查。"
                  : "风险确认未完成：自动化场景发布前需先完成责任确认，否则发布时会被阻断。"
              }
            />
          </Card>

          <Card title="节点编排区" size="small">
            <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
              <Card title="节点库" style={{ flex: "0 0 220px" }}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  {nodeLibrary.map((item) => (
                    <Button
                      key={item.nodeType}
                      block
                      disabled={item.nodeType === "list_lookup" && listDatas.length === 0}
                      onClick={() => void addNodeFromLibrary(item.nodeType)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Space>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  点击节点类型即可加入画布。
                </Typography.Paragraph>
                {listDatas.length === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 12 }}
                    message="名单检索节点暂不可用"
                    description={
                      <Space direction="vertical" size={4}>
                        <Typography.Text type="secondary">请先到高级配置维护名单数据后，再添加名单检索节点。</Typography.Text>
                        <Button size="small" type="primary" onClick={() => navigate("/advanced?tab=list-data")}>
                          去维护名单
                        </Button>
                      </Space>
                    }
                  />
                ) : null}
              </Card>

              <Card title="编排画布" style={{ flex: "1 1 680px", minWidth: 540 }}>
                {flowNodes.length === 0 ? (
                  <Alert type="warning" showIcon message="当前场景暂无节点，请先从左侧节点库添加。" style={{ marginBottom: 12 }} />
                ) : null}
                <div style={{ width: "100%", height: 520, border: "1px solid #f0f0f0", borderRadius: 8 }}>
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      onNodesChange={onFlowNodesChange}
                      onEdgesChange={onFlowEdgesChange}
                      onConnect={onConnect}
                      onInit={(instance) => setReactFlowInstance(instance)}
                      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                      onPaneClick={() => setSelectedNodeId(null)}
                      minZoom={0.15}
                      fitView={flowNodes.length > 0}
                      fitViewOptions={{ padding: 0.1, minZoom: 0.15, maxZoom: 1.2 }}
                    >
                      <MiniMap zoomable pannable />
                      <Controls />
                      <Background />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  拖拽节点调整布局，连线定义执行顺序，点击节点后在右侧编辑属性。
                </Typography.Paragraph>
              </Card>

              <Card title="节点属性" style={{ flex: "0 0 320px" }}>
                {!selectedNode ? (
                  <Typography.Text type="secondary">请先在画布中点击一个节点，再编辑节点属性。</Typography.Text>
                ) : (
                  <>
                    <ValidationReportPanel issues={nodeValidationIssues} title="节点属性还有待处理问题" />
                    <Form form={nodeDetailForm} layout="vertical">
                      <Form.Item name="name" label="节点名称" rules={[{ required: true, message: "请输入节点名称" }]}>
                        <Input placeholder="请输入节点名称" />
                      </Form.Item>
                      <Form.Item name="nodeType" label="节点类型" rules={[{ required: true }]}>
                        <Select options={Object.entries(nodeTypeLabel).map(([value, label]) => ({ label, value }))} />
                      </Form.Item>
                      <Form.Item name="enabled" label="启用状态" rules={[{ required: true }]}>
                        <Select options={[{ label: "启用", value: true }, { label: "停用", value: false }]} />
                      </Form.Item>

                      {watchedNodeType === "page_get" ? (
                        <Form.Item name="field" label="读取字段" rules={[{ required: true, message: "请输入字段名" }]}>
                          <Input placeholder="如: customer_id" />
                        </Form.Item>
                      ) : null}

                      {watchedNodeType === "api_call" ? (
                        <>
                          <Form.Item name="interfaceId" label="接口ID" rules={[{ required: true, message: "请输入接口ID" }]}>
                            <InputNumber min={1} style={{ width: "100%" }} />
                          </Form.Item>
                          <Form.Item name="forceFail" label="模拟失败">
                            <Select options={[{ label: "否", value: false }, { label: "是", value: true }]} />
                          </Form.Item>
                        </>
                      ) : null}

                      {watchedNodeType === "list_lookup" ? (
                        listDatas.length === 0 ? (
                          <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 12 }}
                            message="当前没有可用名单数据"
                            description={
                              <Space direction="vertical" size={4}>
                                <Typography.Text type="secondary">名单检索节点依赖名单中心资产，请先维护名单数据。</Typography.Text>
                                <Button size="small" type="primary" onClick={() => navigate("/advanced?tab=list-data")}>
                                  去维护名单
                                </Button>
                              </Space>
                            }
                          />
                        ) : (
                          <>
                            <Form.Item name="listDataId" label="名单数据" rules={[{ required: true, message: "请选择名单数据" }]}>
                              <Select
                                showSearch
                                optionFilterProp="label"
                                options={listDatas.map((item) => ({
                                  label: `${item.name} / ${item.importColumns.length} 个导入字段`,
                                  value: item.id
                                }))}
                                onChange={(value) => {
                                  const picked = listDatas.find((item) => item.id === value);
                                  const currentMatchColumn = nodeDetailForm.getFieldValue("matchColumn");
                                  nodeDetailForm.setFieldsValue({
                                    listDataId: value as number | undefined,
                                    matchColumn:
                                      picked?.importColumns.includes(currentMatchColumn)
                                        ? currentMatchColumn
                                        : picked?.importColumns[0] ?? ""
                                  });
                                }}
                              />
                            </Form.Item>
                            <Form.Item name="matchColumn" label="匹配字段" rules={[{ required: true, message: "请选择匹配字段" }]}>
                              <Select
                                showSearch
                                placeholder={selectedNodeListData ? "请选择匹配字段" : "请先选择名单数据"}
                                options={(selectedNodeListData?.importColumns ?? []).map((item) => ({ label: item, value: item }))}
                              />
                            </Form.Item>
                            <Form.Item name="inputSource" label="输入来源" rules={[{ required: true, message: "请输入输入来源" }]}>
                              <Input placeholder="如: customer_id（页面字段或上游结果键）" />
                            </Form.Item>
                            <Form.Item name="resultKey" label="结果键名" rules={[{ required: true, message: "请输入结果键名" }]}>
                              <Input placeholder="如: high_risk_match" />
                            </Form.Item>
                          </>
                        )
                      ) : null}

                      {watchedNodeType === "js_script" ? (
                        <Form.Item name="script" label="脚本标识" rules={[{ required: true, message: "请输入脚本标识" }]}>
                          <Input placeholder="如: maskMobile" />
                        </Form.Item>
                      ) : null}

                      {watchedNodeType === "page_set" ? (
                        <>
                          <Form.Item name="target" label="写入目标字段" rules={[{ required: true, message: "请输入目标字段" }]}>
                            <Input placeholder="如: risk_score" />
                          </Form.Item>
                          <Form.Item name="value" label="写入值(可选)">
                            <Input placeholder="可留空，使用上游结果" />
                          </Form.Item>
                        </>
                      ) : null}
                    </Form>

                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Typography.Text type="secondary">修改后请先保存节点属性</Typography.Text>
                      <Space>
                        <Button type="primary" onClick={() => void saveSelectedNode()}>
                          保存属性
                        </Button>
                        <Popconfirm title="确认删除当前节点?" onConfirm={() => void removeSelectedNode()}>
                          <Tooltip title="删除节点">
                            <Button danger icon={<DeleteOutlined />} aria-label="delete-node" />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </Space>
                  </>
                )}
              </Card>
            </div>
          </Card>
        </Space>
      </Drawer>

      <Modal
        title={previewScene ? `预览确认：${previewScene.name}` : "预览确认"}
        open={previewOpen}
        width={980}
        confirmLoading={previewExecuting}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => void executePreview()}
        okText="确认写入"
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Card size="small" title="作业摘要">
            <Space wrap>
              <Tag>{previewScene?.name ?? "-"}</Tag>
              <Tag color="blue">{previewScene ? executionLabel[previewScene.executionMode] : "-"}</Tag>
              <Tag>字段总数 {previewRows.length}</Tag>
              <Tag color="processing">待写入 {previewSelectedKeys.length}</Tag>
              <Tag color={previewRows.some((item) => item.abnormal) ? "red" : "green"}>
                {previewRows.some((item) => item.abnormal) ? "存在异常字段" : "无异常字段"}
              </Tag>
            </Space>
          </Card>

          {previewRows.some((item) => item.abnormal) ? (
            <Alert
              type="warning"
              showIcon
              message="有异常字段，请先取消勾选后再执行。"
            />
          ) : (
            <Typography.Text type="secondary">请勾选需要写入的字段，确认后执行。</Typography.Text>
          )}

          <ValidationReportPanel issues={previewValidationIssues} title="预览提醒" />

          <Table<JobScenePreviewField>
            rowKey="key"
            loading={previewLoading}
            pagination={false}
            rowSelection={{
              selectedRowKeys: previewSelectedKeys,
              onChange: (keys) => setPreviewSelectedKeys(keys as string[]),
              getCheckboxProps: (record) => ({ disabled: record.abnormal })
            }}
            dataSource={previewRows}
            columns={[
              { title: "字段名称", dataIndex: "fieldName", width: 140 },
              { title: "原值", dataIndex: "originalValue", width: 160 },
              { title: "拟写入值", dataIndex: "nextValue", width: 180 },
              { title: "数据来源", dataIndex: "source", width: 220 },
              {
                title: "状态",
                width: 120,
                render: (_, row) =>
                  row.abnormal ? (
                    <Tooltip title="异常字段已被预览校验拦截，执行时会自动跳过。">
                      <Tag color="red">异常</Tag>
                    </Tooltip>
                  ) : (
                    <Tag color="green">正常</Tag>
                  )
              }
            ]}
            rowClassName={(record) => (record.abnormal ? "preview-row-abnormal" : "")}
          />
        </Space>
      </Modal>
    </div>
  );
}






