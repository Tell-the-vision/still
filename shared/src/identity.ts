import { z } from "zod";

export const identityDeleteInput = z.object({ identityId: z.uuid() });
