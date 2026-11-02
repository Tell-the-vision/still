"use client";

/**
 * Saved web card: re-open, Download PNG (with retry), delete.
 * States (spec §7.5): Saved → Exporting → Exported / Error.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeepsakeCard } from "@/components/KeepsakeCard";
import { Button, Dialog, Notice, cx } from "@/components/ui";
import { track } from "@/lib/client/analytics";
import { api, errorMessage } from "@/lib/client/fetcher";
import { downloadDataUrl, keepsakeFilename, renderCardToPng } from "@/lib/client/export-png";
import { formatDateTime } from "@/lib/format";
import { getTemplate, type KeepsakeContent } from "@/lib/keepsake-templates";

export type KeepsakeDto = {
  id: string;
  archiveId: string;
  templateId: string;
  content: KeepsakeContent;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ExportState = "idle" | "exporting" | "exported" | "error";

export function KeepsakeViewer({ keepsake }: { keepsake: KeepsakeDto }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (Math.min(window.innerWidth, 390) - 82) / 360));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const download = async () => {
    if (!cardRef.current) return;
    setExportState("exporting");
    setError(null);
    try {
      const dataUrl = await renderCardToPng(cardRef.current);
      downloadDataUrl(dataUrl, keepsakeFilename(keepsake.content.exhibitionTitle, keepsake.content.savedDateLabel));
      setExportState("exported");
      track("keepsake_png_download", { keepsake_id: keepsake.id });
    } catch (err) {
      setExportState("error");
      setError(errorMessage(err, "PNG 변환에 실패했습니다. 다시 시도해 주세요."));
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/api/keepsakes/${keepsake.id}`, { method: "DELETE" });
      router.replace(`/archive/${keepsake.archiveId}`);
    } catch (err) {
      setError(errorMessage(err, "웹카드를 삭제하지 못했습니다."));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const template = getTemplate(keepsake.templateId);

  return (
    <div className="px-6 pb-12">
      <header className="pt-6">
        <h1 className="screen-title">Your keepsake.</h1>
        <p className="label mt-1.5">
          {template?.name ?? keepsake.templateId}  ·  저장 {formatDateTime(keepsake.createdAt)}
        </p>
      </header>

      <div className="mt-6 border border-ink p-4 flex justify-center">
        <div className="overflow-hidden" style={{ width: 360 * scale, height: 480 * scale }}>
          {/* The scaled node is what the user sees; export resets the transform. */}
          <KeepsakeCard ref={cardRef} templateId={keepsake.templateId} content={keepsake.content} scale={scale} />
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="error" action={<Button variant="text" onClick={() => void download()}>Retry</Button>}>
            {error}
          </Notice>
        </div>
      )}

      <div className="mt-6">
        <Button full onClick={() => void download()} loading={exportState === "exporting"}>
          <span aria-hidden>↓</span> Download PNG
        </Button>
        <p className={cx("label mt-3", exportState !== "exported" && "invisible")}>PNG가 저장되었습니다.</p>
      </div>

      <div className="hairline mt-8 pt-5">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="inline-flex gap-2 text-[13px] text-muted hover:text-ink"
        >
          <span>이 웹카드 삭제</span>
          <span aria-hidden>→</span>
        </button>
      </div>

      <Dialog
        open={confirmDelete}
        title="웹카드를 삭제할까요?"
        confirmLabel="삭제"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
        busy={deleting}
        destructive
      >
        삭제한 웹카드는 복구할 수 없습니다.
      </Dialog>
    </div>
  );
}
