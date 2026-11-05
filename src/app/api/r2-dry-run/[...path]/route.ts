import { dryRunEnabled, dryRunGet, dryRunPathOk, dryRunPut } from "../../../../server/media/r2-dry-run";

// The presigned PUT / GET target under R2_DRY_RUN=1 (see server/media/r2-dry-run.ts). Anywhere else it does not exist.

type Params = { params: Promise<{ path: string[] }> };
const notFound = () => new Response(null, { status: 404 });

async function objectOf({ params }: Params) {
  const segments = (await params).path;
  return dryRunEnabled() && dryRunPathOk(segments) ? { bucket: segments[0], key: segments.slice(1).join("/") } : null;
}

export async function PUT(request: Request, ctx: Params) {
  const object = await objectOf(ctx);
  if (!object) return notFound();
  await dryRunPut(object.bucket, object.key, new Uint8Array(await request.arrayBuffer()));
  return new Response(null, { status: 200 });
}

// A single `bytes=start-end` / `bytes=start-` range answers 206 like R2; one past the end answers 416.
export async function GET(request: Request, ctx: Params) {
  const object = await objectOf(ctx);
  const stored = object && (await dryRunGet(object.bucket, object.key));
  if (!stored) return notFound();
  const bytes = new Uint8Array(stored);
  const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!match) return new Response(bytes);
  const start = Number(match[1]);
  const end = Math.min(match[2] === "" ? bytes.length - 1 : Number(match[2]), bytes.length - 1);
  if (start >= bytes.length || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } });
  return new Response(bytes.slice(start, end + 1), { status: 206, headers: { "Content-Range": `bytes ${start}-${end}/${bytes.length}` } });
}
