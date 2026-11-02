import { systemPathFor } from "../features/entry/system-path";

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return systemPathFor(path, process.env.EXPO_PUBLIC_STILL_ORIGIN ?? "");
}
