import { EmptyState, PageHead } from "../ui";

export default function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHead eyebrow="Account" title={title} />
      <hr className="rule" />
      <EmptyState title="Coming soon" body="This page is not available yet." />
    </>
  );
}
