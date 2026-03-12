import type { Rule } from "antd/es/form";

export function requiredRule(label: string): Rule {
  return {
    required: true,
    message: `请输入${label}`
  };
}

export function maxLenRule(label: string, max: number): Rule {
  return {
    max,
    message: `${label}长度不能超过 ${max} 个字符`
  };
}

export function idRule(label: string, prefix: string): Rule {
  return {
    pattern: new RegExp(`^${prefix}[a-zA-Z0-9-]*$`),
    message: `${label}需以“${prefix}”开头`
  };
}

export const xpathLikeRule: Rule = {
  validator: (_, value: string | undefined) => {
    if (!value) {
      return Promise.resolve();
    }
    if (value.startsWith("/") || value.startsWith("#") || value.startsWith(".")) {
      return Promise.resolve();
    }
    return Promise.reject(new Error("定位表达式需以 '/'（XPath）或 '#/.'（CSS）开头。"));
  }
};

export const jsonTextRule: Rule = {
  validator: (_, value: string | undefined) => {
    if (!value) {
      return Promise.resolve();
    }
    try {
      JSON.parse(value);
      return Promise.resolve();
    } catch {
      return Promise.reject(new Error("JSON 格式不合法。"));
    }
  }
};
