import { BottomNav, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-col min-h-dvh">
      <PageHeader back="/" backLabel="Home" />
      <div className="flex-1 px-6">
        <EmptyState
          title="페이지를 찾을 수 없습니다"
          body="전시가 종료되었거나 주소가 올바르지 않습니다."
          action={<LinkButton href="/" variant="secondary">Home으로</LinkButton>}
        />
      </div>
      <BottomNav />
    </main>
  );
}
