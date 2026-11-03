export type Audio = {
  playlist: { provider: string; url: string; title: string; description: string | null } | null;
  ambienceEnabled: boolean;
};

// SPEC §6.2: which audio the screen offers. `null` means no audio area.
export function displayMode(choice: "AUTO" | "NONE", audio: Audio): "NONE" | "EXTERNAL" | "AMBIENCE" | null {
  if (choice === "NONE") return "NONE";
  if (audio.playlist) return "EXTERNAL";
  if (audio.ambienceEnabled) return "AMBIENCE";
  return null;
}
