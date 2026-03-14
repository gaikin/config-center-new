import { bootstrap, destroy, getStatus, refresh } from "./bootstrap/bootstrap";
import type { ConfigCenterSdkInit } from "./types/runtime";

export * from "./types/runtime";
export { bootstrap, destroy, getStatus, refresh };

export const ConfigCenterSDK = {
  bootstrap,
  refresh,
  destroy,
  getStatus
};

declare global {
  interface Window {
    ConfigCenterSDK: typeof ConfigCenterSDK;
    __CC_SDK_CONFIG__?: ConfigCenterSdkInit;
  }
}

if (typeof window !== "undefined") {
  window.ConfigCenterSDK = ConfigCenterSDK;
  if (window.__CC_SDK_CONFIG__ && window.__CC_SDK_CONFIG__.autoStart !== false) {
    void ConfigCenterSDK.bootstrap(window.__CC_SDK_CONFIG__);
  }
}

export default ConfigCenterSDK;
