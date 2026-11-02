"use client";

import { Button, EmptyState } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <EmptyState
        title="문제가 발생했습니다"
        body="잠시 후 다시 시도해 주세요."
        action={
          <Button variant="secondary" onClick={() => reset()}>
            다시 시도
          </Button>
        }
      />
    </main>
  );
}
