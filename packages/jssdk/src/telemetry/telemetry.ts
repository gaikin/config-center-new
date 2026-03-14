import type { RuntimeEvent, RuntimeEventType, RuntimeTransport } from "../types/runtime";

export interface TelemetryContext {
  sdkVersion?: string;
  bundleVersion?: string;
  pageResourceId?: string;
}

export class TelemetryClient {
  constructor(
    private readonly transport: RuntimeTransport,
    private readonly getContext: () => TelemetryContext,
    private readonly debug = false
  ) {}

  async track(type: RuntimeEventType, partial: Omit<RuntimeEvent, "type" | "createdAt"> = {}) {
    const event: RuntimeEvent = {
      type,
      createdAt: new Date().toISOString(),
      ...this.getContext(),
      ...partial
    };

    if (this.debug) {
      console.debug("[cc-sdk:event]", event);
    }

    await this.transport.reportEvents([event]);
  }
}
