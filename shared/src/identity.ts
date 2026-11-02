import { z } from "zod";
import { sessionCreateInput } from "./session";

export const identityCreateInput = sessionCreateInput;
export const identityDeleteInput = z.object({ identityId: z.uuid() });
