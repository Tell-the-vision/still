// SPEC §2.4: returnTo is a same-origin path from an allowlist (open-redirect guard).
const ALLOWED = [
  /^\/$/,
  /^\/(scan|login|consent|account|archive)$/,
  /^\/archive\/[^/?#]+$/,
  /^\/archive\/[^/?#]+\/keepsake$/,
  /^\/e\/[^/?#]+$/,
  /^\/e\/[^/?#]+\/journal$/,
];

export function safeReturnTo(value: string | null): string {
  if (value === null || value.includes("#")) return "/";
  const [path] = value.split("?");
  return ALLOWED.some((re) => re.test(path)) ? value : "/";
}
