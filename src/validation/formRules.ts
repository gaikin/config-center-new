import type {
  ApiInputParam,
  ApiInputRegexTemplateKey,
  ApiOutputParam,
  FieldValidationIssue,
  InterfaceDefinition,
  JobSceneDefinition,
  ListDataDefinition,
  ObjectValidationIssue,
  RuleDefinition,
  SaveValidationReport,
  SectionValidationIssue,
  ValidationIssue,
  ValidationLevel
} from "../types";
import { extractPromptTemplateKeys, parsePromptContentConfig, validatePromptEditorState } from "../promptContent";

let validationCounter = 0;

function nextValidationKey(prefix: string) {
  validationCounter += 1;
  return `${prefix}-${validationCounter}`;
}

export function createFieldIssue(params: {
  section: string;
  field: string;
  label: string;
  message: string;
  level?: ValidationLevel;
  action?: string;
}): FieldValidationIssue {
  return {
    kind: "field",
    key: nextValidationKey("field"),
    level: params.level ?? "blocking",
    section: params.section,
    field: params.field,
    label: params.label,
    message: params.message,
    action: params.action
  };
}

export function createSectionIssue(params: {
  section: string;
  title: string;
  message: string;
  level?: ValidationLevel;
  action?: string;
}): SectionValidationIssue {
  return {
    kind: "section",
    key: nextValidationKey("section"),
    level: params.level ?? "blocking",
    section: params.section,
    title: params.title,
    message: params.message,
    action: params.action
  };
}

export function createObjectIssue(params: {
  section: string;
  objectType: string;
  title: string;
  message: string;
  objectName?: string;
  level?: ValidationLevel;
  action?: string;
}): ObjectValidationIssue {
  return {
    kind: "object",
    key: nextValidationKey("object"),
    level: params.level ?? "blocking",
    section: params.section,
    objectType: params.objectType,
    title: params.title,
    message: params.message,
    objectName: params.objectName,
    action: params.action
  };
}

export function isBlank(value: string | undefined | null) {
  return !value || !value.trim();
}

const regexTemplatePatternMap: Record<ApiInputRegexTemplateKey, string> = {
  MOBILE_CN: "^1\\d{10}$",
  ID_CARD_CN: "^\\d{17}[\\dXx]$",
  EMAIL: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
};

export function validateUrlPath(path: string | undefined) {
  if (isBlank(path)) {
    return "请输入路径";
  }
  if (!path?.startsWith("/")) {
    return "路径需以 / 开头";
  }
  return null;
}

export function validatePositiveInteger(value: number | undefined, min = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "请输入有效数值";
  }
  if (value < min) {
    return `数值需大于等于 ${min}`;
  }
  return null;
}

export function tryParseJson(text: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "JSON 解析失败"
    };
  }
}

export function buildSaveValidationReport(params: {
  objectLabel: string;
  fieldIssues?: FieldValidationIssue[];
  sectionIssues?: SectionValidationIssue[];
  objectIssues?: ObjectValidationIssue[];
}): SaveValidationReport {
  const fieldIssues = params.fieldIssues ?? [];
  const sectionIssues = params.sectionIssues ?? [];
  const objectIssues = params.objectIssues ?? [];
  const allIssues: ValidationIssue[] = [...fieldIssues, ...sectionIssues, ...objectIssues];
  const blockingCount = allIssues.filter((issue) => issue.level === "blocking").length;
  const warningCount = allIssues.filter((issue) => issue.level === "warning").length;
  const canSaveDraft = blockingCount === 0;

  let summary = `${params.objectLabel}检查通过，可继续保存。`;
  if (blockingCount > 0) {
    summary = `${params.objectLabel}存在 ${blockingCount} 个阻断项，请先修复后再保存。`;
  } else if (warningCount > 0) {
    summary = `${params.objectLabel}可保存草稿，但还有 ${warningCount} 个提醒建议处理。`;
  }

  return {
    ok: blockingCount === 0,
    canSaveDraft,
    summary,
    fieldIssues,
    sectionIssues,
    objectIssues,
    blockingCount,
    warningCount
  };
}

export function getIssuesFromReport(report: SaveValidationReport | null | undefined, sections?: string[]) {
  if (!report) {
    return [] as ValidationIssue[];
  }
  const allIssues: ValidationIssue[] = [...report.fieldIssues, ...report.sectionIssues, ...report.objectIssues];
  if (!sections || sections.length === 0) {
    return allIssues;
  }
  return allIssues.filter((issue) => sections.includes(issue.section));
}

export function validateRuleDraftPayload(
  payload: Pick<
    RuleDefinition,
    | "id"
    | "name"
    | "ruleScope"
    | "pageResourceId"
    | "priority"
    | "promptMode"
    | "closeMode"
    | "closeTimeoutSec"
    | "hasConfirmButton"
    | "sceneId"
    | "ownerOrgId"
    | "promptContentConfigJson"
  > & {
    availablePromptVariableKeys?: string[];
  },
  existingRules: RuleDefinition[]
) {
  const fieldIssues: FieldValidationIssue[] = [];
  const objectIssues: ObjectValidationIssue[] = [];
  const promptContent = parsePromptContentConfig(payload.promptContentConfigJson);

  if (payload.ruleScope === "PAGE_RESOURCE" && !payload.pageResourceId) {
    fieldIssues.push(createFieldIssue({ section: "page", field: "pageResourceId", label: "页面资源", message: "请选择页面资源" }));
  }
  if (isBlank(payload.name)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "name", label: "规则名称", message: "请输入规则名称" }));
  }
  const priorityError = validatePositiveInteger(payload.priority, 1);
  if (priorityError) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "priority", label: "优先级", message: priorityError }));
  }
  if (isBlank(payload.ownerOrgId)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "ownerOrgId", label: "组织范围", message: "请选择组织范围" }));
  }
  if ((promptContent.titleSuffix ?? "").trim().length > 20) {
    fieldIssues.push(createFieldIssue({ section: "content", field: "titleSuffix", label: "标题后缀", message: "标题后缀最多 20 个字符" }));
  }
  if (isBlank(promptContent.bodyTemplate)) {
    fieldIssues.push(createFieldIssue({ section: "content", field: "bodyTemplate", label: "提示正文", message: "请输入提示正文" }));
  } else if (promptContent.bodyTemplate.length > 300) {
    fieldIssues.push(createFieldIssue({ section: "content", field: "bodyTemplate", label: "提示正文", message: "提示正文最多 300 个字符" }));
  }
  if (payload.availablePromptVariableKeys && payload.availablePromptVariableKeys.length > 0) {
    const invalidKeys = extractPromptTemplateKeys(promptContent.bodyTemplate).filter((key) => !payload.availablePromptVariableKeys?.includes(key));
    if (invalidKeys.length > 0) {
      fieldIssues.push(
        createFieldIssue({
          section: "content",
          field: "bodyTemplate",
          label: "提示正文",
          message: `存在未注册变量：${invalidKeys.join("、")}`
        })
      );
    }
  }
  const editorStateIssues = validatePromptEditorState({
    bodyTemplate: promptContent.bodyTemplate,
    bodyEditorStateJson: promptContent.bodyEditorStateJson,
    availableVariableKeys: payload.availablePromptVariableKeys
  });
  for (const issue of editorStateIssues) {
    fieldIssues.push(
      createFieldIssue({
        section: "content",
        field: "bodyTemplate",
        label: "提示正文",
        message: issue
      })
    );
  }
  if (payload.closeMode === "TIMER_THEN_MANUAL") {
    const timeoutError = validatePositiveInteger(payload.closeTimeoutSec, 1);
    if (timeoutError) {
      fieldIssues.push(createFieldIssue({ section: "basic", field: "closeTimeoutSec", label: "关闭超时", message: timeoutError }));
    }
  }

  const duplicated = existingRules.some((item) => item.name === payload.name && item.id !== payload.id);
  if (duplicated) {
    objectIssues.push(
      createObjectIssue({
        section: "confirm",
        objectType: "RULE",
        title: "规则名称重复",
        message: `已存在同名规则：${payload.name}`,
        objectName: payload.name,
        action: "请更换规则名称后再保存。"
      })
    );
  }

  if (payload.promptMode === "SILENT") {
    objectIssues.push(
      createObjectIssue({
        section: "confirm",
        objectType: "RULE",
        title: "预览与实际展示可能不同",
        message: "当前内容预览固定展示为浮窗形态；若运行时选择静默提示，最终展示效果会弱于预览。",
        level: "warning",
        action: "如需和预览保持一致，建议使用浮窗提示。"
      })
    );
  }

  return buildSaveValidationReport({
    objectLabel: "规则保存",
    fieldIssues,
    objectIssues
  });
}

export function validateInterfaceDraftPayload(
  payload: Pick<
    InterfaceDefinition,
    "id" | "name" | "description" | "method" | "testPath" | "prodPath" | "ownerOrgId" | "timeoutMs" | "retryTimes" | "bodyTemplateJson" | "maskSensitive"
  >,
  inputConfig: Record<string, ApiInputParam[]>,
  outputConfig: ApiOutputParam[],
  existingInterfaces: InterfaceDefinition[]
) {
  const fieldIssues: FieldValidationIssue[] = [];
  const sectionIssues: SectionValidationIssue[] = [];
  const objectIssues: ObjectValidationIssue[] = [];

  if (isBlank(payload.name)) {
    fieldIssues.push(createFieldIssue({ section: "purpose", field: "name", label: "名称", message: "请输入接口名称" }));
  }
  if (isBlank(payload.description)) {
    fieldIssues.push(createFieldIssue({ section: "purpose", field: "description", label: "用途说明", message: "请输入用途说明" }));
  }
  if (isBlank(payload.ownerOrgId)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "ownerOrgId", label: "机构范围", message: "请选择机构范围" }));
  }
  const testPathError = validateUrlPath(payload.testPath);
  if (testPathError) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "testPath", label: "测试环境路径", message: testPathError }));
  }
  const prodPathError = validateUrlPath(payload.prodPath);
  if (prodPathError) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "prodPath", label: "生产环境路径", message: prodPathError }));
  }
  const timeoutError = validatePositiveInteger(payload.timeoutMs, 1);
  if (timeoutError || payload.timeoutMs > 5000) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "timeoutMs", label: "超时", message: timeoutError ?? "超时不能超过 5000ms" }));
  }
  if (typeof payload.retryTimes !== "number" || payload.retryTimes < 0 || payload.retryTimes > 3) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "retryTimes", label: "重试次数", message: "重试次数需在 0 到 3 之间" }));
  }

  if (!isBlank(payload.bodyTemplateJson)) {
    const bodyResult = tryParseJson(payload.bodyTemplateJson);
    if (!bodyResult.ok) {
      fieldIssues.push(
        createFieldIssue({
          section: "params",
          field: "bodyTemplateJson",
          label: "Body JSON 模板",
          message: "JSON 格式错误，无法解析为请求示例",
          action: bodyResult.error
        })
      );
    }
  }

  const inputEntries = Object.entries(inputConfig);
  for (const [tab, rows] of inputEntries) {
    const seenNames = new Set<string>();
    for (const row of rows) {
      const legacyRow = row as ApiInputParam & { required?: boolean };
      const validationConfig = row.validationConfig;
      const required = Boolean(validationConfig?.required ?? legacyRow.required);
      const regexMode = validationConfig?.regexMode ?? "NONE";
      const regexTemplateKey = validationConfig?.regexTemplateKey;
      const regexPattern = validationConfig?.regexPattern?.trim() ?? "";

      if (isBlank(row.name)) {
        fieldIssues.push(createFieldIssue({ section: "params", field: `input:${row.id}:name`, label: `${tab} 参数名`, message: "参数名不能为空" }));
      } else if (seenNames.has(row.name.trim())) {
        fieldIssues.push(createFieldIssue({ section: "params", field: `input:${row.id}:name`, label: `${tab} 参数名`, message: `参数名重复：${row.name}` }));
      } else {
        seenNames.add(row.name.trim());
      }

      if (required && isBlank(row.name)) {
        fieldIssues.push(
          createFieldIssue({
            section: "params",
            field: `input:${row.id}:required`,
            label: `${tab} 参数校验`,
            message: "必填参数必须具备有效参数名"
          })
        );
      }

      if (regexMode === "TEMPLATE") {
        if (!regexTemplateKey || !regexTemplatePatternMap[regexTemplateKey]) {
          fieldIssues.push(
            createFieldIssue({
              section: "params",
              field: `input:${row.id}:validationConfig.regexTemplateKey`,
              label: `${row.name || tab} 正则模板`,
              message: "请选择正则模板"
            })
          );
        }
      } else if (regexMode === "CUSTOM") {
        if (!regexPattern) {
          fieldIssues.push(
            createFieldIssue({
              section: "params",
              field: `input:${row.id}:validationConfig.regexPattern`,
              label: `${row.name || tab} 正则表达式`,
              message: "请输入自定义正则"
            })
          );
        } else {
          try {
            // Validate custom regex format to avoid saving invalid patterns.
            void new RegExp(regexPattern);
          } catch {
            fieldIssues.push(
              createFieldIssue({
                section: "params",
                field: `input:${row.id}:validationConfig.regexPattern`,
                label: `${row.name || tab} 正则表达式`,
                message: "自定义正则格式不合法"
              })
            );
          }
        }
      }
    }
  }

  const outputPaths = new Set<string>();
  for (const row of outputConfig) {
    if (isBlank(row.name)) {
      fieldIssues.push(createFieldIssue({ section: "params", field: `output:${row.id}:name`, label: "返回字段名", message: "返回字段名不能为空" }));
    }
    if (isBlank(row.path)) {
      fieldIssues.push(createFieldIssue({ section: "params", field: `output:${row.id}:path`, label: row.name || "返回字段路径", message: "返回字段路径不能为空" }));
    } else if (outputPaths.has(row.path.trim())) {
      fieldIssues.push(createFieldIssue({ section: "params", field: `output:${row.id}:path`, label: row.name || "返回字段路径", message: `返回字段路径重复：${row.path}` }));
    } else {
      outputPaths.add(row.path.trim());
    }
  }

  if (outputConfig.length === 0) {
    sectionIssues.push(
      createSectionIssue({
        section: "params",
        title: "返回参数示例",
        message: "当前还没有维护任何返回字段，保存后会影响规则和作业对该 API 的复用。",
        level: "warning",
        action: "建议至少补充一个核心返回字段。"
      })
    );
  }

  const duplicated = existingInterfaces.some((item) => item.name === payload.name && item.id !== payload.id);
  if (duplicated) {
    objectIssues.push(
      createObjectIssue({
        section: "confirm",
        objectType: "INTERFACE",
        title: "接口名称重复",
        message: `已存在同名 API：${payload.name}`,
        objectName: payload.name,
        action: "请更换接口名称后再保存。"
      })
    );
  }

  if (!payload.maskSensitive) {
    objectIssues.push(
      createObjectIssue({
        section: "confirm",
        objectType: "INTERFACE",
        title: "未开启敏感字段脱敏",
        message: "如果返回内容包含手机号、证件号等字段，建议开启脱敏。",
        level: "warning"
      })
    );
  }

  return buildSaveValidationReport({
    objectLabel: "API 保存",
    fieldIssues,
    sectionIssues,
    objectIssues
  });
}

export function validateJobSceneDraftPayload(
  payload: Pick<
    JobSceneDefinition,
    | "id"
    | "name"
    | "pageResourceId"
    | "executionMode"
    | "floatingButtonLabel"
    | "floatingButtonEnabled"
    | "floatingButtonX"
    | "floatingButtonY"
    | "nodeCount"
    | "manualDurationSec"
    | "riskConfirmed"
  >,
  existingScenes: JobSceneDefinition[],
  options?: {
    linkedRules?: Array<Pick<RuleDefinition, "id" | "name" | "promptMode">>;
  }
) {
  const fieldIssues: FieldValidationIssue[] = [];
  const objectIssues: ObjectValidationIssue[] = [];

  if (isBlank(payload.name)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "name", label: "场景名称", message: "请输入场景名称" }));
  }
  if (!payload.pageResourceId) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "pageResourceId", label: "页面资源", message: "请选择页面资源" }));
  }
  const durationError = validatePositiveInteger(payload.manualDurationSec, 1);
  if (durationError) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "manualDurationSec", label: "人工基准时长", message: durationError }));
  }
  const needsFloatingButtonConfig = payload.executionMode === "FLOATING_BUTTON" || Boolean(payload.floatingButtonEnabled);
  if (needsFloatingButtonConfig) {
    if (isBlank(payload.floatingButtonLabel)) {
      fieldIssues.push(
        createFieldIssue({
          section: "basic",
          field: "floatingButtonLabel",
          label: "悬浮按钮文案",
          message: "请输入悬浮按钮文案"
        })
      );
    }
    if (
      typeof payload.floatingButtonX !== "number" ||
      Number.isNaN(payload.floatingButtonX) ||
      payload.floatingButtonX < 0 ||
      payload.floatingButtonX > 100
    ) {
      fieldIssues.push(
        createFieldIssue({
          section: "basic",
          field: "floatingButtonX",
          label: "悬浮按钮坐标X",
          message: "请输入 0 到 100 的百分比坐标"
        })
      );
    }
    if (
      typeof payload.floatingButtonY !== "number" ||
      Number.isNaN(payload.floatingButtonY) ||
      payload.floatingButtonY < 0 ||
      payload.floatingButtonY > 100
    ) {
      fieldIssues.push(
        createFieldIssue({
          section: "basic",
          field: "floatingButtonY",
          label: "悬浮按钮坐标Y",
          message: "请输入 0 到 100 的百分比坐标"
        })
      );
    }
  }

  const duplicated = existingScenes.some((item) => item.name === payload.name && item.id !== payload.id);
  if (duplicated) {
    objectIssues.push(
      createObjectIssue({
        section: "basic",
        objectType: "JOB_SCENE",
        title: "场景名称重复",
        message: `已存在同名作业场景：${payload.name}`,
        objectName: payload.name,
        action: "请更换场景名称后再保存。"
      })
    );
  }

  const linkedFloatingRules = (options?.linkedRules ?? []).filter((rule) => rule.promptMode === "FLOATING");
  if (payload.executionMode === "AUTO_WITHOUT_PROMPT" && linkedFloatingRules.length > 0) {
    objectIssues.push(
      createObjectIssue({
        section: "basic",
        objectType: "JOB_SCENE",
        title: "提示优先：静默不会生效",
        message: `当前场景已关联 ${linkedFloatingRules.length} 条浮窗提示规则（${linkedFloatingRules
          .slice(0, 2)
          .map((rule) => rule.name)
          .join("、")}${linkedFloatingRules.length > 2 ? "等" : ""}），运行时将按提示配置弹窗。`,
        level: "warning",
        action: "如需静默执行，请先将关联规则的提示模式改为“静默提示”。"
      })
    );
  }

  return buildSaveValidationReport({
    objectLabel: "作业场景保存",
    fieldIssues,
    objectIssues
  });
}

export function validateListDataDraftPayload(
  payload: Pick<
    ListDataDefinition,
    | "id"
    | "name"
    | "description"
    | "ownerOrgId"
    | "scope"
    | "effectiveStartAt"
    | "effectiveEndAt"
    | "rowCount"
    | "importColumns"
    | "outputFields"
    | "importFileName"
  >,
  existingListDatas: ListDataDefinition[]
) {
  const fieldIssues: FieldValidationIssue[] = [];
  const objectIssues: ObjectValidationIssue[] = [];

  if (isBlank(payload.name)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "name", label: "名单名称", message: "请输入名单名称" }));
  }
  if (isBlank(payload.ownerOrgId)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "ownerOrgId", label: "归属机构", message: "请选择归属机构" }));
  }
  if (isBlank(payload.scope)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "scope", label: "适用范围", message: "请输入适用范围" }));
  }
  if (isBlank(payload.effectiveStartAt)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "effectiveStartAt", label: "生效开始时间", message: "请输入生效开始时间" }));
  }
  if (isBlank(payload.effectiveEndAt)) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "effectiveEndAt", label: "生效结束时间", message: "请输入生效结束时间" }));
  }
  if (!isBlank(payload.effectiveStartAt) && !isBlank(payload.effectiveEndAt) && payload.effectiveStartAt > payload.effectiveEndAt) {
    fieldIssues.push(createFieldIssue({ section: "basic", field: "effectiveEndAt", label: "生效结束时间", message: "结束时间不能早于开始时间" }));
  }
  if (isBlank(payload.importFileName)) {
    fieldIssues.push(createFieldIssue({ section: "parse", field: "importFileName", label: "导入文件", message: "请填写导入文件名" }));
  }
  if (!Array.isArray(payload.importColumns) || payload.importColumns.length === 0) {
    fieldIssues.push(createFieldIssue({ section: "parse", field: "importColumns", label: "导入字段", message: "请先解析表头" }));
  }
  if (!Array.isArray(payload.outputFields) || payload.outputFields.length === 0) {
    fieldIssues.push(createFieldIssue({ section: "parse", field: "outputFields", label: "输出字段", message: "请至少配置一个输出字段" }));
  }
  if (
    Array.isArray(payload.importColumns) &&
    payload.importColumns.length > 0 &&
    Array.isArray(payload.outputFields) &&
    payload.outputFields.some((item) => !payload.importColumns.includes(item))
  ) {
    fieldIssues.push(
      createFieldIssue({
        section: "parse",
        field: "outputFields",
        label: "输出字段",
        message: "输出字段必须从解析表头中选择"
      })
    );
  }
  const rowCountError = validatePositiveInteger(payload.rowCount, 1);
  if (rowCountError) {
    fieldIssues.push(createFieldIssue({ section: "parse", field: "rowCount", label: "数据条数", message: rowCountError }));
  }

  const duplicated = existingListDatas.some((item) => item.name === payload.name && item.id !== payload.id);
  if (duplicated) {
    objectIssues.push(
      createObjectIssue({
        section: "confirm",
        objectType: "LIST_DATA",
        title: "名单名称重复",
        message: `已存在同名名单：${payload.name}`,
        objectName: payload.name,
        action: "请更换名单名称后再保存。"
      })
    );
  }

  if (isBlank(payload.description)) {
    objectIssues.push(
      createObjectIssue({
        section: "confirm",
        objectType: "LIST_DATA",
        title: "建议补充名单说明",
        message: "当前名单未填写说明，后续规则和作业复用时不利于理解用途。",
        level: "warning",
        action: "建议补充名单说明、适用场景和维护责任。"
      })
    );
  }

  return buildSaveValidationReport({
    objectLabel: "名单数据保存",
    fieldIssues,
    objectIssues
  });
}
