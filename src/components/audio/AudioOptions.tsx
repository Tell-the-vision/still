"use client";

/**
 * Audio option panel (spec §6.3 priority logic):
 *   organiser playlist exists → External Playlist link (Apple Music / Spotify)
 *   otherwise                 → STILL Ambience (Pink Noise) on/off
 *   always                    → No Audio
 */
import { useEffect, useState } from "react";
import { Button, Notice, cx } from "@/components/ui";
import { track } from "@/lib/client/analytics";
import { api } from "@/lib/client/fetcher";
import { useAudio, type AudioMode } from "./AudioProvider";

export type AudioInfo = {
  exhibitionId: string;
  mode: "EXTERNAL_PLAYLIST" | "AMBIENCE";
  externalPlaylist: {
    provider: "APPLE_MUSIC" | "SPOTIFY" | "NONE";
    url: string | null;
    title: string | null;
    description: string | null;
  } | null;
  ambience: { enabled: boolean; type: string };
};

const PROVIDER_LABEL: Record<string, string> = {
  APPLE_MUSIC: "Apple Music",
  SPOTIFY: "Spotify",
};

export function useAudioInfo(exhibitionIdOrSlug: string | null) {
  const [info, setInfo] = useState<AudioInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!exhibitionIdOrSlug) return;
    let alive = true;
    api<AudioInfo>(`/api/exhibitions/${exhibitionIdOrSlug}/audio`)
      .then((d) => alive && setInfo(d))
      .catch(() => alive && setError("오디오 정보를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [exhibitionIdOrSlug]);
  return { info, error };
}

export function AudioOptions({
  info,
  /** Optional: tell the parent which option is selected (e.g. Journal.audioType). */
  onModeChange,
  compact,
}: {
  info: AudioInfo | null;
  onModeChange?: (mode: AudioMode) => void;
  compact?: boolean;
}) {
  const audio = useAudio();
  const [linkError, setLinkError] = useState<string | null>(null);

  if (!info) return null;
  const playlist = info.externalPlaylist;
  const hasPlaylist = Boolean(playlist?.url);
  const ambienceAvailable = info.ambience.enabled && audio.ambienceSupported;

  const choose = (mode: AudioMode) => {
    audio.setMode(mode);
    onModeChange?.(mode);
  };

  const openPlaylist = () => {
    if (!playlist?.url) return;
    let ok = true;
    try {
      const u = new URL(playlist.url);
      ok = u.protocol === "https:";
    } catch {
      ok = false;
    }
    if (!ok) {
      setLinkError("플레이리스트 링크를 열 수 없습니다. 전시 기관에 문의해 주세요.");
      return;
    }
    track("audio_external_click", { provider: playlist.provider, exhibition_id: info.exhibitionId });
    choose("EXTERNAL_PLAYLIST");
    window.open(playlist.url, "_blank", "noopener,noreferrer");
  };

  // Figma 05 "Listening": bordered rows; the active choice is filled black.
  const row = (active: boolean) =>
    cx(
      "w-full flex items-center justify-between gap-3 min-h-[46px] px-3.5 py-2.5 border border-ink text-left",
      active ? "bg-ink text-paper" : "bg-paper text-ink",
    );
  const sub = (active: boolean) => cx("text-[11px] leading-4 mt-0.5", active ? "text-paper/70" : "text-muted");

  return (
    <div className={cx("space-y-2", !compact && "hairline pt-4")} aria-label="Audio options">
      {hasPlaylist && playlist && (
        <div className={row(audio.mode === "EXTERNAL_PLAYLIST")}>
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.04em] truncate">
              External Playlist · {PROVIDER_LABEL[playlist.provider] ?? playlist.provider}
            </p>
            <p className={cx(sub(audio.mode === "EXTERNAL_PLAYLIST"), "truncate")}>
              {playlist.title ?? "Playlist"}
              {playlist.description ? ` · ${playlist.description}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={openPlaylist}
            className="shrink-0 text-[12px] font-medium underline underline-offset-4"
          >
            {PROVIDER_LABEL[playlist.provider] ?? "Open"}에서 듣기 ↗
          </button>
        </div>
      )}

      {/* Ambience is the fallback when there is no playlist; still reachable otherwise (TBD-05). */}
      {ambienceAvailable && (
        <button
          type="button"
          role="switch"
          aria-checked={audio.ambience === "on"}
          onClick={() => {
            if (audio.ambience === "on") {
              audio.ambienceOff(info.exhibitionId);
              choose("NONE");
            } else {
              void audio.ambienceOn(info.exhibitionId).then(() => onModeChange?.("AMBIENCE"));
            }
          }}
          className={row(audio.ambience === "on")}
        >
          <span className="min-w-0">
            <span className="block text-[12px] font-medium uppercase tracking-[0.04em]">STILL Ambience · Pink Noise</span>
            <span className={cx("block", sub(audio.ambience === "on"))}>
              {hasPlaylist ? "대체 옵션" : "기관 제공 플레이리스트가 없는 전시"}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-medium">{audio.ambience === "on" ? "ON" : "OFF"}</span>
        </button>
      )}

      {!ambienceAvailable && !hasPlaylist && (
        <p className="text-muted text-[12px] py-2">이 전시는 오디오 옵션을 제공하지 않습니다.</p>
      )}

      <button
        type="button"
        onClick={() => choose("NONE")}
        aria-pressed={audio.mode === "NONE"}
        className={row(audio.mode === "NONE")}
      >
        <span className="text-[12px] font-medium uppercase tracking-[0.04em]">No Audio</span>
        <span className="shrink-0 text-[12px] font-medium">{audio.mode === "NONE" ? "Selected" : "Select"}</span>
      </button>

      {ambienceAvailable && <p className="label pt-1">Pink Noise is user-controlled. Default: Off.</p>}

      {audio.ambience === "error" && audio.ambienceError && (
        <Notice tone="error" action={<Button variant="text" onClick={() => void audio.ambienceOn(info.exhibitionId)}>Retry</Button>}>
          {audio.ambienceError}
        </Notice>
      )}
      {linkError && <Notice tone="error">{linkError}</Notice>}
    </div>
  );
}
