import { useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { GuidePage } from "../features/guide/GuidePage";
import { SentenceRow } from "../features/scrap/SentenceAction";
import { Screen } from "../ui/Screen";
import type { StillDoc } from "../ui/StillDocView";

// What the console posts: the page being edited, as it is being typed, and the exhibition's playlist and keepsake
// details as exhibition.get would serve them.
type Preview = {
  type: "still-preview";
  code: string;
  /** The content id of the page; another page starts at its top. */
  page: string;
  exhibition: Parameters<typeof GuidePage>[0]["exhibition"];
  document: StillDoc;
};

/**
 * The console's phone preview (SPEC §9.4 미리보기 모드): the page being edited, drawn by the same component visitors
 * get at /e/{code}/{page} (GuidePage), from the draft the console posts. Web only, opened by the console in an iframe
 * on the same origin. Nothing here is saved: "+" keeps a line on this screen only, and links do not leave it.
 */
export default function GuidePreview() {
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || window.parent === window) return;
    const origin = window.location.origin;
    const receive = (e: MessageEvent) => {
      if (e.origin === origin && e.source === window.parent && e.data?.type === "still-preview") setPreview(e.data as Preview);
    };
    // The preview is not somewhere to navigate from.
    const stay = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("a[href]")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("message", receive);
    document.addEventListener("click", stay, true);
    window.parent.postMessage({ type: "still-preview-ready" }, origin);
    return () => {
      window.removeEventListener("message", receive);
      document.removeEventListener("click", stay, true);
    };
  }, []);

  return (
    <Screen key={preview?.page} tabs>
      {preview && <GuidePage code={preview.code} page={preview.page.slice(0, 8)} exhibition={preview.exhibition} document={preview.document} renderSentence={(sentence, quote) => <PreviewSentence key={sentence.sentenceId} quote={quote} />} />}
    </Screen>
  );
}

// A keepable line as the guide draws it; "+" keeps it on this screen only.
function PreviewSentence({ quote }: { quote: ReactNode }) {
  const [kept, setKept] = useState(false);
  return <SentenceRow quote={quote} kept={kept} pending={false} onPress={() => setKept((k) => !k)} />;
}
