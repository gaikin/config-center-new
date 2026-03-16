import { Alert, Button, Space, Tag, Typography } from "antd";
import { useState } from "react";
import type { SaveValidationReport, ValidationIssue, ValidationLevel } from "../types";
import { getIssuesFromReport } from "../validation/formRules";

type ValidationReportPanelProps = {
  report?: SaveValidationReport | null;
  issues?: ValidationIssue[];
  title?: string;
  sections?: string[];
  levels?: ValidationLevel[];
  compact?: boolean;
  maxPreviewItems?: number;
};

function filterIssues(issues: ValidationIssue[], levels?: ValidationLevel[]) {
  if (!levels || levels.length === 0) {
    return issues;
  }
  return issues.filter((issue) => levels.includes(issue.level));
}

function formatIssue(issue: ValidationIssue) {
  if (issue.kind === "field") {
    return {
      title: issue.label,
      detail: issue.message,
      level: issue.level,
      action: issue.action
    };
  }
  return {
    title: issue.title,
    detail: issue.message,
    level: issue.level,
    action: issue.action
  };
}

export function ValidationReportPanel({
  report,
  issues,
  title,
  sections,
  levels,
  compact = false,
  maxPreviewItems = 2
}: ValidationReportPanelProps) {
  const allIssues = issues ? issues : getIssuesFromReport(report, sections);
  const visibleIssues = filterIssues(allIssues, levels);
  const [expanded, setExpanded] = useState(false);

  if (visibleIssues.length === 0) {
    return null;
  }

  const blockingCount = visibleIssues.filter((issue) => issue.level === "blocking").length;
  const warningCount = visibleIssues.filter((issue) => issue.level === "warning").length;
  const message =
    title ??
    (blockingCount > 0
      ? `发现 ${blockingCount} 个阻断项`
      : `有 ${warningCount} 个待处理项`);
  const previewIssues = visibleIssues.slice(0, maxPreviewItems).map((issue) => formatIssue(issue));
  const showCompactToggle = compact;

  return (
    <Alert
      showIcon
      type={blockingCount > 0 ? "error" : "warning"}
      style={{ marginBottom: 12 }}
      message={
        compact ? (
          <Space size={[8, 6]} wrap>
            <Typography.Text strong>{message}</Typography.Text>
            {previewIssues.map((issue) => (
              <Tag key={`${issue.title}-${issue.detail}`} color={issue.level === "blocking" ? "red" : "gold"}>
                {issue.title}
              </Tag>
            ))}
            {showCompactToggle ? (
              <Button type="link" size="small" style={{ paddingInline: 0, height: "auto" }} onClick={() => setExpanded((value) => !value)}>
                {expanded ? "收起详情" : "查看详情"}
              </Button>
            ) : null}
          </Space>
        ) : (
          message
        )
      }
      description={
        compact && !expanded ? null : (
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            {visibleIssues.map((issue) => {
              const item = formatIssue(issue);
              return (
                <div key={issue.key}>
                  <Space size={8} wrap>
                    <Tag color={item.level === "blocking" ? "red" : "gold"}>
                      {item.level === "blocking" ? "阻断" : "待处理"}
                    </Tag>
                    <Typography.Text strong>{item.title}</Typography.Text>
                  </Space>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {item.detail}
                  </Typography.Paragraph>
                  {item.action ? (
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      处理方式：{item.action}
                    </Typography.Paragraph>
                  ) : null}
                </div>
              );
            })}
          </Space>
        )
      }
    />
  );
}
