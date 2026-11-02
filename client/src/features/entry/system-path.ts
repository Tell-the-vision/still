import { CODE_REGEX } from "@still/shared/code";

// SPEC §1.2/§1.3: only exhibition links are rewritten; every other system path (e.g. the OAuth redirect) passes through.
export function systemPathFor(path: string, stillOrigin: string): string {
  let normalized = path.replace(/^still:\/\/(?=e\/)/, "/").replace(/^exp:\/\/[^/]+\/--(?=\/e\/)/, "");
  if (stillOrigin && normalized.startsWith(`${stillOrigin}/e/`)) normalized = normalized.slice(stillOrigin.length);
  const match = /^\/?e\/([^/?#]+)\/?$/.exec(normalized);
  if (!match) return path;
  return CODE_REGEX.test(match[1]) ? `/e/${match[1]}` : "/scan";
}
