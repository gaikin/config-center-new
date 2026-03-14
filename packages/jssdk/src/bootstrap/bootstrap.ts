import { ConfigCenterSdkRuntime } from "../core/runtime";
import type { ConfigCenterSdkInit, SdkStatus } from "../types/runtime";

let runtime: ConfigCenterSdkRuntime | null = null;

function getRuntime() {
  if (!runtime) {
    runtime = new ConfigCenterSdkRuntime();
  }
  return runtime;
}

export async function bootstrap(config: ConfigCenterSdkInit) {
  await getRuntime().bootstrap(config);
}

export async function refresh() {
  if (!runtime) {
    return;
  }
  await runtime.refresh();
}

export function destroy() {
  if (!runtime) {
    return;
  }
  runtime.destroy();
}

export function getStatus(): SdkStatus {
  return runtime?.getStatus() ?? "IDLE";
}
