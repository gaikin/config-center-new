import { Alert, Input, Modal, Segmented, Select, Space, Spin, Table, Typography } from "antd";
import type { ReactNode } from "react";
import type { EffectiveActionMeta, EffectiveScopeMode } from "../effectiveFlow";
import type { PublishValidationReport, ValidationReport } from "../types";

type EffectiveConfirmModalProps = {
  open: boolean;
  objectName: string;
  action: EffectiveActionMeta;
  loading?: boolean;
  confirming?: boolean;
  canConfirm?: boolean;
  blockedMessage?: string | null;
  validationReport?: PublishValidationReport | null;
  scopeMode?: EffectiveScopeMode;
  scopeOrgIds?: string[];
  scopeOptions?: Array<{ label: string; value: string }>;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  onScopeModeChange?: (value: EffectiveScopeMode) => void;
  onScopeOrgIdsChange?: (value: string[]) => void;
  onEffectiveStartAtChange?: (value: string) => void;
  onEffectiveEndAtChange?: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function EffectiveConfirmModal({
  open,
  objectName,
  action,
  loading = false,
  confirming = false,
  canConfirm = true,
  blockedMessage,
  validationReport,
  scopeMode = "ALL_ORGS",
  scopeOrgIds = [],
  scopeOptions = [],
  effectiveStartAt = "",
  effectiveEndAt = "",
  onScopeModeChange,
  onScopeOrgIdsChange,
  onEffectiveStartAtChange,
  onEffectiveEndAtChange,
  onCancel,
  onConfirm
}: EffectiveConfirmModalProps) {
  const requiresEffectiveConfig = action.type !== "DISABLE";
  const hasBlocking = Boolean(validationReport && !validationReport.pass);
  const needsCustomScope = requiresEffectiveConfig && scopeMode === "CUSTOM_ORGS";
  const missingCustomScope = needsCustomScope && scopeOrgIds.length === 0;
  const missingEffectiveTime = requiresEffectiveConfig && (!effectiveStartAt.trim() || !effectiveEndAt.trim());
  const invalidEffectiveTime =
    requiresEffectiveConfig &&
    effectiveStartAt.trim().length > 0 &&
    effectiveEndAt.trim().length > 0 &&
    effectiveStartAt.trim() > effectiveEndAt.trim();
  const blockingItems = validationReport?.items.filter((item) => !item.passed) ?? [];

  return (
    <Modal
      title={action.title}
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      okText={action.label}
      confirmLoading={confirming}
      okButtonProps={{ disabled: loading || hasBlocking || !canConfirm || missingCustomScope || missingEffectiveTime || invalidEffectiveTime }}
      cancelText="取消"
      width={760}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <Alert
          showIcon
          type={action.type === "DISABLE" ? "warning" : "info"}
          message={`对象：${objectName}`}
          description={action.description}
        />

        {blockedMessage ? <Alert showIcon type="error" message={blockedMessage} /> : null}

        {requiresEffectiveConfig ? (
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              <CardLike title="规则生效时间">
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  <Input
                    placeholder="开始时间，如 2026-03-16 14:00"
                    value={effectiveStartAt}
                    onChange={(event) => onEffectiveStartAtChange?.(event.target.value)}
                  />
                  <Input
                    placeholder="结束时间，如 2026-12-31 23:59"
                    value={effectiveEndAt}
                    onChange={(event) => onEffectiveEndAtChange?.(event.target.value)}
                  />
                  <Typography.Text type="secondary">
                    这里配置的是规则自身生效时间范围；确认后当前版本立即生效，并按该时间范围运行。
                  </Typography.Text>
                </Space>
              </CardLike>

              <CardLike title="生效范围">
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  <Segmented
                    value={scopeMode}
                    onChange={(value) => onScopeModeChange?.(value as EffectiveScopeMode)}
                    options={[
                      { label: "全部机构", value: "ALL_ORGS" },
                      { label: "自定义机构", value: "CUSTOM_ORGS" }
                    ]}
                  />
                  {needsCustomScope ? (
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="请选择机构范围"
                      value={scopeOrgIds}
                      options={scopeOptions}
                      onChange={(value) => onScopeOrgIdsChange?.(value)}
                    />
                  ) : null}
                  <Typography.Text type="secondary">
                    生效范围仅在本次生效时使用，系统会按本次选择写入生效日志。
                  </Typography.Text>
                </Space>
              </CardLike>

              {missingEffectiveTime ? <Alert showIcon type="warning" message="请补充规则生效开始和结束时间后再确认。" /> : null}
              {invalidEffectiveTime ? <Alert showIcon type="warning" message="规则生效结束时间不能早于开始时间。" /> : null}
              {missingCustomScope ? <Alert showIcon type="warning" message="请选择至少一个机构后再生效。" /> : null}

              {loading ? (
                <Space style={{ width: "100%", justifyContent: "center", padding: "20px 0" }}>
                  <Spin />
                  <Typography.Text type="secondary">正在加载生效检查结果...</Typography.Text>
                </Space>
              ) : validationReport ? (
                <>
                  {validationReport.impactSummary ? (
                    <Typography.Text type="secondary">{validationReport.impactSummary}</Typography.Text>
                  ) : null}
                  {blockingItems.length > 0 ? (
                    <Table<ValidationReport["items"][number]>
                      rowKey="key"
                      size="small"
                      pagination={false}
                      dataSource={blockingItems}
                      columns={[
                        { title: "阻断项", dataIndex: "label", width: 220 },
                        { title: "处理建议", dataIndex: "detail" }
                      ]}
                    />
                  ) : (
                    <Alert showIcon type="info" message="当前没有阻断项，可继续生效。" />
                  )}
                </>
              ) : action.type === "RESTORE" ? (
                <Alert
                  showIcon
                  type="info"
                  message="恢复生效会按本次填写的时间范围与机构范围重新发布当前规则。"
                />
              ) : (
                <Alert showIcon type="warning" message="暂未加载到检查结果，请稍后重试。" />
              )}
            </Space>
        ) : null}
      </Space>
    </Modal>
  );
}

function CardLike({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: 12
      }}
    >
      <Typography.Text strong>{title}</Typography.Text>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}
