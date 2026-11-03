import { z } from "zod";
import { codeSchema } from "./code";

export const scrapInput = z.object({ code: codeSchema, sentenceId: z.uuid() });
