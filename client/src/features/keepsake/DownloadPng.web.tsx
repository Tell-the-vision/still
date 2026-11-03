import { Button } from "../../ui/Button";
import { keepsakeStrings } from "./strings";

// The signed URL needs no request inside the tap (SPEC §7.3). React Native has no download link.
export function DownloadPng({ url }: { url: string }) {
  return <Button label={keepsakeStrings.png.download} variant="secondary" href={url} download />;
}
