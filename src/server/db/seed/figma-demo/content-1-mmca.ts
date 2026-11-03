import type { ContentPackage } from "../content";
import { exhibitionFromBoard } from "./exhibition";

// Demo boards "Do Ho Suh" and "Damien Hirst" from the Figma page "04 — Demo Assets".
// Import by hand, never on deploy: `npm run db:seed src/server/db/seed/figma-demo`.
const pkg: ContentPackage = {
  institution: { code: "mmca", name: "National Museum of Modern and Contemporary Art, Korea" },
  venues: [{ code: "mmca-seoul", name: "MMCA Seoul", city: "Seoul" }],
  exhibitions: [
    exhibitionFromBoard({
      code: "do-ho-suh",
      venueCode: "mmca-seoul",
      title: "서도호",
      about: "Do Ho Suh. MMCA Seoul, Galleries 3, 4, 5.",
      startDate: "2026-08-27",
      endDate: "2027-02-09",
      sentences: [
        "공간을 떠나도, 그곳에서 보낸 시간까지 사라지는 것은 아니다.",
        "어떤 문은 새로운 곳으로 가는 입구이자, 돌아가고 싶은 곳의 기억이다.",
        "사라진 공간에도 누군가의 생활은 흔적으로 남아 있다.",
        "우리가 살아온 공간들은 서로 연결되어 하나의 기억을 만든다.",
        "어떤 기억은 장소가 아니라 작은 물건 하나에 머문다.",
      ],
      coverAlt: "Pale translucent panels overlap like doorways on a soft gray ground, with a white circle of light at the upper right and a thin floor line below.",
      detailAlt: "A narrow white passage framed by layered pale panels, with a soft circle of light at the upper right.",
      idBase: 2100,
    }),
    exhibitionFromBoard({
      code: "damien-hirst",
      venueCode: "mmca-seoul",
      title: "데이미언 허스트",
      about: "Damien Hirst. MMCA Seoul, B1 Galleries 3, 4, 5, 2F MMCA Studio and Seoul Box.",
      startDate: "2026-03-20",
      endDate: "2027-02-28", // Board: 2026-06-28 (ended); extended so it shows as on view.
      sentences: [
        "끝을 마주할 때, 우리는 삶의 모양을 더 선명하게 바라본다.",
        "과학은 생명을 설명하고, 믿음은 삶의 의미를 묻는다.",
        "아름다움과 불안은 때로 같은 표면 위에 놓인다.",
        "우리가 소중하다고 여기는 것은 무엇으로 증명될까.",
        "사라짐을 의식하는 순간, 지금의 시간이 다르게 보인다.",
      ],
      coverAlt: "Gray panels step from light to dark around a bright white opening, with a white circle at the upper right and a thin floor line below.",
      detailAlt: "A black slit inside nested gray frames on a black ground, with a bright white circle at the upper right.",
      idBase: 2200,
    }),
  ],
};

export default pkg;
