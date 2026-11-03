import { track } from "../../lib/analytics";
import { useEffect, useState } from "react";
import { Button } from "../../ui/Button";
import { Notice } from "../../ui/Notice";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { keepsakeStrings } from "./strings";

const strings = keepsakeStrings.png;

// The signed URL needs no request inside the tap (SPEC §7.3): the PNG is fetched ahead into a File,
// so Share can call navigator.share synchronously. Without file sharing, the image is long-pressable.
export function DownloadPng({ url, code }: { url: string; code: string }) {
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
    <Stack>
      <Button label={strings.download} variant="secondary" href={url} download onPress={() => track("keepsake_png_download", { exhibition_code: code })} />
      {canShareFiles ? (
        <Button
          label={strings.share}
          variant="secondary"
          disabled={file === null}
          onPress={() => file && navigator.share({ files: [file] }).catch(() => undefined)}
        />
      ) : (
        <>
          <Text variant="secondary">{strings.longPressHint}</Text>
          <img src={url} alt="" style={{ width: "100%" }} />
        </>
      )}
      {failed && (
        <>
          <Notice error message={strings.failed} />
          <Button label={strings.retry} variant="secondary" onPress={() => setAttempt(attempt + 1)} />
        </>
      )}
    </Stack>
  );
}
