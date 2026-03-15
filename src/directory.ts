export type DirectoryValue = string | number;

export type DirectoryOption = {
  label: string;
  value: DirectoryValue;
};

export const orgOptions: DirectoryOption[] = [
  { label: "总行", value: "head-office" },
  { label: "华东分行", value: "branch-east" },
  { label: "华东分行二级支行", value: "branch-east-sub1" },
  { label: "华南分行", value: "branch-south" }
];

export const personOptions: DirectoryOption[] = [
  { label: "张三", value: "person-zhang-san" },
  { label: "李四", value: "person-li-si" },
  { label: "王五", value: "person-wang-wu" },
  { label: "赵六", value: "person-zhao-liu" },
  { label: "赵一", value: "person-zhao-yi" },
  { label: "钱二", value: "person-qian-er" },
  { label: "孙三", value: "person-sun-san" },
  { label: "周总", value: "person-zhou-zong" },
  { label: "吴主管", value: "person-wu-zhuguan" },
  { label: "平台支持A", value: "person-platform-support-a" },
  { label: "李主管", value: "person-li-manager" },
  { label: "王经理", value: "person-wang-manager" },
  { label: "业务超管", value: "person-business-super-admin" },
  { label: "业务经理-华东", value: "person-business-manager-east" },
  { label: "业务经理", value: "person-business-manager" },
  { label: "业务管理员", value: "person-business-admin" }
];

const orgLabelMap: Record<string, string> = Object.fromEntries(orgOptions.map((item) => [String(item.value), item.label]));
const personLabelMap: Record<string, string> = Object.fromEntries(personOptions.map((item) => [String(item.value), item.label]));

const personAliasMap: Record<string, string> = Object.fromEntries(
  personOptions.flatMap((item) => [
    [String(item.value), String(item.value)],
    [item.label, String(item.value)]
  ])
);

personAliasMap["Business Manager"] = "person-business-manager";
personAliasMap["Business Admin"] = "person-business-admin";

export function getOrgLabel(orgId?: DirectoryValue | null) {
  if (orgId === undefined || orgId === null || orgId === "") {
    return "-";
  }
  return orgLabelMap[String(orgId)] ?? String(orgId);
}

export function normalizePersonValue(personId?: DirectoryValue | null) {
  if (personId === undefined || personId === null || personId === "") {
    return "";
  }
  return personAliasMap[String(personId)] ?? String(personId);
}

export function getPersonLabel(personId?: DirectoryValue | null) {
  if (personId === undefined || personId === null || personId === "") {
    return "-";
  }
  const normalized = normalizePersonValue(personId);
  return personLabelMap[normalized] ?? String(personId);
}

export function toOrgOption(orgId: DirectoryValue): DirectoryOption {
  return {
    label: getOrgLabel(orgId),
    value: orgId
  };
}

export function toPersonOption(personId: DirectoryValue): DirectoryOption {
  const normalized = normalizePersonValue(personId);
  return {
    label: getPersonLabel(normalized),
    value: normalized
  };
}
