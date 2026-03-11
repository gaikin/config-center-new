import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useMemo, useState } from "react";
import type { ConditionExpression, HintRule, ValueSource } from "../types";
import { useAppStore } from "../store/useAppStore";
import { createId } from "../utils";
import { idRule, maxLenRule, requiredRule, xpathLikeRule } from "../validation/formRules";

type ConditionRow = {
  id: string;
  operator: ConditionExpression["operator"];
  left_type: ValueSource["type"];
  left_value?: string;
  left_xpath?: string;
  left_interface_id?: string;
  left_response_path?: string;
  right_type: ValueSource["type"];
  right_value?: string;
  right_xpath?: string;
  right_interface_id?: string;
  right_response_path?: string;
};

type HintForm = Omit<HintRule, "conditions"> & { conditions: ConditionRow[] };
type SourceSide = "left" | "right";

const relationLabel: Record<HintRule["relation"], string> = {
  AND: "且",
  OR: "或"
};

const riskLevelLabel: Record<HintRule["risk_level"], string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高"
};

const statusLabel: Record<HintRule["status"], string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布"
};

const operatorOptions: Array<{ label: string; value: ConditionExpression["operator"] }> = [
  { label: "等于", value: "eq" },
  { label: "不等于", value: "ne" },
  { label: "大于", value: "gt" },
  { label: "小于", value: "lt" },
  { label: "大于等于", value: "gte" },
  { label: "小于等于", value: "lte" },
  { label: "包含", value: "contains" },
  { label: "不包含", value: "not_contains" },
  { label: "属于", value: "in" },
  { label: "不属于", value: "not_in" },
  { label: "正则匹配", value: "regex_match" },
  { label: "为空", value: "is_empty" },
  { label: "非空", value: "not_empty" }
];

function createDefaultCondition(): ConditionRow {
  return {
    id: createId("cond"),
    operator: "not_empty",
    left_type: "page",
    left_xpath: "/form/customerNo",
    right_type: "fixed",
    right_value: ""
  };
}

function mapSourceToRow(side: SourceSide, source: ValueSource): Partial<ConditionRow> {
  if (source.type === "fixed") {
    return {
      [`${side}_type`]: "fixed",
      [`${side}_value`]: String(source.value ?? "")
    };
  }
  if (source.type === "page") {
    return {
      [`${side}_type`]: "page",
      [`${side}_xpath`]: source.xpath
    };
  }
  return {
    [`${side}_type`]: "interface",
    [`${side}_interface_id`]: source.interface_id,
    [`${side}_response_path`]: source.response_path
  };
}

function mapConditionToRow(condition: ConditionExpression): ConditionRow {
  return {
    id: condition.id,
    operator: condition.operator,
    ...(mapSourceToRow("left", condition.left) as Pick<
      ConditionRow,
      "left_type" | "left_value" | "left_xpath" | "left_interface_id" | "left_response_path"
    >),
    ...(mapSourceToRow("right", condition.right) as Pick<
      ConditionRow,
      "right_type" | "right_value" | "right_xpath" | "right_interface_id" | "right_response_path"
    >)
  };
}

function buildSourceFromRow(row: ConditionRow, side: SourceSide): ValueSource {
  const sourceType = row[`${side}_type`];
  if (sourceType === "fixed") {
    return {
      type: "fixed",
      value: row[`${side}_value`] ?? ""
    };
  }
  if (sourceType === "page") {
    return {
      type: "page",
      xpath: row[`${side}_xpath`] ?? ""
    };
  }
  return {
    type: "interface",
    interface_id: row[`${side}_interface_id`] ?? "",
    response_path: row[`${side}_response_path`] ?? ""
  };
}

function SourceEditor({
  side,
  rowIndex,
  interfaces
}: {
  side: SourceSide;
  rowIndex: number;
  interfaces: Array<{ interface_id: string; interface_name: string }>;
}) {
  const sideLabel = side === "left" ? "左值" : "右值";
  const sourceTypeKey = `${side}_type` as const;
  const fixedValueKey = `${side}_value` as const;
  const xpathKey = `${side}_xpath` as const;
  const interfaceIdKey = `${side}_interface_id` as const;
  const responsePathKey = `${side}_response_path` as const;

  return (
    <>
      <Form.Item
        name={[rowIndex, sourceTypeKey]}
        label={`${sideLabel}来源`}
        rules={[requiredRule(`${sideLabel}来源`)]}
        style={{ minWidth: 140 }}
      >
        <Select
          options={[
            { label: "固定值", value: "fixed" },
            { label: "页面值", value: "page" },
            { label: "接口值", value: "interface" }
          ]}
        />
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) =>
          prevValues.conditions?.[rowIndex]?.[sourceTypeKey] !== currentValues.conditions?.[rowIndex]?.[sourceTypeKey]
        }
      >
        {({ getFieldValue }) => {
          const currentType = getFieldValue(["conditions", rowIndex, sourceTypeKey]) as ValueSource["type"] | undefined;
          if (currentType === "page") {
            return (
              <Form.Item
                name={[rowIndex, xpathKey]}
                label={`${sideLabel}定位`}
                rules={[requiredRule(`${sideLabel}定位`), xpathLikeRule]}
                style={{ minWidth: 240 }}
              >
                <Input placeholder="例如：/form/customerNo" />
              </Form.Item>
            );
          }
          if (currentType === "interface") {
            return (
              <Space align="start" size={8}>
                <Form.Item
                  name={[rowIndex, interfaceIdKey]}
                  label={`${sideLabel}接口`}
                  rules={[requiredRule(`${sideLabel}接口`)]}
                  style={{ minWidth: 220 }}
                >
                  <Select
                    options={interfaces.map((item) => ({
                      label: `${item.interface_name}（${item.interface_id}）`,
                      value: item.interface_id
                    }))}
                  />
                </Form.Item>
                <Form.Item
                  name={[rowIndex, responsePathKey]}
                  label={`${sideLabel}返回路径`}
                  rules={[requiredRule(`${sideLabel}返回路径`)]}
                  style={{ minWidth: 220 }}
                >
                  <Input placeholder="例如：data.score" />
                </Form.Item>
              </Space>
            );
          }
          return (
            <Form.Item name={[rowIndex, fixedValueKey]} label={`${sideLabel}固定值`} style={{ minWidth: 220 }}>
              <Input placeholder="可留空" />
            </Form.Item>
          );
        }}
      </Form.Item>
    </>
  );
}

export function HintsPage() {
  const { hints, menus, operations, interfaces, upsertHint, publishHint } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HintRule | null>(null);
  const [form] = Form.useForm<HintForm>();
  const [msgApi, holder] = message.useMessage();

  const publishedInterfaceMap = useMemo(
    () => new Map(interfaces.map((item) => [item.interface_id, item.status])),
    [interfaces]
  );

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      id: createId("hint"),
      title: "",
      content: "",
      risk_level: "MEDIUM",
      relation: "AND",
      operation_id: undefined,
      menu_scope_ids: menus[0]?.id ? [menus[0].id] : [],
      status: "DRAFT",
      strategy: { ips: [], persons: [], orgs: [] },
      conditions: [createDefaultCondition()]
    });
    setOpen(true);
  };

  const openEdit = (row: HintRule) => {
    setEditing(row);
    form.setFieldsValue({
      ...row,
      conditions: row.conditions.map(mapConditionToRow)
    });
    setOpen(true);
  };

  const validateConditionInterfaces = (conditions: ConditionExpression[]) => {
    for (const condition of conditions) {
      for (const side of [condition.left, condition.right]) {
        if (side.type === "interface" && publishedInterfaceMap.get(side.interface_id) !== "PUBLISHED") {
          throw new Error(`条件引用了未发布接口：${side.interface_id}`);
        }
      }
    }
  };

  return (
    <div>
      {holder}
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          提示规则管理
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          新建规则
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="规则说明"
        description="通过可视化方式编辑条件，支持固定值、页面值、接口返回值三类来源。"
      />

      <Table<HintRule>
        rowKey="id"
        dataSource={hints}
        columns={[
          { title: "规则ID", dataIndex: "id", width: 220 },
          { title: "标题", dataIndex: "title" },
          { title: "关系", width: 90, render: (_, row) => relationLabel[row.relation] },
          {
            title: "风险级别",
            width: 120,
            render: (_, row) => (
              <Tag color={row.risk_level === "HIGH" ? "red" : row.risk_level === "MEDIUM" ? "gold" : "green"}>
                {riskLevelLabel[row.risk_level]}
              </Tag>
            )
          },
          {
            title: "状态",
            width: 120,
            render: (_, row) => (
              <Tag color={row.status === "PUBLISHED" ? "green" : "default"}>{statusLabel[row.status]}</Tag>
            )
          },
          { title: "联动作业", dataIndex: "operation_id", render: (value) => value ?? "-" },
          {
            title: "操作",
            width: 220,
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    publishHint(row.id);
                    msgApi.success("规则已发布。");
                  }}
                >
                  发布
                </Button>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? "编辑规则" : "新建规则"}
        width={1000}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            if (!values.conditions || values.conditions.length === 0) {
              throw new Error("请至少配置一个条件。");
            }

            const conditions: ConditionExpression[] = values.conditions.map((condition) => ({
              id: condition.id,
              operator: condition.operator,
              left: buildSourceFromRow(condition, "left"),
              right: buildSourceFromRow(condition, "right")
            }));

            validateConditionInterfaces(conditions);

            const payload: HintRule = {
              id: values.id,
              title: values.title,
              content: values.content,
              risk_level: values.risk_level,
              relation: values.relation,
              operation_id: values.operation_id,
              menu_scope_ids: values.menu_scope_ids,
              strategy: values.strategy,
              status: values.status,
              updated_at: new Date().toISOString(),
              conditions
            };
            upsertHint(payload);
            setOpen(false);
            msgApi.success("保存成功。");
          } catch (error) {
            msgApi.error(String((error as Error).message));
          }
        }}
      >
        <Form<HintForm> form={form} layout="vertical">
          <Space style={{ width: "100%" }} align="start">
            <Form.Item
              name="id"
              label="规则ID"
              rules={[requiredRule("规则ID"), idRule("规则ID", "hint-")]}
              style={{ minWidth: 220 }}
            >
              <Input disabled={Boolean(editing)} />
            </Form.Item>
            <Form.Item
              name="relation"
              label="条件关系"
              rules={[requiredRule("条件关系")]}
              style={{ minWidth: 160 }}
            >
              <Select options={[{ label: "且", value: "AND" }, { label: "或", value: "OR" }]} />
            </Form.Item>
            <Form.Item
              name="risk_level"
              label="风险级别"
              rules={[requiredRule("风险级别")]}
              style={{ minWidth: 160 }}
            >
              <Select
                options={(["LOW", "MEDIUM", "HIGH"] as HintRule["risk_level"][]).map((item) => ({
                  label: riskLevelLabel[item],
                  value: item
                }))}
              />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[requiredRule("状态")]} style={{ minWidth: 160 }}>
              <Select options={[{ label: "草稿", value: "DRAFT" }, { label: "已发布", value: "PUBLISHED" }]} />
            </Form.Item>
          </Space>

          <Form.Item name="title" label="标题" rules={[requiredRule("标题"), maxLenRule("标题", 80)]}>
            <Input />
          </Form.Item>

          <Form.Item name="content" label="提示内容" rules={[requiredRule("提示内容"), maxLenRule("提示内容", 500)]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="menu_scope_ids" label="生效菜单范围" rules={[requiredRule("生效菜单范围")]}>
            <Select mode="multiple" options={menus.map((item) => ({ label: `${item.zone}/${item.menu}`, value: item.id }))} />
          </Form.Item>

          <Form.Item name="operation_id" label="联动作业">
            <Select
              allowClear
              options={operations.map((item) => ({ label: item.operation_name, value: item.operation_id }))}
            />
          </Form.Item>

          <Form.Item name={["strategy", "ips"]} label="策略-IP（可选）">
            <Select mode="tags" open={false} />
          </Form.Item>
          <Form.Item name={["strategy", "persons"]} label="策略-人员（可选）">
            <Select mode="tags" open={false} />
          </Form.Item>
          <Form.Item name={["strategy", "orgs"]} label="策略-机构（可选）">
            <Select mode="tags" open={false} />
          </Form.Item>

          <Form.List name="conditions">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`条件 ${index + 1}`}
                    extra={
                      <Button danger type="link" onClick={() => remove(field.name)}>
                        删除条件
                      </Button>
                    }
                  >
                    <Space wrap align="start" size={8} style={{ width: "100%" }}>
                      <Form.Item
                        name={[field.name, "id"]}
                        label="条件ID"
                        rules={[requiredRule("条件ID"), idRule("条件ID", "cond-")]}
                        style={{ minWidth: 240 }}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "operator"]}
                        label="运算符"
                        rules={[requiredRule("运算符")]}
                        style={{ minWidth: 180 }}
                      >
                        <Select options={operatorOptions} />
                      </Form.Item>
                    </Space>

                    <Space wrap align="start" size={8} style={{ width: "100%" }}>
                      <SourceEditor
                        side="left"
                        rowIndex={field.name}
                        interfaces={interfaces.map((item) => ({
                          interface_id: item.interface_id,
                          interface_name: item.interface_name
                        }))}
                      />
                      <SourceEditor
                        side="right"
                        rowIndex={field.name}
                        interfaces={interfaces.map((item) => ({
                          interface_id: item.interface_id,
                          interface_name: item.interface_name
                        }))}
                      />
                    </Space>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add(createDefaultCondition())} style={{ width: "100%" }}>
                  新增条件
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
