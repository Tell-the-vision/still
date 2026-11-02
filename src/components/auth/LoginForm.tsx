"use client";

/**
 * /login — Google OAuth (HOME-01) with a Dev Login fallback for local work.
 * `callbackUrl` brings the user back to where they were (PRD §6.3).
 *
 * Account type option: "일반 사용자" signs in immediately; "아티스트" signs
 * in the same way, then lands on /artist/apply to request verification —
 * an admin must approve before they can publish exhibitions.
 */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Notice, cx } from "@/components/ui";
import { track } from "@/lib/client/analytics";
import { saveSigninIntent, type SigninIntent } from "@/lib/client/pending-action";

const ERRORS: Record<string, string> = {
  OAuthCallbackError: "Google 인증이 취소되었거나 실패했습니다. 다시 시도해 주세요.",
  OAuthSignin: "Google 로그인을 시작하지 못했습니다.",
  AccessDenied: "접근이 거부되었습니다.",
  Configuration: "로그인 설정에 문제가 있습니다. .env의 AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET을 확인해 주세요.",
  CredentialsSignin: "로그인에 실패했습니다. 이메일을 확인해 주세요.",
  Default: "로그인에 실패했습니다. 다시 시도해 주세요.",
};

function safeCallback(raw: string | null) {
  // Only allow same-origin relative paths to avoid open redirects.
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function LoginForm({ googleEnabled, devLoginEnabled }: { googleEnabled: boolean; devLoginEnabled: boolean }) {
  const params = useSearchParams();
  const callbackUrl = safeCallback(params.get("callbackUrl"));
  const errorCode = params.get("error");
  const [intent, setIntent] = useState<SigninIntent>(params.get("as") === "artist" ? "artist" : "user");
  // Fields start empty; the placeholders show neutral sample values only.
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Artists go to the application screen after login; it returns them to callbackUrl afterwards.
  const target = intent === "artist" ? `/artist/apply?callbackUrl=${encodeURIComponent(callbackUrl)}` : callbackUrl;

  const google = async () => {
    setBusy(true);
    saveSigninIntent(intent);
    track("login_start", { source_action: "login_screen", intent });
    await signIn("google", { redirectTo: target });
  };

  const dev = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setLocalError("이메일을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    saveSigninIntent(intent);
    track("login_start", { source_action: "dev_login", intent });
    // Full-page redirect (not redirect:false + router.replace): the server
    // renders the target with the fresh cookie, so no client-side session
    // refetch is needed — that refetch is what the Next dev server
    // occasionally answers with an HTML error page while recompiling.
    // On failure Auth.js sends us back to /login?error=CredentialsSignin.
    await signIn("dev", { email: email.trim().toLowerCase(), name: name.trim(), redirectTo: target });
  };

  const option = (value: SigninIntent, label: string, desc: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={intent === value}
      onClick={() => setIntent(value)}
      className={cx("flex-1 border p-3 text-left", intent === value ? "border-ink bg-ink text-paper" : "border-ink bg-paper text-ink")}
    >
      <p className="text-[13px] font-medium">{label}</p>
      <p className={cx("text-[11px] mt-1 leading-4", intent === value ? "text-paper/70" : "text-muted")}>{desc}</p>
    </button>
  );

  return (
    <div className="px-6 pb-12">
      {errorCode && (
        <div className="mb-6">
          <Notice tone="error">{ERRORS[errorCode] ?? ERRORS.Default}</Notice>
        </div>
      )}

      <p className="label mb-2">계정 유형</p>
      <div className="flex gap-2 mb-6" role="radiogroup" aria-label="계정 유형">
        {option("user", "일반 사용자", "전시를 기록하고 보관합니다. 바로 시작할 수 있어요.")}
        {option("artist", "아티스트 · 전시 기획자", "내 전시를 등록하고 QR을 받습니다. 관리자 승인이 필요해요.")}
      </div>

      {googleEnabled ? (
        <Button full onClick={() => void google()} loading={busy}>
          Continue with Google
        </Button>
      ) : (
        <p className="text-muted text-[12px] leading-5">
          Google 로그인이 설정되지 않았습니다. <code>.env</code>에 <code>AUTH_GOOGLE_ID</code> / <code>AUTH_GOOGLE_SECRET</code>을 넣으면 활성화됩니다.
        </p>
      )}

      {devLoginEnabled && (
        <form onSubmit={(e) => void dev(e)} className="hairline mt-10 pt-5">
          <p className="label mb-4">Dev Login (local only)</p>
          <label className="label block" htmlFor="dev-email">
            Email
          </label>
          <input
            id="dev-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 border-b border-ink mb-5 text-[14px] placeholder:text-muted/60"
            placeholder="gdg@gmail.com"
          />
          <label className="label block" htmlFor="dev-name">
            Name (optional)
          </label>
          <input
            id="dev-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 border-b border-ink mb-6 text-[14px] placeholder:text-muted/60"
            placeholder="홍길동"
          />
          {localError && (
            <div className="mb-4">
              <Notice tone="error">{localError}</Notice>
            </div>
          )}
          <Button variant="secondary" full type="submit" loading={busy}>
            Dev Login
          </Button>
          <p className="text-muted text-[11px] leading-4 mt-3">
            비밀번호 없이 이메일만으로 로그인하는 개발용 계정입니다. 같은 이메일로 다시 로그인하면 이름은 마지막에 입력한 값으로 바뀝니다 (비워 두면 이전 이름 유지). <code>ADMIN_EMAILS</code>에 적힌 이메일은 관리자가 됩니다. 프로덕션에서는 자동으로 비활성화됩니다.
          </p>
        </form>
      )}
    </div>
  );
}
