import { track } from "../../lib/analytics";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "../../ui/Button";
import { Notice } from "../../ui/Notice";
import { Stack } from "../../ui/Stack";
import { TextAction } from "../../ui/TextAction";
import { keepsakeStrings } from "./strings";

const strings = keepsakeStrings.png;

// The web app and the API share one origin (SPEC §0.1), so the signed link is used from this page's own origin:
// a page served under another name for the same server (a dev proxy) can still fetch it.
const onThisOrigin = (url: string) => {
  const parsed = new URL(url, window.location.href);
  return `${parsed.pathname}${parsed.search}`;
};

// The signed URL needs no request inside the tap (SPEC §7.3): the PNG is fetched ahead into a File,
// so Share can call navigator.share synchronously. Without file sharing, the image is long-pressable.
// Download and Share are text actions side by side, so they sit on the parent's action line (see KeepsakeActions).
export function DownloadPng({ url: signedUrl, code }: { url: string; code: string }) {
  const url = onThisOrigin(signedUrl);
  const [file, setFile] = useState<File | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const canShareFiles = navigator.canShare?.({ files: [new File([], "still.png", { type: "image/png" })] }) === true;

  useEffect(() => {
    setFile(null);
    setFailed(false);
    fetch(url)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => setFile(new File([blob], "still.png", { type: "image/png" })))
      .catch(() => setFailed(true));
  }, [url, attempt]);

  return (
    <>
      <TextAction label={strings.download} leading="↓" href={url} download onPress={() => track("keepsake_png_download", { exhibition_code: code })} />
      {canShareFiles && (
        <TextAction label={strings.share} leading="↗" disabled={file === null} onPress={() => file && navigator.share({ files: [file] }).catch(() => undefined)} />
      )}
      {failed && (
        // A full-width break, so the notice and Retry sit under the action line.
        <View style={{ flexBasis: "100%" }}>
          <Stack>
            <Notice error message={strings.failed} />
            <Button label={strings.retry} variant="secondary" onPress={() => setAttempt(attempt + 1)} />
          </Stack>
        </View>
      )}
    </>
  );
}
