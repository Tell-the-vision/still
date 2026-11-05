export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="pa-page">
      <h1 className="pa-title">{title}</h1>
      <p className="pa-desc">There is no page here.</p>
    </div>
  );
}
