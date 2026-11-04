import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useWorkspace } from "../store";
import { Arrow, Badge, PageHead } from "../ui";

const FAQ = [
  {
    q: "Which files can I upload?",
    a: "PDF, DOCX, XLSX, PPTX and TXT, up to 100 MB per file. Exhibition texts, artwork checklists, wall labels, audio scripts and press kits all work. Scanned PDFs without a text layer cannot be read yet.",
  },
  {
    q: "What does analysis do with my files?",
    a: "STILL reads the text, groups it into content items (introduction, curator statement, section texts, artwork captions, narration) and links each item to its source page or row. Your original files are never changed.",
  },
  {
    q: "Why do some items need review?",
    a: "Items are marked for review when the text was hard to read, was split across pages, or could belong to more than one section. Check the wording, set the theme and content type, then approve.",
  },
  {
    q: "What do visitors see?",
    a: "Only approved items. Drafts, editorial notes and unapproved items stay inside the workspace. Use Preview to check the visitor's mobile screen before publishing.",
  },
  {
    q: "Can I change a guide after it is published?",
    a: "Yes. Edits stay in draft until you choose Publish changes in Digital guide, so the live guide is not affected while you work.",
  },
  {
    q: "What happens to visitor data?",
    a: "Visitors' journals, saved sentences and keepsakes are private to each visitor's account. The workspace never shows them.",
  },
];

const GUIDES = [
  { title: "Upload exhibition materials", detail: "Start a new exhibition and add your source files.", to: "/materials" },
  { title: "Review extracted content", detail: "Check, edit and approve what STILL found in your files.", to: "/materials/review" },
  { title: "Publish a visitor guide", detail: "Set the visitor address and confirm content rights.", to: "/materials/publish" },
];

const TOPICS = ["Uploading files", "Content extraction", "Publishing", "Team & access", "Something else"];

export default function Help() {
  const { exhibitions, reportError } = useWorkspace();
  const [open, setOpen] = useState<number | null>(0);
  const [form, setForm] = useState({ topic: TOPICS[0], exhibitionId: "", message: "" });
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const valid = form.message.trim().length >= 10;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    try {
      const res = await api.sendSupportRequest({ topic: form.topic, exhibitionId: form.exhibitionId || null, message: form.message.trim() });
      setTicket(res.ticketId);
      setForm({ ...form, message: "" });
    } catch (err) {
      reportError(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow={<>Account <span aria-hidden>/</span> Support</>}
        title="Help & support"
        lede="Answers to common questions, step-by-step guides and a direct line to the STILL team."
      />
      <hr className="rule" />

      <div className="split split--publish">
        <section>
          <h2 className="h2 section__title">Frequently asked</h2>
          <ul className="faq">
            {FAQ.map((f, i) => (
              <li key={f.q} className={open === i ? "is-open" : ""}>
                <button type="button" className="faq__q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span>{f.q}</span>
                  <span aria-hidden className="faq__icon">{open === i ? "–" : "+"}</span>
                </button>
                {open === i && <p className="faq__a">{f.a}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="h2 section__title">Contact support</h2>
          <form className="panel panel--padded support" onSubmit={submit}>
            {ticket && (
              <div className="support__done" role="status">
                <Badge tone="green" className="badge--wide">Request sent</Badge>
                <p className="caption-sm">Reference {ticket}. We reply by email within one working day.</p>
              </div>
            )}
            <label className="field field--first">
              <span className="field__label">Topic</span>
              <select className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Related exhibition (optional)</span>
              <select className="input" value={form.exhibitionId} onChange={(e) => setForm({ ...form, exhibitionId: e.target.value })}>
                <option value="">None</option>
                {exhibitions.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Message</span>
              <textarea className="input input--note input--message" rows={5} value={form.message} placeholder="Tell us what happened and what you expected." onChange={(e) => { setTicket(null); setForm({ ...form, message: e.target.value }); }} />
            </label>
            <div className="support__actions">
              <span className="caption-sm">Please don't include visitor personal data.</span>
              <button type="submit" className="btn btn--primary" aria-disabled={!valid || sending}>{sending ? "Sending…" : "Send request"}</button>
            </div>
          </form>
        </section>
      </div>

      <section className="section">
        <h2 className="h2 section__title">Guides</h2>
        <ul className="next-list">
          {GUIDES.map((g) => (
            <li key={g.title}>
              <span className="strong">{g.title}</span>
              <span className="caption-sm">{g.detail}</span>
              <Link to={g.to} className="open-link">Open <Arrow /></Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
