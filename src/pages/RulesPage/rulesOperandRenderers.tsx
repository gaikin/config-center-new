import { Input, Select } from "antd";
import { OPERAND_PILL_WIDTH, contextOptions, resolveOperandSummary } from "./rulesPageShared";
import type { InterfaceInputParamDraft, OperandDraft, OperandSide, RulePageFieldOption, SelectedOperand } from "./rulesPageShared";

type OperandPillProps = {
  conditionId: string;
  side: OperandSide;
  operand: OperandDraft;
  selectedOperand: SelectedOperand | null;
  onSelect: (value: SelectedOperand) => void;
};

export function OperandPill({ conditionId, side, operand, selectedOperand, onSelect }: OperandPillProps) {
  const summary = resolveOperandSummary(operand);
  const selected = selectedOperand?.conditionId === conditionId && selectedOperand.side === side;
  return (
    <button type="button" onClick={() => onSelect({ conditionId, side })} style={{ display: "inline-flex", alignItems: "center", gap: 8, width: OPERAND_PILL_WIDTH, minWidth: OPERAND_PILL_WIDTH, maxWidth: OPERAND_PILL_WIDTH, borderRadius: 16, border: `1px solid ${summary.warning ? "var(--cc-source-warning, #FDA29B)" : summary.visual.border}`, background: summary.warning ? "var(--cc-source-warning-bg, #FEF3F2)" : summary.visual.bg, color: summary.warning ? "var(--cc-source-warning, #B42318)" : summary.visual.color, padding: "5px 10px", minHeight: 32, cursor: "pointer", outline: selected ? "2px solid var(--cc-source-selected, #84CAFF)" : "none" }}>
      <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{summary.visual.label}</span>
      <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary.mainText}</span>
    </button>
  );
}

type InterfaceInputValueEditorProps = {
  param: InterfaceInputParamDraft;
  pageFieldOptions: RulePageFieldOption[];
  selectedInterfaceInputConfig: Record<string, string>;
  updateInterfaceInputValue: (paramName: string, value: string) => void;
};

export function InterfaceInputValueEditor({
  param,
  pageFieldOptions,
  selectedInterfaceInputConfig,
  updateInterfaceInputValue
}: InterfaceInputValueEditorProps) {
  const value = selectedInterfaceInputConfig[param.name] ?? param.sourceValue ?? "";
  if (param.sourceType === "PAGE_ELEMENT") return <Select showSearch allowClear placeholder="选择页面字段" value={value || undefined} options={pageFieldOptions} optionFilterProp="label" onChange={(next) => updateInterfaceInputValue(param.name, (next as string) ?? "")} />;
  if (param.sourceType === "CONTEXT") return <Select showSearch allowClear placeholder="选择上下文变量" value={value || undefined} options={contextOptions.map((item) => ({ label: item, value: item }))} onChange={(next) => updateInterfaceInputValue(param.name, (next as string) ?? "")} />;
  return <Input value={value} placeholder={param.sourceType === "API_OUTPUT" ? "输入API输出路径" : "输入固定值"} onChange={(event) => updateInterfaceInputValue(param.name, event.target.value)} />;
}
