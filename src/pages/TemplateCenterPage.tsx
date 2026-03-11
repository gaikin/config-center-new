import { Button, Card, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { configCenterService } from "../services/configCenterService";
import type { ConfigTemplate, MenuScope } from "../types";

const categoryColor: Record<ConfigTemplate["category"], string> = {
  REGULATION: "blue",
  RISK: "red",
  GUIDE: "gold"
};

const categoryLabel: Record<ConfigTemplate["category"], string> = {
  REGULATION: "合规",
  RISK: "风险",
  GUIDE: "引导"
};

export function TemplateCenterPage() {
  const navigate = useNavigate();
  const [msgApi, holder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [menus, setMenus] = useState<MenuScope[]>([]);

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
        msgApi.error(`模板加载失败：${String((error as Error).message)}`);
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

  const columns: ColumnsType<ConfigTemplate> = [
    { title: "模板ID", dataIndex: "template_id", width: 180 },
    { title: "模板名称", dataIndex: "template_name", width: 220 },
    {
      title: "分类",
      width: 120,
      render: (_, row) => <Tag color={categoryColor[row.category]}>{categoryLabel[row.category]}</Tag>
    },
    { title: "说明", dataIndex: "description" },
    {
      title: "操作",
      width: 280,
      render: (_, row) => (
        <Space>
          <Button onClick={() => navigate(`/wizard?templateId=${row.template_id}`)}>进入向导</Button>
          <Button
            type="primary"
            onClick={async () => {
              const defaultMenu = menus[0]?.id;
              if (!defaultMenu) {
                msgApi.error("未找到菜单范围，请先创建菜单范围。");
                return;
              }
              try {
                const result = await configCenterService.createFromTemplate({
                  templateId: row.template_id,
                  menuScopeIds: [defaultMenu]
                });
                msgApi.success(`已创建提示规则 ${result.hintId} 与作业 ${result.operationId}`);
              } catch (error) {
                msgApi.error(`创建失败：${String((error as Error).message)}`);
              }
            }}
          >
            一键创建
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      {holder}
      <Typography.Title level={4}>模板中心</Typography.Title>
      <Typography.Paragraph type="secondary">
        业务人员可直接基于模板开始配置，避免从零搭建规则和编排。
      </Typography.Paragraph>
      <Card>
        <Table rowKey="template_id" loading={loading} dataSource={templates} columns={columns} pagination={false} />
      </Card>
    </div>
  );
}
