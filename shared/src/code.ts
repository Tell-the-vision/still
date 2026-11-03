import { z } from "zod";

// Exhibition code: lowercase slug (SPEC §1.2).
export const CODE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const codeSchema = z.string().regex(CODE_REGEX);

export const exhibitionInput = z.object({ code: codeSchema });
