import { parseExhibitionTarget } from "@still/shared/entry";

const stillOrigin = process.env.EXPO_PUBLIC_STILL_ORIGIN ?? "";

// SPEC §1.2: still://e/{code} and https://{origin}/e/{code} open the guide; anything else opens Scan.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const target = parseExhibitionTarget(path.replace(/^still:\/\//, `${stillOrigin}/`), stillOrigin);
  return target ? `/e/${target.code}` : "/scan";
}
