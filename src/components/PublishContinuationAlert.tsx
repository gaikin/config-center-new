import { Alert, Button, Space, Typography } from "antd";

type PublishContinuationAlertProps = {
  objectLabel: string;
  objectName: string;
  warningCount?: number;
  onGoPublish: () => void;
  onClose: () => void;
};

export function PublishContinuationAlert({
  objectLabel,
  objectName,
  warningCount = 0,
  onGoPublish,
  onClose
}: PublishContinuationAlertProps) {
  return (
    <Alert
      showIcon
      closable
      type={warningCount > 0 ? "warning" : "success"}
      style={{ marginBottom: 12 }}
      message={`${objectLabel}「${objectName}」已保存为待发布草稿`}
      description={
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          <Typography.Text type="secondary">
            {warningCount > 0
              ? `当前还有 ${warningCount} 个提醒可继续优化，但不影响进入发布与灰度。`
              : "当前配置已进入待发布列表，建议继续完成发布与灰度。"}
          </Typography.Text>
          <Space>
            <Button type="primary" size="small" onClick={onGoPublish}>
              去发布与灰度
            </Button>
            <Button size="small" onClick={onClose}>
              稍后再说
            </Button>
          </Space>
        </Space>
      }
      onClose={onClose}
    />
  );
}
