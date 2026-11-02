import { router } from "./init";
import { archiveRouter } from "./routers/archive";
import { consentRouter } from "./routers/consent";
import { exhibitionRouter } from "./routers/exhibition";
import { guideRouter } from "./routers/guide";
import { identityRouter } from "./routers/identity";
import { meRouter } from "./routers/me";
import { policyRouter } from "./routers/policy";
import { scrapRouter } from "./routers/scrap";
import { sessionRouter } from "./routers/session";

export const appRouter = router({
  archive: archiveRouter,
  consent: consentRouter,
  exhibition: exhibitionRouter,
  guide: guideRouter,
  identity: identityRouter,
  me: meRouter,
  policy: policyRouter,
  scrap: scrapRouter,
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
