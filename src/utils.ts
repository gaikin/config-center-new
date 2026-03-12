export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export const APP_SIDER_WIDTH = 248;

export function getRightOverlayDrawerWidth(isDesktop: boolean) {
  return isDesktop ? `calc(100vw - ${APP_SIDER_WIDTH}px)` : "100vw";
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}
