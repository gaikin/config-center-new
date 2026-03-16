import { Alert, Button, Space, Typography } from "antd";

type PublishContinuationAlertProps = {
  objectLabel: string;
  objectName: string;
  warningCount?: number;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionDisabledReason?: string;
  onGoPublish: () => void;
  onClose: () => void;
};

export function PublishContinuationAlert({
  objectLabel,
  objectName,
  warningCount = 0,
  actionLabel = "立即生效",
  actionDisabled = false,
  actionDisabledReason,
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
              ? `当前还有 ${warningCount} 个待处理项，建议先处理后再发布当前对象。`
              : "当前配置已进入待发布列表，可直接执行生效操作。"}
          </Typography.Text>
          <Space>
            <Button type="primary" size="small" onClick={onGoPublish} disabled={actionDisabled} title={actionDisabledReason}>
              {actionLabel}
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
