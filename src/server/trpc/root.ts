import { router } from "./init";
import { exhibitionRouter } from "./routers/exhibition";

export const appRouter = router({
  exhibition: exhibitionRouter,
});

export type AppRouter = typeof appRouter;
