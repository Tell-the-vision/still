import type { ContentPackage } from "../content";
import { exhibitionFromBoard } from "./exhibition";

// Demo board "Yoo Youngkuk" from the Figma page "04 — Demo Assets".
// Import by hand, never on deploy: `npm run db:seed src/server/db/seed/figma-demo`.
const pkg: ContentPackage = {
  institution: { code: "sema", name: "Seoul Museum of Art" },
  venues: [{ code: "sema-seosomun", name: "Seoul Museum of Art", city: "Seoul" }],
  exhibitions: [
    exhibitionFromBoard({
      code: "yoo-youngkuk",
      venueCode: "sema-seosomun",
      title: "유영국",
      about: "Yoo Youngkuk. Seoul Museum of Art, Seosomun Main Branch, 1F Galleries.",
      startDate: "2026-05-19",
      endDate: "2026-10-25",
      sentences: [
        "산은 바라보는 풍경이자, 마음속에 쌓이는 감각이다.",
        "멀리 있는 능선이 내 안의 기억과 겹쳐진다.",
        "색과 형태만으로도 자연의 리듬을 느낄 수 있다.",
        "하나의 산은 바라보는 사람마다 다른 풍경이 된다.",
        "마음속 풍경은 시간이 지나도 새로운 모습으로 이어진다.",
      ],
      coverAlt: "Overlapping color fields in red, coral and mauve around a deep teal block, with a cream circle at the upper right, like mountains seen from within.",
      detailAlt: "A cream column inside nested crimson frames on a dark wine ground, with an orange-red sun at the upper right.",
      idBase: 2300,
    }),
  ],
};

export default pkg;
