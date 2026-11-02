"use client";

/** /admin/users — search, artist approvals, role & suspension, deletion. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { STATUS_LABEL, Tag } from "@/components/admin/AdminShell";
import { Button, Dialog, Loading, Notice, cx } from "@/components/ui";
import type { PublicUser } from "@/lib/api";
import { api, errorMessage } from "@/lib/client/fetcher";
import { formatDateTime } from "@/lib/format";

type Row = PublicUser & { exhibitionCount: number; archiveCount: number };

const FILTERS = [
  { value: "", label: "전체" },
  { value: "pending", label: "승인 대기" },
  { value: "artists", label: "아티스트" },
  { value: "admins", label: "관리자" },
  { value: "suspended", label: "정지" },
];

export function AdminUsers({ meId }: { meId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const filter = params.get("filter") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "reject" | "suspend" | "delete"; user: Row } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api<{ users: Row[] }>(`/api/admin/users?q=${encodeURIComponent(q)}&filter=${filter}`);
      setRows(d.users);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [q, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (user: Row, body: Record<string, unknown>) => {
    setBusyId(user.id);
    setError(null);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
      setDialog(null);
      setNote("");
    }
  };

  const remove = async (user: Row) => {
    setBusyId(user.id);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
      setDialog(null);
    }
  };

  return (
    <div className="px-5 pb-10 pt-4">
      <form
        className="flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(`/admin/users?filter=${filter}&q=${encodeURIComponent(q)}`);
          void load();
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이메일 · 이름 검색" className="flex-1 h-10 border-b border-line text-sm" aria-label="검색" />
        <Button type="submit" variant="secondary" className="h-10 text-xs">
          검색
        </Button>
      </form>
      <div className="flex gap-2 flex-wrap mb-4">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/users?filter=${f.value}`} className={cx("text-xs px-2 py-1 border", filter === f.value ? "border-ink" : "border-line text-muted")}>
            {f.label}
          </Link>
        ))}
      </div>

      {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm py-8 text-center">해당하는 사용자가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((u) => {
            const busy = busyId === u.id;
            const isMe = u.id === meId;
            return (
              <li key={u.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-sm underline underline-offset-4 truncate block">
                      {u.displayName || "(이름 없음)"}
                      {u.artistName && u.artistStatus !== "NONE" && <span className="text-muted font-normal"> · {u.artistName}</span>}
                      {isMe && <span className="text-muted"> · 나</span>}
                    </Link>
                    <p className="text-muted text-xs truncate">{u.email}</p>
                    <p className="text-xs mt-2 flex gap-1.5 flex-wrap">
                      <Tag strong={u.role !== "USER"}>{STATUS_LABEL[u.role]}</Tag>
                      {u.artistStatus !== "NONE" && <Tag strong={u.artistStatus === "PENDING"}>아티스트 {STATUS_LABEL[u.artistStatus]}</Tag>}
                      {u.status === "SUSPENDED" && <Tag strong>정지</Tag>}
                      <span className="text-muted">전시 {u.exhibitionCount} · Archive {u.archiveCount}</span>
                    </p>
                    {u.artistStatus === "PENDING" && (
                      <div className="mt-2 text-xs text-muted leading-5">
                        <p>
                          <span className="text-ink">{u.artistName}</span> · 신청 {formatDateTime(u.artistAppliedAt)}
                        </p>
                        {u.artistBio && <p className="whitespace-pre-wrap">{u.artistBio}</p>}
                        {u.artistPortfolioUrl && (
                          <a href={u.artistPortfolioUrl} target="_blank" rel="noopener noreferrer" className="underline">
                            {u.artistPortfolioUrl}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap mt-3">
                  {u.artistStatus === "PENDING" && (
                    <>
                      <Button className="h-8 px-3 text-xs" onClick={() => void patch(u, { artistDecision: "APPROVE" })} loading={busy}>
                        아티스트 승인
                      </Button>
                      <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setDialog({ kind: "reject", user: u })} disabled={busy}>
                        반려
                      </Button>
                    </>
                  )}
                  {!isMe && (
                    <select
                      aria-label="역할 변경"
                      className="h-8 border border-line text-xs px-2"
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => void patch(u, { role: e.target.value })}
                    >
                      <option value="USER">User</option>
                      <option value="ARTIST">Artist</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  )}
                  {!isMe && u.status === "ACTIVE" && (
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setDialog({ kind: "suspend", user: u })} disabled={busy}>
                      정지
                    </Button>
                  )}
                  {!isMe && u.status === "SUSPENDED" && (
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => void patch(u, { status: "ACTIVE" })} loading={busy}>
                      정지 해제
                    </Button>
                  )}
                  {!isMe && (
                    <Button variant="text" className="text-xs text-muted" onClick={() => setDialog({ kind: "delete", user: u })} disabled={busy}>
                      계정 삭제
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={dialog?.kind === "reject"}
        title="아티스트 신청을 반려할까요?"
        confirmLabel="반려"
        onConfirm={() => dialog && void patch(dialog.user, { artistDecision: "REJECT", note })}
        onCancel={() => setDialog(null)}
        busy={Boolean(busyId)}
      >
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} placeholder="반려 사유 (신청자에게 표시됩니다)" className="w-full text-sm border-b border-line py-2 resize-none text-ink" />
      </Dialog>
      <Dialog
        open={dialog?.kind === "suspend"}
        title="계정을 정지할까요?"
        confirmLabel="정지"
        onConfirm={() => dialog && void patch(dialog.user, { status: "SUSPENDED", reason: note })}
        onCancel={() => setDialog(null)}
        busy={Boolean(busyId)}
        destructive
      >
        정지된 계정은 로그인은 되지만 기록·좋아요·신고·전시 등록을 할 수 없고, 아티스트의 전시는 방문자에게 보이지 않습니다.
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} placeholder="정지 사유 (사용자에게 표시)" className="w-full text-sm border-b border-line py-2 resize-none text-ink mt-3" />
      </Dialog>
      <Dialog
        open={dialog?.kind === "delete"}
        title="계정을 영구 삭제할까요?"
        confirmLabel="영구 삭제"
        onConfirm={() => dialog && void remove(dialog.user)}
        onCancel={() => setDialog(null)}
        busy={Boolean(busyId)}
        destructive
      >
        {dialog?.user.email} 의 모든 Archive·문장·Journal·웹카드가 삭제됩니다. 이 사용자가 만든 전시는 소유자 없는 상태로 남습니다.
      </Dialog>
    </div>
  );
}
