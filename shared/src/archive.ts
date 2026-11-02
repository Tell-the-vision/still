import { z } from "zod";

export const archiveListInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().nullish(),
});

// The opaque cursor is base64url JSON of the last item's sort key.
export const archiveCursor = z.object({ lastVisitedAt: z.iso.datetime(), id: z.uuid() });
