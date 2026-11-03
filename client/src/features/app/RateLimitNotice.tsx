import { useRateLimited } from "../../lib/trpc";
import { Banner } from "../../ui/Banner";
import { appStrings } from "./strings";

export function RateLimitNotice() {
  return useRateLimited() ? <Banner message={appStrings.rateLimited} error /> : null;
}
