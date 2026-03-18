import type {
  ApiOutputPathMode,
  ApiInputRegexMode,
  ApiInputRegexTemplateKey,
  ApiInputValidationConfig,
  ApiInputParam,
  ApiOutputParam,
  ApiValueType,
  InterfaceDefinition,
  LifecycleState
} from "../../types";

export type StatusFilter = "ALL" | LifecycleState;
export type InputTabKey = "headers" | "query" | "path" | "body";
export type DebugEnv = "TEST" | "PROD";

export type ApiRegisterForm = {
  name: string;
  description: string;
  method: InterfaceDefinition["method"];
  testPath: string;
  prodPath: string;
  timeoutMs: number;
  retryTimes: number;
  status: LifecycleState;
  ownerOrgId: string;
  maskSensitive: boolean;
  bodyTemplateJson: string;
};

export type InputConfigDraft = Record<InputTabKey, ApiInputParam[]>;

export type DebugResult = {
  requestPath: string;
  requestBody: Record<string, unknown>;
  responseBody: Record<string, unknown>;
  latencyMs: number;
};

export const statusColor: Record<LifecycleState, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  DISABLED: "orange",
  EXPIRED: "red"
};

export const valueTypeOptions: Array<{ label: string; value: ApiValueType }> = [
  { label: "字符串", value: "STRING" },
  { label: "数字", value: "NUMBER" },
  { label: "布尔", value: "BOOLEAN" },
  { label: "对象", value: "OBJECT" },
  { label: "数组", value: "ARRAY" }
];

export const regexModeOptions: Array<{ label: string; value: ApiInputRegexMode }> = [
  { label: "不校验", value: "NONE" },
  { label: "模板", value: "TEMPLATE" },
  { label: "自定义", value: "CUSTOM" }
];

export const regexTemplateOptions: Array<{ label: string; value: ApiInputRegexTemplateKey; pattern: string }> = [
  { label: "手机号(11位)", value: "MOBILE_CN", pattern: "^1\\d{10}$" },
  { label: "身份证号(18位)", value: "ID_CARD_CN", pattern: "^\\d{17}[\\dXx]$" },
  { label: "邮箱", value: "EMAIL", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" }
];

export const tabLabels: Record<InputTabKey, string> = {
  headers: "Header",
  query: "Query",
  path: "Path",
  body: "Body"
};

export function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function defaultInputValidationConfig(
  patch?: Partial<ApiInputValidationConfig> | null
): ApiInputValidationConfig {
  return {
    required: patch?.required ?? false,
    regexMode: patch?.regexMode ?? "NONE",
    regexTemplateKey: patch?.regexTemplateKey,
    regexPattern: patch?.regexPattern ?? "",
    regexErrorMessage: patch?.regexErrorMessage ?? ""
  };
}

export function defaultInputParam(patch?: Partial<ApiInputParam>): ApiInputParam {
  const legacyPatch = patch as Partial<ApiInputParam> & { required?: boolean };
  return {
    id: patch?.id ?? buildId("param"),
    name: patch?.name ?? "",
    description: patch?.description ?? "",
    valueType: patch?.valueType ?? "STRING",
    validationConfig: defaultInputValidationConfig({
      ...patch?.validationConfig,
      required: patch?.validationConfig?.required ?? legacyPatch.required
    })
  };
}

export function defaultOutputParam(patch?: Partial<ApiOutputParam>): ApiOutputParam {
  return {
    id: patch?.id ?? buildId("output"),
    name: patch?.name ?? "",
    path: patch?.path ?? "",
    pathMode: patch?.pathMode ?? "AUTO",
    description: patch?.description ?? "",
    valueType: patch?.valueType ?? "STRING",
    children: patch?.children ?? []
  };
}

export const emptyInputConfig = (): InputConfigDraft => ({
  headers: [],
  query: [],
  path: [],
  body: []
});

export function parseJsonSafe<T>(jsonText: string, fallback: T): T {
  try {
    const parsed = JSON.parse(jsonText) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

export function normalizeInputConfig(jsonText: string): InputConfigDraft {
  const parsed = parseJsonSafe<Record<string, unknown>>(jsonText, {});

  const normalizeArray = (key: InputTabKey) => {
    const row = parsed[key];
    if (!Array.isArray(row)) {
      return [];
    }

    return row.map((item) => {
      const next = typeof item === "object" && item ? (item as Partial<ApiInputParam> & { required?: boolean }) : {};
      return defaultInputParam(next);
    });
  };

  return {
    headers: normalizeArray("headers"),
    query: normalizeArray("query"),
    path: normalizeArray("path"),
    body: normalizeArray("body")
  };
}

export function normalizeOutputConfig(jsonText: string): ApiOutputParam[] {
  const parsed = parseJsonSafe<unknown[]>(jsonText, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const normalize = (item: unknown): ApiOutputParam => {
    const raw = typeof item === "object" && item ? (item as Partial<ApiOutputParam>) : {};
    const children = Array.isArray(raw.children) ? raw.children.map((child) => normalize(child)) : [];
    const pathMode: ApiOutputPathMode = raw.pathMode === "MANUAL" ? "MANUAL" : "AUTO";
    return defaultOutputParam({
      ...raw,
      pathMode,
      children
    });
  };

  return parsed.map((item) => normalize(item));
}
export function inferValueType(value: unknown): ApiValueType {
  if (Array.isArray(value)) {
    return "ARRAY";
  }
  if (value !== null && typeof value === "object") {
    return "OBJECT";
  }
  if (typeof value === "number") {
    return "NUMBER";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  return "STRING";
}

export function flattenBodyParams(value: unknown, prefix = ""): ApiInputParam[] {
  if (Array.isArray(value)) {
    return [
      defaultInputParam({
        name: prefix || "array_field",
        valueType: "ARRAY",
        description: "由 Body JSON 解析"
      })
    ];
  }

  if (value !== null && typeof value === "object") {
    const rows: ApiInputParam[] = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const name = prefix ? `${prefix}.${key}` : key;
      const childType = inferValueType(child);
      if (childType === "OBJECT") {
        rows.push(...flattenBodyParams(child, name));
      } else {
        rows.push(
          defaultInputParam({
            name,
            valueType: childType,
            description: "由 Body JSON 解析"
          })
        );
      }
    }
    return rows;
  }

  return [
    defaultInputParam({
      name: prefix || "value",
      valueType: inferValueType(value),
      description: "由 Body JSON 解析"
    })
  ];
}

export function parseOutputFromSampleObject(value: unknown, basePath = "$.data"): ApiOutputParam[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rows: ApiOutputParam[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = `${basePath}.${key}`;
    const childType = inferValueType(child);

    if (childType === "OBJECT") {
      rows.push(
        defaultOutputParam({
          name: key,
          path,
          pathMode: "AUTO",
          valueType: "OBJECT",
          description: "由返回 JSON 解析",
          children: parseOutputFromSampleObject(child, path)
        })
      );
      continue;
    }

    if (childType === "ARRAY") {
      const arrayValue = child as unknown[];
      const first = arrayValue[0];
      rows.push(
        defaultOutputParam({
          name: key,
          path,
          pathMode: "AUTO",
          valueType: "ARRAY",
          description: "由返回 JSON 解析",
          children:
            first && typeof first === "object" && !Array.isArray(first)
              ? parseOutputFromSampleObject(first, `${path}[0]`)
              : []
        })
      );
      continue;
    }

    rows.push(
      defaultOutputParam({
        name: key,
        path,
        pathMode: "AUTO",
        valueType: childType,
        description: "由返回 JSON 解析"
      })
    );
  }

  return rows;
}

export function buildInputSummary(config: InputConfigDraft) {
  return `Header ${config.headers.length} / Query ${config.query.length} / Path ${config.path.length} / Body ${config.body.length}`;
}

export function getResponsePath(outputs: ApiOutputParam[]) {
  if (outputs.length === 0) {
    return "$.data";
  }
  return outputs[0].path || "$.data";
}

export function updateByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const normalized = path.startsWith("$.") ? path.slice(2) : path;
  const parts = normalized.replace(/\[\d+\]/g, "").split(".").filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (typeof cursor[key] !== "object" || cursor[key] === null || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

export function buildMockFieldValue(field: ApiOutputParam): unknown {
  if (field.valueType === "OBJECT") {
    const obj: Record<string, unknown> = {};
    for (const child of field.children ?? []) {
      obj[child.name] = buildMockFieldValue(child);
    }
    return obj;
  }

  if (field.valueType === "ARRAY") {
    if ((field.children ?? []).length > 0) {
      const row: Record<string, unknown> = {};
      for (const child of field.children ?? []) {
        row[child.name] = buildMockFieldValue(child);
      }
      return [row];
    }
    return [`sample_${field.name || "item"}`];
  }

  if (field.valueType === "NUMBER") {
    return 88;
  }

  if (field.valueType === "BOOLEAN") {
    return true;
  }

  return `${field.name || "field"}_value`;
}

export function buildMockResponseBody(outputs: ApiOutputParam[]) {
  const root: Record<string, unknown> = { data: {} };
  for (const field of outputs) {
    updateByPath(root, field.path || `$.data.${field.name}`, buildMockFieldValue(field));
  }
  return root;
}
