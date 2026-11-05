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

export async function GET(_request: Request, ctx: Params) {
  const object = await objectOf(ctx);
  const bytes = object && (await dryRunGet(object.bucket, object.key));
  return bytes ? new Response(new Uint8Array(bytes)) : notFound();
}
