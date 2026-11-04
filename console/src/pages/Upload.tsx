import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MATERIAL_TAGS, UPLOAD_ACCEPT, UPLOAD_MAX_BYTES } from "../constants";
import { formatAdded, formatMB, formatPeriod } from "../format";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, PageHead } from "../ui";

export default function Upload() {
  const { exhibition, files, uploadFiles, deleteFile, startAnalysis, createExhibition } = useWorkspace();
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  if (!exhibition) return <NoExhibition title="Exhibition materials" onCreate={createExhibition} />;

  const totalBytes = files.reduce((n, f) => n + f.sizeBytes, 0);
  const uploading = files.some((f) => f.status === "UPLOADING");

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const all = [...list];
    const tooBig = all.filter((f) => f.size > UPLOAD_MAX_BYTES);
    setRejected(tooBig.length ? `${tooBig.map((f) => f.name).join(", ")}: over 100 MB` : null);
    const ok = all.filter((f) => f.size <= UPLOAD_MAX_BYTES);
    if (ok.length) uploadFiles(ok).catch(() => {});
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const analyse = async () => {
    setBusy(true);
    try {
      await startAnalysis();
      navigate("/materials/review");
    } catch { /* error banner shows it */ } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow={<>Exhibition setup <span aria-hidden>/</span> Step 01</>}
        title="Exhibition materials"
        lede="Upload the materials you already have. STILL will organise the content for your review."
        actions={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => navigate("/overview")}>Save draft</button>
            <button type="button" className="btn btn--primary" onClick={analyse} aria-disabled={!files.length || uploading || busy} disabled={!files.length || uploading || busy}>
              {busy ? "Starting…" : "Start analysis"}
            </button>
          </>
        }
      />
      <hr className="rule" />

      <div className="exhibition-line">
        <Badge>{exhibition.status === "DRAFT" ? "Draft" : "Published"}</Badge>
        <div>
          <p className="exhibition-line__title">{exhibition.title}{exhibition.subtitle && ` — ${exhibition.subtitle}`}</p>
          <p className="caption">{exhibition.venueName} · {formatPeriod(exhibition.startDate, exhibition.endDate)}</p>
        </div>
      </div>

      <section
        className={`dropzone${dragging ? " is-dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label="Upload exhibition files"
      >
        <div className="dropzone__row">
          <span className="dropzone__icon" aria-hidden>↑</span>
          <div className="dropzone__body">
            <h2 className="h3">Drop your exhibition files here</h2>
            <p className="muted">Add multiple files at once. PDF, DOCX, XLSX, PPTX, TXT · up to 100 MB per file</p>
            <div className="dropzone__actions">
              <button type="button" className="btn btn--secondary" onClick={() => input.current?.click()}>Browse files</button>
              <span className="small muted">You can also add website links or paste text after uploading.</span>
            </div>
            {rejected && <p className="small error" role="alert">{rejected}</p>}
          </div>
        </div>
        <div className="chips">
          {MATERIAL_TAGS.map((t) => <span key={t} className="chip">{t}</span>)}
        </div>
        <input ref={input} type="file" multiple accept={UPLOAD_ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="h2">Uploaded materials</h2>
          <span className="caption">{files.length} files · {formatMB(totalBytes)}</span>
        </div>
        {files.length === 0 ? (
          <EmptyState title="No files uploaded yet" body="Drop files above or use Browse files." />
        ) : (
          <div className="table-wrap">
            <table className="table table--files">
              <thead>
                <tr><th>File name</th><th>Type</th><th>Added</th><th>Status</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td className="strong">{f.name}</td>
                    <td className="muted">{f.format}{f.summary ? ` · ${f.summary}` : ` · ${formatMB(f.sizeBytes)}`}</td>
                    <td className="muted">{formatAdded(f.uploadedAt)}</td>
                    <td>
                      {f.status === "READY" ? <Badge tone="green">Ready</Badge> : f.status === "FAILED" ? <Badge tone="amber">Failed</Badge> : <Badge>Uploading</Badge>}
                    </td>
                    <td className="cell-action">
                      {f.status !== "UPLOADING" && (
                        <button type="button" className="link-btn" onClick={() => deleteFile(f.id).catch(() => {})} aria-label={`Remove ${f.name}`}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
