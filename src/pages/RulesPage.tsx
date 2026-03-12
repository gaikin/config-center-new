import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import { useEffect, useState } from "react";
import { configCenterService } from "../services/configCenterService";
import { workflowService } from "../services/workflowService";
import type {
  JobSceneDefinition,
  LifecycleState,
  PageResource,
  PreprocessorDefinition,
  PromptCloseMode,
  PromptMode,
  RuleCondition,
  RuleConditionGroup,
  RuleDefinition,
  RuleLogicType,
  RuleOperator,
  RuleOperandSourceType
} from "../types";

type RuleForm = {
  name: string;
  pageResourceId: number;
  priority: number;
  promptMode: PromptMode;
  closeMode: PromptCloseMode;
  closeTimeoutSec?: number;
  hasConfirmButton: boolean;
  sceneId?: number;
  status: LifecycleState;
  ownerOrgId: string;
};

type FlatConditionDraft = {
  id: string;
  leftSourceType: RuleOperandSourceType;
  leftValue: string;
  leftPreprocessorIds: number[];
  operator: RuleOperator;
  rightSourceType: RuleOperandSourceType;
  rightValue: string;
  rightPreprocessorIds: number[];
};


const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

const closeModeLabel: Record<PromptCloseMode, string> = {
  AUTO_CLOSE: "自动关闭",
  MANUAL_CLOSE: "手动关闭",
  TIMER_THEN_MANUAL: "超时后关闭"
};

const sourceOptions: Array<{ label: string; value: RuleOperandSourceType }> = [
  { label: "页面字段", value: "PAGE_FIELD" },
  { label: "接口字段", value: "INTERFACE_FIELD" },
  { label: "上下文字段", value: "CONTEXT" },
  { label: "常量", value: "CONST" }
];

const operatorOptions: Array<{ value: RuleOperator; label: string }> = [
  { value: "EQ", label: "=" },
  { value: "NE", label: "!=" },
  { value: "GT", label: ">" },
  { value: "GE", label: ">=" },
  { value: "LT", label: "<" },
  { value: "LE", label: "<=" },
  { value: "CONTAINS", label: "包含" },
  { value: "NOT_CONTAINS", label: "不包含" },
  { value: "IN", label: "IN" },
  { value: "EXISTS", label: "EXISTS" }
];

const valueOptionsBySource: Record<Exclude<RuleOperandSourceType, "CONST">, Array<{ label: string; value: string }>> = {
  PAGE_FIELD: [
    { label: "customer_id", value: "customer_id" },
    { label: "id_no", value: "id_no" },
    { label: "mobile", value: "mobile" },
    { label: "risk_score", value: "risk_score" }
  ],
  INTERFACE_FIELD: [
    { label: "risk_score", value: "risk_score" },
    { label: "risk_level", value: "risk_level" },
    { label: "decision_code", value: "decision_code" }
  ],
  CONTEXT: [
    { label: "org_id", value: "org_id" },
    { label: "operator_role", value: "operator_role" },
    { label: "channel", value: "channel" }
  ]
};

function buildConditionId() {
  return `condition-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function buildDefaultCondition(): FlatConditionDraft {
  return {
    id: buildConditionId(),
    leftSourceType: "PAGE_FIELD",
    leftValue: "",
    leftPreprocessorIds: [],
    operator: "EQ",
    rightSourceType: "CONST",
    rightValue: "",
    rightPreprocessorIds: []
  };
}

function normalizeSourceType(value: string | undefined): RuleOperandSourceType {
  if (value === "INTERFACE_FIELD" || value === "CONST" || value === "CONTEXT") {
    return value;
  }
  return "PAGE_FIELD";
}

function normalizeOperator(value: string | undefined): RuleOperator {
  const allowed: RuleOperator[] = ["EQ", "NE", "GT", "GE", "LT", "LE", "CONTAINS", "NOT_CONTAINS", "IN", "EXISTS"];
  return allowed.includes(value as RuleOperator) ? (value as RuleOperator) : "EQ";
}

function getOperandValue(operand?: { sourceType: RuleOperandSourceType; key: string; constValue?: string }) {
  if (!operand) {
    return "";
  }
  if (operand.sourceType === "CONST") {
    return operand.constValue ?? operand.key;
  }
  return operand.key;
}

function toFlatCondition(condition: RuleCondition): FlatConditionDraft {
  return {
    id: `condition-${condition.id}`,
    leftSourceType: condition.left.sourceType,
    leftValue: getOperandValue(condition.left),
    leftPreprocessorIds: condition.left.preprocessorIds,
    operator: condition.operator,
    rightSourceType: condition.right?.sourceType ?? "CONST",
    rightValue: getOperandValue(condition.right),
    rightPreprocessorIds: condition.right?.preprocessorIds ?? []
  };
}

function toOperand(sourceType: RuleOperandSourceType, value: string, preprocessorIds: number[]) {
  const trimmed = value.trim();
  return {
    sourceType,
    key: trimmed,
    constValue: sourceType === "CONST" ? trimmed : undefined,
    preprocessorIds
  };
}

export function RulesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RuleDefinition[]>([]);
  const [resources, setResources] = useState<PageResource[]>([]);
  const [scenes, setScenes] = useState<JobSceneDefinition[]>([]);
  const [preprocessors, setPreprocessors] = useState<PreprocessorDefinition[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RuleDefinition | null>(null);
  const [ruleForm] = Form.useForm<RuleForm>();

  const [logicOpen, setLogicOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<RuleDefinition | null>(null);
  const [globalLogicType, setGlobalLogicType] = useState<RuleLogicType>("AND");
  const [conditionsDraft, setConditionsDraft] = useState<FlatConditionDraft[]>([buildDefaultCondition()]);
  const [savingQuery, setSavingQuery] = useState(false);
  const [msgApi, holder] = message.useMessage();

  async function loadData() {
    setLoading(true);
    try {
      const [ruleData, resourceData, sceneData, preprocessorData] = await Promise.all([
        configCenterService.listRules(),
        configCenterService.listPageResources(),
        configCenterService.listJobScenes(),
        configCenterService.listPreprocessors()
      ]);
      setRows(ruleData);
      setResources(resourceData);
      setScenes(sceneData);
      setPreprocessors(preprocessorData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function loadLogic(ruleId: number) {
    const [groupData, conditionData] = await Promise.all([
      workflowService.listRuleConditionGroups(ruleId),
      workflowService.listRuleConditions(ruleId)
    ]);

    const rootGroup = groupData
      .filter((item) => !item.parentGroupId)
      .sort((a, b) => a.id - b.id)[0];

    setGlobalLogicType(rootGroup?.logicType ?? "AND");

    const nextConditions = conditionData.sort((a, b) => a.id - b.id).map(toFlatCondition);
    setConditionsDraft(nextConditions.length > 0 ? nextConditions : [buildDefaultCondition()]);
  }

  function openCreate() {
    setEditing(null);
    ruleForm.setFieldsValue({
      name: "",
      pageResourceId: resources[0]?.id,
      priority: 500,
      promptMode: "FLOATING",
      closeMode: "MANUAL_CLOSE",
      closeTimeoutSec: undefined,
      hasConfirmButton: true,
      sceneId: undefined,
      status: "DRAFT",
      ownerOrgId: "branch-east"
    });
    setOpen(true);
  }

  function openEdit(row: RuleDefinition) {
    setEditing(row);
    ruleForm.setFieldsValue({
      name: row.name,
      pageResourceId: row.pageResourceId,
      priority: row.priority,
      promptMode: row.promptMode,
      closeMode: row.closeMode,
      closeTimeoutSec: row.closeTimeoutSec,
      hasConfirmButton: row.hasConfirmButton,
      sceneId: row.sceneId,
      status: row.status,
      ownerOrgId: row.ownerOrgId
    });
    setOpen(true);
  }

  async function submitRule() {
    const values = await ruleForm.validateFields();
    const resource = resources.find((item) => item.id === values.pageResourceId);
    if (!resource) {
      msgApi.error("请选择页面资源");
      return;
    }

    const scene = scenes.find((item) => item.id === values.sceneId);
    const saved = await configCenterService.upsertRule({
      id: editing?.id ?? Date.now() + Math.floor(Math.random() * 1000),
      name: values.name,
      pageResourceId: values.pageResourceId,
      pageResourceName: resource.name,
      priority: values.priority,
      promptMode: values.promptMode,
      closeMode: values.closeMode,
      closeTimeoutSec: values.closeMode === "TIMER_THEN_MANUAL" ? values.closeTimeoutSec : undefined,
      hasConfirmButton: values.hasConfirmButton,
      sceneId: values.hasConfirmButton ? values.sceneId : undefined,
      sceneName: values.hasConfirmButton ? scene?.name : undefined,
      status: values.status,
      currentVersion: editing?.currentVersion ?? 1,
      ownerOrgId: values.ownerOrgId
    });

    if (!editing) {
      msgApi.success("规则已创建");
    } else if (saved.id !== editing.id) {
      msgApi.success("规则已更新，生效中的规则已自动生成待发布版本");
    } else {
      msgApi.success("规则已更新");
    }

    setOpen(false);
    setEditing(null);
    await loadData();
  }

  async function switchStatus(row: RuleDefinition) {
    const next: LifecycleState = row.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await configCenterService.updateRuleStatus(row.id, next);
    msgApi.success(`规则状态已切换为 ${next}`);
    await loadData();
  }

  async function openLogic(row: RuleDefinition) {
    setCurrentRule(row);
    setLogicOpen(true);
    try {
      await loadLogic(row.id);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "条件配置加载失败");
    }
  }

  function updateCondition(conditionId: string, patch: Partial<FlatConditionDraft>) {
    setConditionsDraft((previous) => previous.map((item) => (item.id === conditionId ? { ...item, ...patch } : item)));
  }

  function addCondition() {
    setConditionsDraft((previous) => [...previous, buildDefaultCondition()]);
  }

  function removeCondition(conditionId: string) {
    setConditionsDraft((previous) => {
      if (previous.length <= 1) {
        msgApi.warning("至少保留一条条件");
        return previous;
      }
      return previous.filter((item) => item.id !== conditionId);
    });
  }

  async function saveConditionLogic() {
    if (!currentRule) {
      return;
    }

    for (const [index, condition] of conditionsDraft.entries()) {
      if (!condition.leftValue.trim()) {
        msgApi.error(`第 ${index + 1} 条条件左值不能为空`);
        return;
      }
      if (condition.operator !== "EXISTS" && !condition.rightValue.trim()) {
        msgApi.error(`第 ${index + 1} 条条件右值不能为空`);
        return;
      }
    }

    setSavingQuery(true);
    try {
      const currentRuleId = currentRule.id;
      const latestGroups = await workflowService.listRuleConditionGroups(currentRuleId);
      const roots = latestGroups.filter((item) => !item.parentGroupId);
      for (const root of roots) {
        await workflowService.deleteRuleConditionGroup(root.id);
      }

      const rootGroup: RuleConditionGroup = await workflowService.createRuleConditionGroup(currentRuleId, globalLogicType);

      const nextLocalId = (() => {
        let cursor = Date.now();
        return () => {
          cursor += 1;
          return cursor;
        };
      })();

      for (const condition of conditionsDraft) {
        const operator = normalizeOperator(condition.operator);
        const needRight = operator !== "EXISTS";

        await workflowService.upsertRuleCondition({
          id: nextLocalId(),
          ruleId: currentRuleId,
          groupId: rootGroup.id,
          left: toOperand(condition.leftSourceType, condition.leftValue, condition.leftPreprocessorIds),
          operator,
          right: needRight
            ? toOperand(condition.rightSourceType, condition.rightValue, condition.rightPreprocessorIds)
            : undefined
        });
      }

      msgApi.success("条件逻辑已保存");
      await loadLogic(currentRuleId);
    } catch (error) {
      msgApi.error(error instanceof Error ? error.message : "条件逻辑保存失败");
    } finally {
      setSavingQuery(false);
    }
  }

  const conditionColumns = [
    {
      title: "左值类型",
      dataIndex: "leftSourceType",
      width: 120,
      render: (_: RuleOperandSourceType, row: FlatConditionDraft) => (
        <Select
          value={row.leftSourceType}
          options={sourceOptions}
          onChange={(value) => updateCondition(row.id, { leftSourceType: normalizeSourceType(value), leftValue: "" })}
        />
      )
    },
    {
      title: "选择值（重点）",
      dataIndex: "leftValue",
      width: 260,
      render: (_: string, row: FlatConditionDraft) =>
        row.leftSourceType === "CONST" ? (
          <Input
            placeholder="选择值"
            value={row.leftValue}
            onChange={(event) => updateCondition(row.id, { leftValue: event.target.value })}
          />
        ) : (
          <Select
            showSearch
            allowClear
            placeholder="选择值"
            value={row.leftValue || undefined}
            options={valueOptionsBySource[row.leftSourceType]}
            onChange={(value) => updateCondition(row.id, { leftValue: (value as string) ?? "" })}
          />
        )
    },
    {
      title: "左预处理器",
      dataIndex: "leftPreprocessorIds",
      width: 220,
      render: (_: number[], row: FlatConditionDraft) => (
        <Select
          mode="multiple"
          allowClear
          placeholder="预处理器"
          value={row.leftPreprocessorIds}
          options={preprocessors.map((item) => ({ label: item.name, value: item.id }))}
          onChange={(value) => updateCondition(row.id, { leftPreprocessorIds: value as number[] })}
        />
      )
    },
    {
      title: "逻辑运算",
      dataIndex: "operator",
      width: 110,
      render: (_: RuleOperator, row: FlatConditionDraft) => (
        <Select
          value={row.operator}
          options={operatorOptions}
          onChange={(value) => updateCondition(row.id, { operator: normalizeOperator(value) })}
        />
      )
    },
    {
      title: "右值类型",
      dataIndex: "rightSourceType",
      width: 120,
      render: (_: RuleOperandSourceType, row: FlatConditionDraft) => (
        <Select
          disabled={row.operator === "EXISTS"}
          value={row.rightSourceType}
          options={sourceOptions}
          onChange={(value) => updateCondition(row.id, { rightSourceType: normalizeSourceType(value), rightValue: "" })}
        />
      )
    },
    {
      title: "选择值（重点）",
      dataIndex: "rightValue",
      width: 260,
      render: (_: string, row: FlatConditionDraft) => {
        if (row.operator === "EXISTS") {
          return <Tag>无需右值</Tag>;
        }
        return row.rightSourceType === "CONST" ? (
          <Input
            placeholder="选择值"
            value={row.rightValue}
            onChange={(event) => updateCondition(row.id, { rightValue: event.target.value })}
          />
        ) : (
          <Select
            showSearch
            allowClear
            placeholder="选择值"
            value={row.rightValue || undefined}
            options={valueOptionsBySource[row.rightSourceType]}
            onChange={(value) => updateCondition(row.id, { rightValue: (value as string) ?? "" })}
          />
        );
      }
    },
    {
      title: "右预处理器",
      dataIndex: "rightPreprocessorIds",
      width: 220,
      render: (_: number[], row: FlatConditionDraft) => (
        <Select
          mode="multiple"
          allowClear
          disabled={row.operator === "EXISTS"}
          placeholder="预处理器"
          value={row.rightPreprocessorIds}
          options={preprocessors.map((item) => ({ label: item.name, value: item.id }))}
          onChange={(value) => updateCondition(row.id, { rightPreprocessorIds: value as number[] })}
        />
      )
    },
    {
      title: "操作",
      width: 80,
      fixed: "right" as const,
      render: (_: unknown, row: FlatConditionDraft) => (
        <Button danger onClick={() => removeCondition(row.id)}>
          删除
        </Button>
      )
    }
  ];

  return (
    <div>
      {holder}
      <Typography.Title level={4}>规则中心</Typography.Title>
      <Typography.Paragraph type="secondary">条件编辑已调整为单层模式，所有条件统一使用一个 AND/OR 组合逻辑。</Typography.Paragraph>

      <Card
        extra={
          <Button type="primary" onClick={openCreate}>
            新建规则
          </Button>
        }
      >
        <Table<RuleDefinition>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "规则名称", dataIndex: "name", width: 200 },
            { title: "页面资源", dataIndex: "pageResourceName", width: 160 },
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
                  <Button size="small" onClick={() => void switchStatus(row)}>
                    {row.status === "ACTIVE" ? "停用" : "启用"}
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editing ? "编辑规则" : "新建规则"}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={() => void submitRule()}
        width={680}
      >
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pageResourceId" label="页面资源" rules={[{ required: true, message: "请选择页面资源" }]}>
            <Select options={resources.map((item) => ({ label: item.name, value: item.id }))} />
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
          <Form.Item name="sceneId" label="关联作业场景">
            <Select allowClear options={scenes.map((scene) => ({ label: scene.name, value: scene.id }))} />
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
        width={1320}
        open={logicOpen}
        onClose={() => setLogicOpen(false)}
      >
        <Card
          title="条件配置（单层）"
          extra={
            <Space>
              <Button onClick={addCondition}>新增条件</Button>
              <Button type="primary" loading={savingQuery} onClick={() => void saveConditionLogic()}>
                保存条件逻辑
              </Button>
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            message="所有条件只保留一层，通过上方统一 AND/OR 控制整体组合逻辑。"
            style={{ marginBottom: 12 }}
          />

          <Space style={{ marginBottom: 12 }}>
            <Typography.Text strong>整体逻辑</Typography.Text>
            <Select
              style={{ width: 160 }}
              value={globalLogicType}
              options={[
                { label: "AND（全部满足）", value: "AND" },
                { label: "OR（满足任一）", value: "OR" }
              ]}
              onChange={(value) => setGlobalLogicType(value as RuleLogicType)}
            />
          </Space>

          <Table<FlatConditionDraft>
            rowKey="id"
            pagination={false}
            dataSource={conditionsDraft}
            columns={conditionColumns}
            scroll={{ x: 1600 }}
            size="small"
          />
        </Card>
      </Drawer>
    </div>
  );
}







