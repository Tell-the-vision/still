import { useUpgradeRequired } from "../../lib/trpc";
import { Banner } from "../../ui/Banner";
import { appStrings } from "./strings";

export function UpgradeNotice() {
  return useUpgradeRequired() ? <Banner message={appStrings.upgradeRequired} error dismissible={false} /> : null;
}
