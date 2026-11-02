import { Suspense } from "react";
import { redirect } from "next/navigation";
import { devLoginEnabled, googleEnabled } from "@/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { PageHeader, Wordmark } from "@/components/ui";
import { currentUser } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Only a session that resolves to a real user row counts as logged in;
  // a stale cookie must be able to reach this screen (SessionGuard clears it).
  const user = await currentUser();
  const { callbackUrl } = await searchParams;
  if (user) {
    redirect(callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/");
  }
  return (
    <main>
      <PageHeader back="/" />
      <div className="text-center pt-10 pb-12">
        <h1>
          <Wordmark className="text-3xl" />
        </h1>
        <p className="text-muted text-sm mt-6 px-8">
          개인 기록을 저장하려면 로그인이 필요합니다.
          <br />
          로그인 후 하던 작업으로 돌아갑니다.
        </p>
      </div>
      <Suspense>
        <LoginForm googleEnabled={googleEnabled} devLoginEnabled={devLoginEnabled} />
      </Suspense>
    </main>
  );
}
