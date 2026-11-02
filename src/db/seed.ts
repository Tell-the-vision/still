/**
 * Seed sample exhibitions.
 *
 *   npm run db:seed
 *
 * Idempotent: exhibitions are matched by slug and replaced (their guide
 * sentences / audio config are re-created). User archives are left alone,
 * except that scraps pointing at re-created sentences keep their snapshot
 * (guide_sentence_id becomes NULL via ON DELETE SET NULL).
 *
 * Content below is fictional sample content for the MVP demo.
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  audioConfigurations,
  exhibitions,
  guideSentences,
  type AudioProvider,
} from "./schema";

type SeedExhibition = {
  slug: string;
  title: string;
  subtitle?: string;
  venue: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImageUrl: string;
  audio: {
    provider: AudioProvider;
    playlistUrl?: string;
    playlistTitle?: string;
    playlistDescription?: string;
    ambienceEnabled: boolean;
  };
  guide: { section: string; sentences: string[] }[];
};

const SEED: SeedExhibition[] = [
  {
    slug: "flow-of-things",
    title: "The Flow of Things",
    subtitle: "A Retrospective Exhibition",
    venue: "STILL Gallery, 서울 성수동",
    startDate: "2026-10-10",
    endDate: "2026-12-28",
    description:
      "이 전시는 일상의 사물과 몸짓이 시간과 공간 속에서 어떻게 흘러가는지를 탐구한다. 작가는 지난 20년간 수집한 사물과 기록을 통해 '머무름'과 '흐름'이 서로를 밀어내는 것이 아니라 함께 존재한다는 것을 보여준다.",
    coverImageUrl: "/images/flow-of-things.png",
    audio: {
      provider: "SPOTIFY",
      playlistUrl: "https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO",
      playlistTitle: "The Flow of Things — Listening Guide",
      playlistDescription: "전시 기획팀이 선정한 피아노 중심의 플레이리스트입니다.",
      ambienceEnabled: true,
    },
    guide: [
      {
        section: "Introduction",
        sentences: [
          "우리는 사물을 소유한다고 믿지만, 사물은 늘 우리를 지나쳐 간다.",
          "이 전시는 멈춰 있는 것처럼 보이는 일상의 조각들이 실은 끊임없이 흐르고 있음을 보여준다.",
          "작가는 20년 동안 모아 온 사물과 기록을 하나의 긴 문장처럼 배열했다.",
        ],
      },
      {
        section: "Room 1 — Objects",
        sentences: [
          "낡은 컵의 손잡이에는 수천 번의 아침이 쌓여 있다.",
          "사물은 쓰임을 잃는 순간 비로소 기억이 된다.",
          "작은 흔적은 더 큰 이야기의 일부다.",
          "버려진 것과 간직된 것의 경계는 생각보다 얇다.",
        ],
      },
      {
        section: "Room 2 — Gestures",
        sentences: [
          "문을 여는 손의 각도는 매일 조금씩 다르다.",
          "반복되는 몸짓 안에도 단 한 번뿐인 순간이 있다.",
          "우리는 흐름을 멈추려 하지 않고, 그 안에 머무는 법을 배운다.",
        ],
      },
      {
        section: "Closing",
        sentences: [
          "전시는 끝나지만, 당신이 가져가는 것은 사물이 아니라 흐름의 감각이다.",
          "머무른다는 것은 흐름을 거부하는 일이 아니라, 흐름을 알아차리는 일이다.",
        ],
      },
    ],
  },
  {
    slug: "quiet-rooms",
    title: "Quiet Rooms",
    subtitle: "Photographs and Installations",
    venue: "성균관대학교 박물관",
    startDate: "2026-11-01",
    endDate: "2027-01-31",
    description:
      "비어 있는 방을 찍은 사진과 소리를 흡수하는 설치 작업으로 구성된 전시. 관람객은 방에서 방으로 이동하며 침묵의 밀도가 어떻게 달라지는지 경험한다.",
    coverImageUrl: "/images/quiet-rooms.png",
    audio: {
      provider: "APPLE_MUSIC",
      playlistUrl:
        "https://music.apple.com/us/playlist/pure-ambient/pl.a9bd89e7b22e45cbaac40b58c9d3d09b",
      playlistTitle: "Quiet Rooms — Ambient Selection",
      playlistDescription: "전시 공간의 침묵과 어울리도록 기관이 제안한 앰비언트 선곡.",
      ambienceEnabled: true,
    },
    guide: [
      {
        section: "Introduction",
        sentences: [
          "침묵은 소리가 없는 상태가 아니라, 소리가 떠난 자리다.",
          "빈 방을 찍는다는 것은 그 방에 머물렀던 시간을 찍는 일이다.",
        ],
      },
      {
        section: "Series I — Afternoon",
        sentences: [
          "오후의 빛은 벽에 기대어 천천히 자리를 옮긴다.",
          "아무도 없는 방에서도 커튼은 누군가를 기다리듯 흔들린다.",
          "사진 속 의자는 앉았던 사람의 무게를 아직 기억하고 있다.",
        ],
      },
      {
        section: "Series II — Night",
        sentences: [
          "밤의 방은 낮보다 넓고, 그 넓이는 전부 어둠으로 채워진다.",
          "불을 끄면 방은 비로소 자신의 소리를 낸다.",
          "우리는 가장 조용한 곳에서 가장 많은 것을 듣는다.",
        ],
      },
      {
        section: "Installation — Felt Wall",
        sentences: [
          "펠트 벽은 당신의 발소리를 삼키고, 대신 심장 소리를 돌려준다.",
          "이 방을 나설 때 당신은 들어올 때보다 조금 더 조용해져 있을 것이다.",
        ],
      },
    ],
  },
  {
    slug: "traces-of-light",
    title: "Traces of Light",
    subtitle: "Light, Time, and Memory",
    venue: "고려대학교 박물관 기획전시실",
    startDate: "2026-09-15",
    endDate: "2026-11-30",
    description:
      "빛이 남기는 흔적을 다루는 미디어 설치 전시. 이 전시에는 기관 제공 플레이리스트가 없으며, STILL Ambience(Pink Noise)를 대체 청취 옵션으로 제공한다.",
    coverImageUrl: "/images/traces-of-light.png",
    audio: {
      provider: "NONE",
      ambienceEnabled: true,
    },
    guide: [
      {
        section: "Introduction",
        sentences: [
          "빛은 머물지 않지만, 머문 흔적을 남긴다.",
          "이 전시의 모든 작품은 빛이 사라진 뒤에 비로소 완성된다.",
        ],
      },
      {
        section: "Work 1 — Afterimage",
        sentences: [
          "눈을 감아도 남아 있는 잔상은 우리가 본 것이 아니라 우리가 느낀 것이다.",
          "기억은 빛의 잔상과 같아서, 사라지는 동안 가장 선명하다.",
          "당신이 지금 보고 있는 것은 이미 지나간 빛이다.",
        ],
      },
      {
        section: "Work 2 — Long Exposure",
        sentences: [
          "긴 노출은 시간을 한 장의 이미지로 접어 넣는다.",
          "움직이는 것은 사라지고, 멈춘 것만이 남는다.",
          "그래서 사진 속 거리는 언제나 텅 비어 있다.",
        ],
      },
      {
        section: "Closing",
        sentences: [
          "전시장을 나서는 순간, 당신의 기억은 또 하나의 흔적이 된다.",
        ],
      },
    ],
  },
];

async function upsertExhibition(item: SeedExhibition) {
  const existing = await db.query.exhibitions.findFirst({
    where: eq(exhibitions.slug, item.slug),
  });

  let exhibitionId: string;
  const base = {
    title: item.title,
    subtitle: item.subtitle ?? null,
    venue: item.venue,
    startDate: item.startDate,
    endDate: item.endDate,
    description: item.description,
    coverImageUrl: item.coverImageUrl,
    qrCodeUrl: `/api/exhibitions/${item.slug}/qr`,
    status: "ACTIVE" as const,
  };

  if (existing) {
    exhibitionId = existing.id;
    await db.update(exhibitions).set(base).where(eq(exhibitions.id, exhibitionId));
    await db.delete(guideSentences).where(eq(guideSentences.exhibitionId, exhibitionId));
    await db
      .delete(audioConfigurations)
      .where(eq(audioConfigurations.exhibitionId, exhibitionId));
  } else {
    const [row] = await db
      .insert(exhibitions)
      .values({ slug: item.slug, ...base })
      .returning({ id: exhibitions.id });
    exhibitionId = row.id;
  }

  let sequence = 0;
  const rows = item.guide.flatMap((g) =>
    g.sentences.map((content) => ({
      exhibitionId,
      section: g.section,
      content,
      sequence: sequence++,
    })),
  );
  if (rows.length) await db.insert(guideSentences).values(rows);

  await db.insert(audioConfigurations).values({
    exhibitionId,
    audioProvider: item.audio.provider,
    playlistUrl: item.audio.playlistUrl ?? null,
    playlistTitle: item.audio.playlistTitle ?? null,
    playlistDescription: item.audio.playlistDescription ?? null,
    ambienceEnabled: item.audio.ambienceEnabled,
    ambienceType: "PINK_NOISE",
  });

  return { id: exhibitionId, slug: item.slug, sentences: rows.length };
}

async function main() {
  for (const item of SEED) {
    const r = await upsertExhibition(item);
    console.log(`✔ ${r.slug}  (${r.sentences} guide sentences)  /e/${r.slug}`);
  }
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
