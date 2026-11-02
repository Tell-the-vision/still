"use client";

/** /admin/reports — review reports; hide the exhibition or suspend the artist. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { STATUS_LABEL, Tag } from "@/components/admin/AdminShell";
import { Button, Dialog, Loading, Notice, cx } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/fetcher";
import { formatDateTime } from "@/lib/format";

type Row = {
  id: string;
  reason: string;
  reasonLabel: string;
  detail: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  action: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  exhibition: { id: string; slug: string; title: string; status: string; ownerId: string | null; owner: { id: string; displayName: string; artistName: string | null; email: string; status: string } | null };
  reporter: { id: string; displayName: string; email: string };
  resolvedBy: { id: string; displayName: string } | null;
};

const ACTION_LABEL: Record<string, string> = { NONE: "조치 없음", HIDE_EXHIBITION: "전시 숨김", SUSPEND_ARTIST: "전시 숨김 + 아티스트 정지" };

export function AdminReports() {
  const params = useSearchParams();
  const status = params.get("status") ?? "OPEN";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ row: Row; action: "NONE" | "HIDE_EXHIBITION" | "SUSPEND_ARTIST" | "DISMISS" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ reports: Row[] }>(`/api/admin/reports?status=${status === "ALL" ? "" : status}`);
      setRows(d.reports);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async () => {
    if (!dialog) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/reports/${dialog.row.id}`, {
        method: "PATCH",
        body: dialog.action === "DISMISS" ? { status: "DISMISSED", note } : { status: "RESOLVED", action: dialog.action, note },
      });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setDialog(null);
      setNote("");
    }
  };

  return (
    <div className="px-5 pb-10 pt-4">
      <div className="flex gap-2 flex-wrap mb-4">
        {[
          ["OPEN", "미처리"],
          ["RESOLVED", "처리됨"],
          ["DISMISSED", "기각"],
          ["ALL", "전체"],
        ].map(([k, label]) => (
          <Link key={k} href={`/admin/reports?status=${k}`} className={cx("text-xs px-2 py-1 border", status === k ? "border-ink" : "border-line text-muted")}>
            {label}
          </Link>
        ))}
      </div>
      {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm py-8 text-center">신고가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/e/${r.exhibition.slug}`} className="font-medium text-sm underline underline-offset-4 truncate block">
                    {r.exhibition.title}
                  </Link>
                  <p className="text-muted text-xs mt-1">
                    아티스트: {r.exhibition.owner ? `${r.exhibition.owner.artistName || r.exhibition.owner.displayName} (${r.exhibition.owner.email})${r.exhibition.owner.status === "SUSPENDED" ? " · 정지됨" : ""}` : "공식 콘텐츠"} · 전시 상태 {STATUS_LABEL[r.exhibition.status]}
                  </p>
                </div>
                <Tag strong={r.status === "OPEN"}>{STATUS_LABEL[r.status]}</Tag>
              </div>
              <p className="text-sm mt-2">
                <span className="font-medium">{r.reasonLabel}</span>
                {r.detail && <span className="text-muted"> — {r.detail}</span>}
              </p>
              <p className="text-muted text-xs mt-1">
                신고자 {r.reporter.displayName} ({r.reporter.email}) · {formatDateTime(r.createdAt)}
              </p>
              {r.status !== "OPEN" && (
                <p className="text-muted text-xs mt-1">
                  {ACTION_LABEL[r.action ?? "NONE"]} · {r.resolvedBy?.displayName ?? "관리자"} · {formatDateTime(r.resolvedAt)}
                  {r.resolutionNote && ` · ${r.resolutionNote}`}
                </p>
              )}
              {r.status === "OPEN" && (
                <div className="flex gap-2 flex-wrap mt-3">
                  <Button className="h-8 px-3 text-xs" onClick={() => setDialog({ row: r, action: "HIDE_EXHIBITION" })}>
                    전시 숨김
                  </Button>
                  {r.exhibition.ownerId && (
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setDialog({ row: r, action: "SUSPEND_ARTIST" })}>
                      아티스트 정지
                    </Button>
                  )}
                  <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setDialog({ row: r, action: "NONE" })}>
                    조치 없이 종료
                  </Button>
                  <Button variant="text" className="text-xs text-muted" onClick={() => setDialog({ row: r, action: "DISMISS" })}>
                    기각
                  </Button>
                  {r.exhibition.ownerId && (
                    <Link href={`/admin/users/${r.exhibition.ownerId}`} className="text-xs underline underline-offset-4 self-center">
                      아티스트 보기
                    </Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(dialog)}
        title={dialog ? (dialog.action === "DISMISS" ? "신고를 기각할까요?" : `처리: ${ACTION_LABEL[dialog.action]}`) : ""}
        confirmLabel="확인"
        onConfirm={() => void resolve()}
        onCancel={() => setDialog(null)}
        busy={busy}
        destructive={dialog?.action === "SUSPEND_ARTIST"}
      >
        {dialog?.action === "HIDE_EXHIBITION" && "전시가 방문자에게 보이지 않게 됩니다. 같은 전시의 다른 미처리 신고도 함께 종료됩니다."}
        {dialog?.action === "SUSPEND_ARTIST" && "전시를 숨기고 아티스트 계정을 정지합니다. 해당 아티스트의 모든 전시가 방문자에게 보이지 않게 됩니다."}
        {dialog?.action === "NONE" && "전시는 그대로 두고 신고만 종료합니다."}
        {dialog?.action === "DISMISS" && "근거 없는 신고로 기각합니다."}
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} placeholder="메모 (선택)" className="w-full text-sm border-b border-line py-2 resize-none text-ink mt-3" />
      </Dialog>
    </div>
  );
}
