import { Alert, Button, Card, Form, Input, Select, Space, Steps, Switch, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { configCenterService } from "../services/configCenterService";
import type { ConfigTemplate, HintRule, MenuScope } from "../types";
import { maxLenRule, requiredRule } from "../validation/formRules";

type WizardForm = {
  templateId: string;
  title: string;
  content: string;
  riskLevel: HintRule["risk_level"];
  relation: HintRule["relation"];
  previewMode: boolean;
  floatingButton: boolean;
  menuScopeIds: string[];
  publishNow: boolean;
};

const templateCategoryLabel: Record<ConfigTemplate["category"], string> = {
  REGULATION: "合规",
  RISK: "风险",
  GUIDE: "引导"
};

const riskLevelLabel: Record<HintRule["risk_level"], string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高"
};

const relationLabel: Record<HintRule["relation"], string> = {
  AND: "且",
  OR: "或"
};

export function RuleWizardPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [menus, setMenus] = useState<MenuScope[]>([]);
  const [form] = Form.useForm<WizardForm>();
  const [msgApi, holder] = message.useMessage();
  const navigate = useNavigate();
  const [search] = useSearchParams();

  const selectedTemplateId = Form.useWatch("templateId", form);
  const selectedTemplate = useMemo<ConfigTemplate | undefined>(
    () => templates.find((item) => item.template_id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const [templateData, menuData] = await Promise.all([
          configCenterService.listTemplates(),
          configCenterService.listMenus()
        ]);
        if (!active) {
          return;
        }
        setTemplates(templateData);
        setMenus(menuData);
      } catch (error) {
        msgApi.error(`向导数据加载失败：${String((error as Error).message)}`);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [msgApi]);

  useEffect(() => {
    if (templates.length === 0) {
      return;
    }
    const fromQuery = search.get("templateId");
    const fallback = templates[0]?.template_id;
    const targetTemplateId =
      fromQuery && templates.some((item) => item.template_id === fromQuery) ? fromQuery : fallback;
    if (!targetTemplateId) {
      return;
    }
    const targetTemplate = templates.find((item) => item.template_id === targetTemplateId);
    if (!targetTemplate) {
      return;
    }

    form.setFieldsValue({
      templateId: targetTemplate.template_id,
      title: targetTemplate.hint_seed.title,
      content: targetTemplate.hint_seed.content,
      riskLevel: targetTemplate.hint_seed.risk_level,
      relation: targetTemplate.hint_seed.relation,
      previewMode: targetTemplate.operation_seed.preview_mode,
      floatingButton: targetTemplate.operation_seed.floating_button,
      menuScopeIds: menus[0]?.id ? [menus[0].id] : [],
      publishNow: true
    });
  }, [form, menus, search, templates]);

  return (
    <div>
      {holder}
      <Typography.Title level={4}>配置向导</Typography.Title>
      <Typography.Paragraph type="secondary">
        面向业务人员的一体化流程：选择模板 → 调整规则 → 绑定作业 → 设置范围并发布。
      </Typography.Paragraph>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="低门槛配置流程"
        description="无需脚本编写，当前阶段使用本地写死数据完成前端实现。"
      />

      <Steps
        current={step}
        style={{ marginBottom: 20 }}
        items={[{ title: "选择模板" }, { title: "规则与作业" }, { title: "生效范围与发布" }]}
      />

      <Card>
        <Form form={form} layout="vertical" disabled={loading}>
          {step === 0 && (
            <>
              <Form.Item name="templateId" label="模板" rules={[requiredRule("模板")]}>
                <Select
                  loading={loading}
                  options={templates.map((item) => ({
                    label: `${item.template_name}（${templateCategoryLabel[item.category]}）`,
                    value: item.template_id
                  }))}
                  onChange={(templateId) => {
                    const template = templates.find((item) => item.template_id === templateId);
                    if (!template) {
                      return;
                    }
                    form.setFieldsValue({
                      title: template.hint_seed.title,
                      content: template.hint_seed.content,
                      riskLevel: template.hint_seed.risk_level,
                      relation: template.hint_seed.relation,
                      previewMode: template.operation_seed.preview_mode,
                      floatingButton: template.operation_seed.floating_button
                    });
                  }}
                />
              </Form.Item>
              {selectedTemplate ? (
                <Alert
                  type="success"
                  showIcon
                  message={selectedTemplate.template_name}
                  description={selectedTemplate.description}
                />
              ) : null}
            </>
          )}

          {step === 1 && (
            <>
              <Form.Item name="title" label="规则标题" rules={[requiredRule("规则标题"), maxLenRule("规则标题", 80)]}>
                <Input maxLength={80} />
              </Form.Item>
              <Form.Item
                name="content"
                label="规则内容"
                rules={[requiredRule("规则内容"), maxLenRule("规则内容", 500)]}
              >
                <Input.TextArea rows={3} maxLength={500} />
              </Form.Item>
              <Space style={{ width: "100%" }} align="start">
                <Form.Item name="riskLevel" label="风险级别" rules={[requiredRule("风险级别")]} style={{ minWidth: 180 }}>
                  <Select
                    options={(["LOW", "MEDIUM", "HIGH"] as HintRule["risk_level"][]).map((item) => ({
                      label: riskLevelLabel[item],
                      value: item
                    }))}
                  />
                </Form.Item>
                <Form.Item name="relation" label="条件关系" rules={[requiredRule("条件关系")]} style={{ minWidth: 180 }}>
                  <Select
                    options={(["AND", "OR"] as HintRule["relation"][]).map((item) => ({
                      label: relationLabel[item],
                      value: item
                    }))}
                  />
                </Form.Item>
              </Space>
              <Space style={{ width: "100%" }} align="start">
                <Form.Item name="previewMode" label="注入前预览" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="floatingButton" label="悬浮按钮触发" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Space>
            </>
          )}

          {step === 2 && (
            <>
              <Form.Item
                name="menuScopeIds"
                label="生效菜单范围"
                rules={[{ required: true, message: "请至少选择一个菜单范围" }]}
              >
                <Select
                  mode="multiple"
                  loading={loading}
                  options={menus.map((menu) => ({
                    label: `${menu.zone} / ${menu.menu}`,
                    value: menu.id
                  }))}
                />
              </Form.Item>
              <Form.Item name="publishNow" label="立即发布" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Alert
                type="warning"
                showIcon
                message="发布与范围一体化"
                description="按已确认规则，发布动作必须与生效范围同时提交。"
              />
            </>
          )}
        </Form>

        <Space style={{ marginTop: 16 }}>
          <Button disabled={step === 0 || loading} onClick={() => setStep((prev) => prev - 1)}>
            上一步
          </Button>
          {step < 2 ? (
            <Button
              type="primary"
              loading={loading}
              disabled={loading}
              onClick={async () => {
                if (step === 0) {
                  await form.validateFields(["templateId"]);
                }
                if (step === 1) {
                  await form.validateFields(["title", "content", "riskLevel", "relation"]);
                }
                setStep((prev) => prev + 1);
              }}
            >
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              loading={loading}
              disabled={loading}
              onClick={async () => {
                const values = await form.validateFields();
                const result = await configCenterService.createFromTemplate({
                  templateId: values.templateId,
                  menuScopeIds: values.menuScopeIds,
                  customTitle: values.title,
                  customContent: values.content,
                  riskLevel: values.riskLevel,
                  relation: values.relation,
                  previewMode: values.previewMode,
                  floatingButton: values.floatingButton,
                  publishStatus: values.publishNow ? "PUBLISHED" : "DRAFT"
                });
                msgApi.success(`创建成功：${result.hintId}`);
                navigate("/hints");
              }}
            >
              完成并创建
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}
