export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}
