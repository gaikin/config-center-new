import type {
  FieldValue,
  RuntimeCondition,
  RuntimeFieldDefinition,
  RuntimeOperand,
  RuntimeRule,
  RuleEvaluationResult
} from "../types/runtime";

function normalizeValue(value: string, normalizers: RuntimeFieldDefinition["normalizers"] = []) {
  let next = value;
  for (const normalizer of normalizers) {
    if (normalizer === "trim") {
      next = next.trim();
    }
    if (normalizer === "digitsOnly") {
      next = next.replace(/\D/g, "");
    }
  }
  return next;
}

function getElementValue(element: Element, field: RuntimeFieldDefinition) {
  if (field.locator.attribute) {
    return element.getAttribute(field.locator.attribute) ?? "";
  }

  if (field.extractor === "textContent" || field.elementType === "READONLY_TEXT" || field.elementType === "BUTTON") {
    return element.textContent ?? "";
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    return element.value ?? "";
  }

  return element.textContent ?? "";
}

export function readFieldValue(field: RuntimeFieldDefinition, root: ParentNode = document): FieldValue {
  if (field.locator.selectorType !== "CSS") {
    return { state: "ABSENT" };
  }

  const element = root.querySelector(field.locator.selector);
  if (!element) {
    return { state: "ABSENT" };
  }

  const normalized = normalizeValue(getElementValue(element, field), field.normalizers);
  if (normalized.length === 0) {
    return { state: "EMPTY", value: "" };
  }

  return {
    state: "VALUE",
    value: normalized
  };
}

export function collectFieldSnapshot(fields: RuntimeFieldDefinition[], root: ParentNode = document) {
  return Object.fromEntries(fields.map((field) => [field.fieldKey, readFieldValue(field, root)])) as Record<string, FieldValue>;
}

function resolveOperand(operand: RuntimeOperand | undefined, snapshot: Record<string, FieldValue>): FieldValue {
  if (!operand) {
    return { state: "ABSENT" };
  }

  if (operand.sourceType === "CONST") {
    const value = operand.value ?? "";
    return value.length > 0 ? { state: "VALUE", value } : { state: "EMPTY", value: "" };
  }

  if (!operand.fieldKey) {
    return { state: "ABSENT" };
  }

  return snapshot[operand.fieldKey] ?? { state: "ABSENT" };
}

function compareValues(condition: RuntimeCondition, snapshot: Record<string, FieldValue>) {
  const left = resolveOperand(condition.left, snapshot);
  if (left.state === "ABSENT") {
    return false;
  }

  if (condition.operator === "EXISTS") {
    return left.state === "VALUE";
  }

  const right = resolveOperand(condition.right, snapshot);
  if (right.state === "ABSENT") {
    return false;
  }

  const leftValue = left.value ?? "";
  const rightValue = right.value ?? "";
  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  const numericComparable = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);

  switch (condition.operator) {
    case "EQ":
      return leftValue === rightValue;
    case "NE":
      return leftValue !== rightValue;
    case "GT":
      return numericComparable ? leftNumber > rightNumber : leftValue > rightValue;
    case "GE":
      return numericComparable ? leftNumber >= rightNumber : leftValue >= rightValue;
    case "LT":
      return numericComparable ? leftNumber < rightNumber : leftValue < rightValue;
    case "LE":
      return numericComparable ? leftNumber <= rightNumber : leftValue <= rightValue;
    case "CONTAINS":
      return leftValue.includes(rightValue);
    default:
      return false;
  }
}

export function evaluateRules(rules: RuntimeRule[], snapshot: Record<string, FieldValue>): RuleEvaluationResult[] {
  return rules
    .slice()
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((rule) => {
      const failedConditionIds = rule.conditions
        .filter((condition) => !compareValues(condition, snapshot))
        .map((condition) => condition.id);

      const matched =
        rule.logicType === "AND"
          ? failedConditionIds.length === 0
          : failedConditionIds.length < rule.conditions.length;

      return {
        rule,
        matched,
        failedConditionIds
      };
    });
}
