import { router } from "./init";
import { exhibitionRouter } from "./routers/exhibition";
import { guideRouter } from "./routers/guide";

export const appRouter = router({
  exhibition: exhibitionRouter,
  guide: guideRouter,
});

export type AppRouter = typeof appRouter;
