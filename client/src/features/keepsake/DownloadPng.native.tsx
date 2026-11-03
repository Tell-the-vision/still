import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Button } from "../../ui/Button";
import { Notice } from "../../ui/Notice";
import { keepsakeStrings } from "./strings";

type Failure = "failed" | "photosDenied";

// Typecheck resolves the web d.ts (moduleSuffixes), which omits the native `uri`.
const uriOf = (file: File) => (file as File & { uri: string }).uri;

// The signed URL needs no auth header (SPEC §7.3), so the cache download is a plain GET.
export function DownloadPng({ url }: { url: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { png } = keepsakeStrings;

  useEffect(() => {
    setFile(null);
    setFailure(null);
    File.downloadFileAsync(url, new File(Paths.cache, `still-${Date.now()}.png`))
      .then(setFile)
      .catch(() => setFailure("failed"));
  }, [url, attempt]);

  const run = (action: (file: File) => Promise<Failure | void>) => () => {
    if (!file) return;
    setFailure(null);
    action(file).then((result) => result && setFailure(result), () => setFailure("failed"));
  };

  const share = run((f) => Sharing.shareAsync(uriOf(f), { mimeType: "image/png", UTI: "public.png" }));
  const saveToPhotos = run(async (f) => {
    const { granted } = await MediaLibrary.requestPermissionsAsync(true);
    if (!granted) return "photosDenied";
    await MediaLibrary.createAssetAsync(uriOf(f));
  });

  return (
    <>
      <Button label={png.share} disabled={!file} onPress={share} />
      <Button label={png.saveToPhotos} variant="secondary" disabled={!file} onPress={saveToPhotos} />
      {failure && <Notice error={failure === "failed"} message={png[failure]} />}
      {failure === "failed" && <Button label={png.retry} variant="secondary" onPress={() => setAttempt(attempt + 1)} />}
    </>
  );
}
