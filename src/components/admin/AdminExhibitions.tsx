"use client";

/** /admin/exhibitions — every exhibition: status changes, edit, hard delete. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { STATUS_LABEL, Tag } from "@/components/admin/AdminShell";
import { Button, Dialog, Loading, Notice, cx } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/fetcher";
import { formatDateTime } from "@/lib/format";

type Row = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  status: "DRAFT" | "ACTIVE" | "HIDDEN" | "DELETED";
  coverImageUrl: string | null;
  owner: { id: string; displayName: string; artistName: string | null; email: string; status: string } | null;
  likeCount: number;
  openReportCount: number;
  reportCount: number;
  archiveCount: number;
  updatedAt: string;
};

const FILTERS = [
  { key: "", label: "전체" },
  { key: "reported=1", label: "신고 있음" },
  { key: "status=ACTIVE", label: "공개" },
  { key: "status=DRAFT", label: "초안" },
  { key: "status=HIDDEN", label: "숨김" },
  { key: "status=DELETED", label: "삭제됨" },
];

export function AdminExhibitions() {
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const reported = params.get("reported") === "1";
  const currentKey = reported ? "reported=1" : status ? `status=${status}` : "";
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ exhibitions: Row[] }>(`/api/admin/exhibitions?q=${encodeURIComponent(q)}&status=${status}&reported=${reported ? 1 : 0}`);
      setRows(d.exhibitions);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [q, status, reported]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (row: Row, next: Row["status"]) => {
    setBusyId(row.id);
    setError(null);
    try {
      await api(`/api/admin/exhibitions/${row.id}`, { method: "PATCH", body: { status: next } });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const hardDelete = async (row: Row) => {
    setBusyId(row.id);
    try {
      await api(`/api/admin/exhibitions/${row.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  return (
    <div className="px-5 pb-10 pt-4">
      <form
        className="flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목 · slug · 장소 검색" className="flex-1 h-10 border-b border-line text-sm" aria-label="검색" />
        <Button type="submit" variant="secondary" className="h-10 text-xs">
          검색
        </Button>
      </form>
      <div className="flex gap-2 flex-wrap mb-4">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/exhibitions${f.key ? `?${f.key}` : ""}`} className={cx("text-xs px-2 py-1 border", currentKey === f.key ? "border-ink" : "border-line text-muted")}>
            {f.label}
          </Link>
        ))}
      </div>
      {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm py-8 text-center">전시가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const busy = busyId === r.id;
            return (
              <li key={r.id} className="py-4 flex gap-3">
                {r.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverImageUrl} alt="" className="w-14 h-[70px] object-cover bg-line shrink-0" />
                ) : (
                  <div className="w-14 h-[70px] bg-line shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/artist/exhibitions/${r.id}`} className="font-medium text-sm underline underline-offset-4 truncate">
                      {r.title}
                    </Link>
                    <Tag strong={r.status === "ACTIVE" || r.openReportCount > 0}>{STATUS_LABEL[r.status]}</Tag>
                  </div>
                  <p className="text-muted text-xs mt-1 truncate">
                    /e/{r.slug} · {r.owner ? `${r.owner.artistName || r.owner.displayName} (${r.owner.email})${r.owner.status === "SUSPENDED" ? " · 정지됨" : ""}` : "공식 콘텐츠"}
                  </p>
                  <p className="text-muted text-xs mt-1">
                    ♥ {r.likeCount} · 방문자 {r.archiveCount} · 신고 {r.openReportCount}/{r.reportCount} · 수정 {formatDateTime(r.updatedAt)}
                  </p>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {r.status !== "ACTIVE" && r.status !== "DELETED" && (
                      <Button className="h-8 px-3 text-xs" onClick={() => void setStatus(r, "ACTIVE")} loading={busy}>
                        공개
                      </Button>
                    )}
                    {r.status === "ACTIVE" && (
                      <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => void setStatus(r, "HIDDEN")} loading={busy}>
                        숨김
                      </Button>
                    )}
                    {r.status === "HIDDEN" && (
                      <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => void setStatus(r, "DRAFT")} loading={busy}>
                        초안으로
                      </Button>
                    )}
                    {r.status !== "DELETED" && (
                      <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => void setStatus(r, "DELETED")} loading={busy}>
                        삭제(소프트)
                      </Button>
                    )}
                    <Link href={`/e/${r.slug}`} className="text-xs underline underline-offset-4 self-center">
                      보기
                    </Link>
                    {r.openReportCount > 0 && (
                      <Link href="/admin/reports?status=OPEN" className="text-xs underline underline-offset-4 self-center">
                        신고 보기
                      </Link>
                    )}
                    <Button variant="text" className="text-xs text-muted" onClick={() => setConfirm(r)} disabled={busy}>
                      완전 삭제
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={Boolean(confirm)} title="전시를 완전히 삭제할까요?" confirmLabel="완전 삭제" onConfirm={() => confirm && void hardDelete(confirm)} onCancel={() => setConfirm(null)} busy={Boolean(busyId)} destructive>
        {confirm?.title} — 방문자 {confirm?.archiveCount}명의 Archive(문장·Journal·웹카드)도 함께 삭제됩니다. 보통은 &lsquo;삭제(소프트)&rsquo;로 충분합니다.
      </Dialog>
    </div>
  );
}
