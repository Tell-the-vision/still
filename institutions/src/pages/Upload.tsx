import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { SourceFile } from "../api";
import { ARTWORK_TEMPLATE_CSV, MATERIAL_TAGS, UPLOAD_ACCEPT, UPLOAD_EXTENSIONS, UPLOAD_FORMATS_LABEL, UPLOAD_MAX_BYTES } from "../constants";
import { formatAdded, formatMB, formatPeriod } from "../format";
import { NO_PERMISSION } from "../rules";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, PageHead } from "../ui";

const STATUS: Record<SourceFile["status"], { label: string; tone: "green" | "amber" | "gray" }> = {
  QUEUED: { label: "Queued", tone: "gray" },
  UPLOADING: { label: "Uploading", tone: "gray" },
  CANCELED: { label: "Canceled", tone: "gray" },
  UPLOADED: { label: "Uploaded", tone: "green" },
  PROCESSING: { label: "Extracting…", tone: "gray" },
  PROCESSED: { label: "Processed", tone: "green" },
  FAILED: { label: "Failed", tone: "amber" },
};

export default function Upload() {
  const {
    exhibition, files, uploadFiles, rejectFiles, retryUpload, cancelUpload, canRetry, dismissLocalFile, deleteFile, downloadFile, startAnalysis, createExhibition, can,
  } = useWorkspace();
  const [dragging, setDragging] = useState(false);
  const [duplicates, setDuplicates] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const editable = can("edit");

  if (!exhibition) return <NoExhibition title="Exhibition materials" onCreate={createExhibition} />;

  const isLocal = (f: SourceFile) => ["QUEUED", "UPLOADING", "FAILED", "CANCELED"].includes(f.status);
  const onServer = files.filter((f) => !isLocal(f));
  const totalBytes = onServer.reduce((n, f) => n + f.sizeBytes, 0);
  const uploading = files.some((f) => f.status === "UPLOADING" || f.status === "QUEUED");
  const failed = files.filter((f) => f.status === "FAILED").length;
  // Handoff 4.1: processing is enabled once at least one file uploaded successfully.
  const canAnalyse = onServer.some((f) => f.status === "UPLOADED" || f.status === "PROCESSED") && !uploading && !busy;

  const addFiles = (list: FileList | null) => {
    if (!list?.length || !editable) return;
    const refused: { file: File; reason: string }[] = [];
    const fresh: File[] = [];
    const dupes: File[] = [];
    for (const f of list) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!UPLOAD_EXTENSIONS.includes(ext)) refused.push({ file: f, reason: `${ext.toUpperCase() || "This format"} is not supported yet. Use ${UPLOAD_FORMATS_LABEL}.` });
      else if (f.size > UPLOAD_MAX_BYTES) refused.push({ file: f, reason: "Over 100 MB." });
      // Handoff 9: warn on a duplicate name; never overwrite silently. (The server can also compare checksums.)
      else if (onServer.some((s) => s.name === f.name)) dupes.push(f);
      else fresh.push(f);
    }
    if (refused.length) rejectFiles(refused);
    if (dupes.length) setDuplicates((d) => [...d, ...dupes]);
    if (fresh.length) uploadFiles(fresh);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([ARTWORK_TEMPLATE_CSV], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "still-artwork-list-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const resolveDuplicates = async (choice: "keep" | "replace" | "skip") => {
    const list = duplicates;
    setDuplicates([]);
    if (choice === "skip") return;
    if (choice === "replace") {
      for (const f of list) {
        const old = onServer.find((s) => s.name === f.name);
        if (old) await deleteFile(old.id).catch(() => {});
      }
    }
    uploadFiles(list);
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
          editable && (
            <>
              <button type="button" className="btn btn--secondary" onClick={() => navigate("/overview")}>Save draft</button>
              <button type="button" className="btn btn--primary" onClick={analyse} aria-disabled={!canAnalyse} disabled={!canAnalyse}>
                {busy ? "Starting…" : "Start analysis"}
              </button>
            </>
          )
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

      {editable ? (
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
              <p className="muted">Add multiple files at once. {UPLOAD_FORMATS_LABEL} · up to 100 MB per file</p>
              <div className="dropzone__actions">
                <button type="button" className="btn btn--secondary" onClick={() => input.current?.click()}>Browse files</button>
                <span className="small muted">
                  No STILL template needed. HWP/HWPX files and website links are not supported yet.{" "}
                  <button type="button" className="link-btn link-btn--inline" onClick={downloadTemplate}>Optional artwork list template (CSV)</button>
                </span>
              </div>
            </div>
          </div>
          <div className="chips">
            {MATERIAL_TAGS.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
          <input ref={input} type="file" multiple accept={UPLOAD_ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </section>
      ) : (
        <p className="notice">{NO_PERMISSION.edit}</p>
      )}

      {duplicates.length > 0 && (
        <div className="notice notice--amber" role="alert">
          <p>
            <strong>Already uploaded:</strong> {duplicates.map((f) => f.name).join(", ")}. Nothing is overwritten unless you choose Replace.
          </p>
          <div className="notice__actions">
            <button type="button" className="link-btn" onClick={() => resolveDuplicates("keep")}>Keep both</button>
            <button type="button" className="link-btn" onClick={() => resolveDuplicates("replace")}>Replace existing</button>
            <button type="button" className="link-btn" onClick={() => resolveDuplicates("skip")}>Don't upload</button>
          </div>
        </div>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="h2">Uploaded materials</h2>
          <span className="caption">
            {onServer.length} files · {formatMB(totalBytes)}
            {uploading && " · uploading"}
            {failed > 0 && ` · ${failed} failed`}
          </span>
        </div>
        {files.length === 0 ? (
          <EmptyState title="No files uploaded yet" body={`Drop files above or use Browse files. Accepted: ${UPLOAD_FORMATS_LABEL}.`} />
        ) : (
          <div className="table-wrap">
            <table className="table table--files">
              <thead>
                <tr><th>File name</th><th>Type</th><th>Added</th><th>Status</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const local = isLocal(f);
                  return (
                    <tr key={f.id}>
                      <td>
                        <p className="strong">{f.name}</p>
                        {f.error && <p className="caption-sm error">{f.error}</p>}
                        {f.note && <p className="caption-sm muted">{f.note}</p>}
                      </td>
                      <td className="muted">{f.format}{f.summary ? ` · ${f.summary}` : ` · ${formatMB(f.sizeBytes)}`}</td>
                      <td className="muted">{formatAdded(f.uploadedAt)}</td>
                      <td aria-live="polite">
                        <Badge tone={STATUS[f.status].tone}>{STATUS[f.status].label}{f.status === "UPLOADING" && ` ${f.progress ?? 0}%`}</Badge>
                        {f.status === "UPLOADING" && (
                          <span className="progress" role="progressbar" aria-valuenow={f.progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${f.name}`}>
                            <span style={{ width: `${f.progress ?? 0}%` }} />
                          </span>
                        )}
                      </td>
                      <td className="cell-action">
                        {editable && (f.status === "QUEUED" || f.status === "UPLOADING") && (
                          <button type="button" className="link-btn" onClick={() => cancelUpload(f.id)}>Cancel</button>
                        )}
                        {editable && (f.status === "FAILED" || f.status === "CANCELED") && canRetry(f.id) && (
                          <button type="button" className="link-btn link-btn--strong" onClick={() => retryUpload(f.id)}>Retry</button>
                        )}
                        {(f.status === "UPLOADED" || f.status === "PROCESSED") && (
                          <button type="button" className="link-btn" onClick={() => downloadFile(f.id).catch(() => {})} aria-label={`Download ${f.name}`}>Download</button>
                        )}
                        {editable && f.status !== "UPLOADING" && f.status !== "QUEUED" && f.status !== "PROCESSING" && (
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => (local ? dismissLocalFile(f.id) : deleteFile(f.id).catch(() => {}))}
                            aria-label={`Remove ${f.name}`}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
