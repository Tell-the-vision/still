import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiError, type NewExhibition } from "./api";
import { useWorkspace } from "./store";

// Same rule as the server's exhibition code (SPEC §1.2): lowercase letters and digits joined by single hyphens.
const CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CODE_HINT = "Use lowercase letters, numbers and hyphens, like mmca-damien-hirst.";
const CODE_TAKEN = "This code is already used. Choose another one.";

const slugOf = (text: string) =>
  text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** SPEC §9.4: the code starts as the institution's code plus the title; staff confirm or edit it. Titles with no Latin letters or digits leave it blank. */
const suggestCode = (institutionCode: string, title: string) => {
  const slug = slugOf(title);
  return slug ? [slugOf(institutionCode), slug].filter(Boolean).join("-") : "";
};

/** "+ New exhibition": opens the dialog that asks for the title and code, then hands them to `onCreate`. */
export function NewExhibitionButton({ onCreate }: { onCreate: (input: NewExhibition) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--primary btn--xwide" onClick={() => setOpen(true)}>+ New exhibition</button>
      {open && <NewExhibitionDialog onCreate={onCreate} onClose={() => setOpen(false)} />}
    </>
  );
}

export function NewExhibitionDialog({ onCreate, onClose }: { onCreate: (input: NewExhibition) => Promise<unknown>; onClose: () => void }) {
  const { workspace } = useWorkspace();
  const ref = useRef<HTMLDialogElement>(null);
  const ids = { title: useId(), code: useId(), codeError: useId(), heading: useId() };
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { ref.current?.showModal(); }, []);

  const changeTitle = (value: string) => {
    setTitle(value);
    if (!codeEdited) setCode(suggestCode(workspace?.institutionId ?? "", value));
  };
  const changeCode = (value: string) => {
    setCodeEdited(true);
    setCode(value);
    setCodeError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!CODE_PATTERN.test(code)) { setCodeError(CODE_HINT); return; }
    setBusy(true);
    try {
      await onCreate({ title: title.trim(), code });
    } catch (err) {
      if (err instanceof ApiError && err.appCode === "CODE_TAKEN") setCodeError(CODE_TAKEN);
      else if (err instanceof ApiError && err.code === "BAD_REQUEST") setCodeError(CODE_HINT);
      else setFormError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={ids.heading} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className="h2" id={ids.heading}>New exhibition</h2>
        <label className="field" htmlFor={ids.title}>
          <span className="field__label">Title</span>
          <input id={ids.title} className="input input--tall" value={title} maxLength={200} required autoFocus onChange={(e) => changeTitle(e.target.value)} />
        </label>
        <div className="field">
          <label className="field__label" htmlFor={ids.code}>Exhibition code</label>
          <input
            id={ids.code} className="input input--tall" value={code} required spellCheck={false} autoCapitalize="none"
            aria-invalid={codeError ? true : undefined} aria-describedby={codeError ? ids.codeError : undefined}
            onChange={(e) => changeCode(e.target.value)}
          />
          {codeError
            ? <p className="field-error" id={ids.codeError} role="alert">{codeError}</p>
            : <p className="caption-sm">Part of the visitor guide address. It cannot be changed later.</p>}
        </div>
        {formError && <p className="field-error" role="alert">{formError}</p>}
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy || !title.trim() || !code}>Create exhibition</button>
        </div>
      </form>
    </dialog>
  );
}
