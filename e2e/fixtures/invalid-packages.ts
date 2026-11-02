import { defaultPackage, type ContentPackage } from "../../src/server/db/seed/content";

// Each variant breaks exactly one import rule; importing any of them must fail.
const base = defaultPackage.exhibitions[1];
const baseGuide = base.guide;
if (!baseGuide) throw new Error("seed exhibition 1 must have a guide");
const withExhibition = (changes: Partial<typeof base>): ContentPackage => ({
  ...defaultPackage,
  exhibitions: [{ ...base, ...changes }],
});

export const invalidPackages = {
  "bad-code": withExhibition({ code: "Bad Code" }),
  "duplicate-sentence": withExhibition({
    guide: { version: 1, blocks: [...baseGuide.blocks, baseGuide.blocks[1]] },
  }),
  "wrong-playlist-domain": withExhibition({
    playlist: { provider: "SPOTIFY", url: "https://music.apple.com/x", title: "t", description: null },
  }),
};
