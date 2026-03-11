import { useAppStore } from "../store/useAppStore";
import type { ConfigTemplate, MenuScope } from "../types";

type StoreState = ReturnType<typeof useAppStore.getState>;
type CreateFromTemplateInput = Parameters<StoreState["createFromTemplate"]>[0];
type CreateFromTemplateOutput = ReturnType<StoreState["createFromTemplate"]>;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const configCenterService = {
  async listTemplates(): Promise<ConfigTemplate[]> {
    await sleep(120);
    return useAppStore.getState().templates;
  },

  async listMenus(): Promise<MenuScope[]> {
    await sleep(120);
    return useAppStore.getState().menus;
  },

  async createFromTemplate(input: CreateFromTemplateInput): Promise<CreateFromTemplateOutput> {
    await sleep(180);
    return useAppStore.getState().createFromTemplate(input);
  }
};
