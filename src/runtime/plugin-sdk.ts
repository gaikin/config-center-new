import type { RuntimeInput } from "../types";
import { addLog, runRuntime, type EngineBundle, type RunOptions } from "./engine";

export interface PluginRuntime {
  onDomChange: (
    input: RuntimeInput,
    options?: Pick<RunOptions, "previewDecision" | "apiCaller">
  ) => ReturnType<typeof runRuntime>;
  triggerByFloatingButton: (
    operationId: string,
    input: RuntimeInput,
    options?: Pick<RunOptions, "previewDecision" | "apiCaller">
  ) => ReturnType<typeof runRuntime>;
}

export function createPluginRuntime(bundle: EngineBundle): PluginRuntime {
  return {
    onDomChange: (input, options) => runRuntime(bundle, input, options),
    async triggerByFloatingButton(operationId, input, options) {
      const filteredBundle: EngineBundle = {
        ...bundle,
        hints: bundle.hints
          .filter((h) => h.operation_id === operationId)
          .map((h) => ({ ...h, relation: "OR" as const, conditions: h.conditions.length ? h.conditions : [] }))
      };
      const result = await runRuntime(filteredBundle, input, options);
      addLog(result.logs, "floating.button.triggered", operationId);
      return result;
    }
  };
}
