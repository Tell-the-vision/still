import { router } from "./init";
import { exhibitionRouter } from "./routers/exhibition";
import { guideRouter } from "./routers/guide";
import { meRouter } from "./routers/me";
import { sessionRouter } from "./routers/session";

export const appRouter = router({
  exhibition: exhibitionRouter,
  guide: guideRouter,
  me: meRouter,
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
