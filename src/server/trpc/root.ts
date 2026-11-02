import { router } from "./init";
import { consentRouter } from "./routers/consent";
import { exhibitionRouter } from "./routers/exhibition";
import { guideRouter } from "./routers/guide";
import { meRouter } from "./routers/me";
import { policyRouter } from "./routers/policy";
import { sessionRouter } from "./routers/session";

export const appRouter = router({
  consent: consentRouter,
  exhibition: exhibitionRouter,
  guide: guideRouter,
  me: meRouter,
  policy: policyRouter,
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
