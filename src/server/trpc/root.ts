import { router } from "./init";
import { archiveRouter } from "./routers/archive";
import { consentRouter } from "./routers/consent";
import { exhibitionRouter } from "./routers/exhibition";
import { guideRouter } from "./routers/guide";
import { identityRouter } from "./routers/identity";
import { journalRouter } from "./routers/journal";
import { meRouter } from "./routers/me";
import { policyRouter } from "./routers/policy";
import { scrapRouter } from "./routers/scrap";
import { sessionRouter } from "./routers/session";
import { settingsRouter } from "./routers/settings";

export const appRouter = router({
  archive: archiveRouter,
  consent: consentRouter,
  exhibition: exhibitionRouter,
  guide: guideRouter,
  identity: identityRouter,
  journal: journalRouter,
  me: meRouter,
  policy: policyRouter,
  scrap: scrapRouter,
  session: sessionRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
