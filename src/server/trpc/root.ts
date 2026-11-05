import { router } from "./init";
import { adminRouter } from "./routers/admin";
import { archiveRouter } from "./routers/archive";
import { consentRouter } from "./routers/consent";
import { consoleRouter } from "./routers/console";
import { exhibitionRouter } from "./routers/exhibition";
import { guideRouter } from "./routers/guide";
import { identityRouter } from "./routers/identity";
import { journalRouter } from "./routers/journal";
import { keepsakeRouter } from "./routers/keepsake";
import { meRouter } from "./routers/me";
import { passwordRouter } from "./routers/password";
import { policyRouter } from "./routers/policy";
import { scrapRouter } from "./routers/scrap";
import { sessionRouter } from "./routers/session";
import { settingsRouter } from "./routers/settings";

export const appRouter = router({
  admin: adminRouter,
  archive: archiveRouter,
  consent: consentRouter,
  console: consoleRouter,
  exhibition: exhibitionRouter,
  guide: guideRouter,
  identity: identityRouter,
  journal: journalRouter,
  keepsake: keepsakeRouter,
  me: meRouter,
  password: passwordRouter,
  policy: policyRouter,
  scrap: scrapRouter,
  session: sessionRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
