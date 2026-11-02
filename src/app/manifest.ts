import type { MetadataRoute } from "next";

/** Web app manifest → "홈 화면에 추가" installs STILL like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "STILL — Art stays with you.",
    short_name: "STILL",
    description: "전시 경험을 기록하고 간직하는 개인 아카이브",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
