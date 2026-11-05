import { useState } from "react";
import { Link } from "react-router-dom";
import { UPLOAD_FORMATS_LABEL } from "../constants";
import { Arrow, PageHead } from "../ui";

// Static help only (issue #61): no support form. Questions go to STILL directly.

const FAQ = [
  {
    q: "Which files can I upload?",
    a: `${UPLOAD_FORMATS_LABEL}, up to 100 MB per file. Exhibition texts, artwork checklists, wall labels, audio scripts and press kits all work. Other formats and website links are not supported yet, and scanned PDFs without a text layer cannot be read yet.`,
  },
  {
    q: "What does analysis do with my files?",
    a: "STILL reads the text, groups it into content items (introduction, curator statement, section texts, artwork captions, narration) and links each item to its source page or row. Your original files are never changed.",
  },
  {
    q: "Why do some items need review?",
    a: "Items are marked for review when the text was hard to read, was split across pages, or could belong to more than one section. Check the wording, set the theme and content type, then approve. An item that looks like a copy of another is marked as a possible duplicate: reject one or keep both. Images need their rights confirmed before they can be published. Reject anything that should not be in the guide; a rejected item cannot be brought back.",
  },
  {
    q: "What do visitors see?",
    a: "Only approved items. Drafts, editorial notes and unapproved items stay inside the workspace. Use Preview to check the visitor's mobile screen before publishing.",
  },
  {
    q: "Can I change a guide after it is published?",
    a: "Yes. Edits stay in the draft until you publish again from Prepare publication, where the content rights are checked, so the live guide is not affected while you work.",
  },
  {
    q: "What happens to visitor data?",
    a: "Visitors' journals, saved sentences and keepsakes are private to each visitor's account. The workspace never shows them.",
  },
];

const GUIDES = [
  { title: "Upload exhibition materials", detail: "Start a new exhibition and add your source files.", to: "/" },
  { title: "Editor", detail: "Read, fix and approve what STILL structured from each file.", to: "/" },
  { title: "Publish a visitor guide", detail: "Set the visitor address and confirm content rights.", to: "/publish" },
];

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <PageHead
        eyebrow={<>Account <span aria-hidden>/</span> Support</>}
        title="Help & support"
        lede="Answers to common questions and step-by-step guides. For anything else, contact your STILL representative."
      />
      <hr className="rule" />

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
