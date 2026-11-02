import { z } from "zod";

export const settingsUpdateInput = z.object({ audioMode: z.enum(["AUTO", "NONE"]) });
