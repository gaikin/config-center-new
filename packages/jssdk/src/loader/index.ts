export interface LoaderSlotResolution {
  laneCode: string;
  sdkVersion: string;
}

export function resolveLoaderSlot() {
  return null as LoaderSlotResolution | null;
}
