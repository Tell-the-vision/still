import { Button } from "../../ui/Button";
import { keepsakeStrings } from "./strings";

// Disabled until native save/share lands (K5b).
export function DownloadPng(_props: { url: string }) {
  return <Button label={keepsakeStrings.png.download} disabled onPress={() => undefined} />;
}
