import { Select } from "antd";
import type { SelectProps } from "antd";
import type { DirectoryValue } from "../directory";
import { getOrgLabel, getPersonLabel, normalizePersonValue, orgOptions, personOptions } from "../directory";

type OrgSelectProps = SelectProps & {
  includeAll?: boolean;
  allLabel?: string;
};

export function OrgSelect({ includeAll = false, allLabel = "全部机构", options, ...props }: OrgSelectProps) {
  const mergedOptions = options ?? orgOptions;
  const finalOptions = includeAll ? [{ label: allLabel, value: "ALL" }, ...mergedOptions] : mergedOptions;
  return <Select showSearch optionFilterProp="label" options={finalOptions} {...props} />;
}

type PersonSelectProps = SelectProps;

export function PersonMultiSelect({ options, ...props }: PersonSelectProps) {
  const mergedOptions = options ?? personOptions;
  return <Select mode="multiple" showSearch optionFilterProp="label" options={mergedOptions} {...props} />;
}

export function OrgText({ value }: { value?: DirectoryValue | null }) {
  return <>{getOrgLabel(value)}</>;
}

export function PersonText({ value }: { value?: DirectoryValue | null }) {
  return <>{getPersonLabel(value)}</>;
}

export function normalizePersonValues(values: DirectoryValue[]) {
  return values.map((item) => normalizePersonValue(item)).filter(Boolean);
}
