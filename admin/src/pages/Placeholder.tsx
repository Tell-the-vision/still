export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="pa-page">
      <p className="pa-crumb">Platform admin&nbsp;&nbsp;/&nbsp;&nbsp;{title}</p>
      <h1 className="pa-title">{title}</h1>
      <p className="pa-desc">Not designed yet. Only Institutions (Figma 09) is in this draft.</p>
    </div>
  );
}
