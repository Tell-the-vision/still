import { router } from "./init";
import { exhibitionRouter } from "./routers/exhibition";
import { guideRouter } from "./routers/guide";
import { meRouter } from "./routers/me";

export const appRouter = router({
  exhibition: exhibitionRouter,
  guide: guideRouter,
  me: meRouter,
});

export type AppRouter = typeof appRouter;
