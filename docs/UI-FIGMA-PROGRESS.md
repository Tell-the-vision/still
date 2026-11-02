# UI 작업 진행 상황 — Figma 디자인 적용

> ⚠️ **작업 브랜치(`feat/ui-figma`)입니다. 아직 `main`에 합쳐지지 않았습니다.**
> 사용자 화면(Figma 01–09)과 로그인·404·에러 화면까지 적용을 마쳤습니다.
> 팀 확인 후 PR(Pull Request)을 열어 merge할 예정이니, 그 전까지 이 브랜치의 PR/merge는 보류해 주세요.

- 기준 브랜치: `main` @ `adbc6b3` (2026-11-03 기준 최신, 이후 main 변경 없음)
- 마지막 업데이트: 2026-11-03

## 기준으로 삼은 것

| 기준 | 위치 | 쓰임 |
| --- | --- | --- |
| Figma 시안 (원본) | PRD 저장소 `figma/02-mobile-screens/*.png`, 레이어별 수치 `figma/specs.md` | 화면 배치, 글자 크기, 간격 |
| PRD §3.2 Design Direction | `docs/spec/PRD.md` | 색 규칙, 서체, 레이아웃 원칙 |
| PO 결정 (전시별 테마) | `docs/DECISIONS.md` | 전시 제목·웹카드의 색/서체는 전시 테마를 따름 |

**바꾸지 않은 것:** 기능 코드(저장·로그인·복귀 흐름·임시 저장·삭제), API, DB 스키마, 웹카드 템플릿(`KeepsakeCard.tsx`)과 PNG 내보내기.
화면 모양(className·마크업)만 바꿨고, 테스트가 의존하는 `role` / `aria-*` 속성은 유지했습니다.

## 화면별 진행 상황

| # | 화면 | 주소 | Figma | 상태 | 커밋 |
| --- | --- | --- | --- | --- | --- |
| — | 공통 (색·서체·헤더·하단 탭·버튼·구역 제목) | 전체 | 01 Design System | ✅ | `eb3a686` |
| 01 | Home / 로그인 전 | `/` | 01-home-logged-out | ✅ 가운데 `STILL.`, ■ Log in(Google 설정 시 "Continue with Google"), ● Scan Exhibition QR | `eb3a686` |
| 02 | Home / 로그인 후 | `/` | 02-home-logged-in | ✅ Welcome back, 최근 전시 카드 + Open Exhibition Guide, 아카이브 개수, View all | `eb3a686` |
| 03 | QR Scanner | `/scan` | 03-qr-scanner | ✅ Scan to enter., 모서리 표시 카메라 칸, Having trouble? + Enter Exhibition URL | `eb3a686` |
| 04 | Exhibition Guide | `/e/<slug>` | 04-exhibition-guide | ✅ EXHIBITION / 연도, 왼쪽 정렬 큰 제목(전시 테마 서체), 회색 액자 이미지, About the exhibition, ＋ Save this guide sentence / ✓ Saved, LISTENING | `2c54cb3` |
| 05 | Journal | `/e/<slug>/journal` | 05-journal | ✅ Your journal., 검정 테두리 글쓰기 칸, LISTENING, Save Journal | `a218030` |
| 06 | Digital Keepsake (만들기 / 보기) | `/e/<slug>/keepsake`, `/keepsake/<id>` | 06-digital-keepsake | ✅ Keep this moment., 검정 테두리 미리보기, Choose a layout 3칸, Save Web Card, ↓ Download PNG | `bced316` |
| 07 | My Archive Grid | `/archive` | 07-my-archive-grid | ✅ My Archive + EXPERIENCES 개수, 검정 테두리 2열 카드 | `7036def` |
| 08 | Archive Detail | `/archive/<id>` | 08-archive-detail | ✅ ← MY ARCHIVE, 큰 제목, YOUR COLLECTION 요약, LAST VISITED, 상세 목록, Delete this Archive | `7036def` |
| 09 | Account | `/account` | 09-account | ✅ Account, SIGNED IN AS, PREFERENCES, ABOUT STILL, Log out / Delete account | `123fd1c` |
| — | Login | `/login` | (시안 없음) | ✅ Sign in., 계정 유형 선택, Dev Login — 같은 디자인 규칙 적용 | `d9838a2` |
| — | 404 / 에러 | — | (시안 없음) | ✅ 헤더·여백·하단 탭 적용 | `d9838a2` |
| — | Artist Studio, Admin | `/artist`, `/admin` | (시안 없음) | 범위 밖 — 공통 컴포넌트 변경만 반영 | — |

## 바뀐 파일

| 파일 | 무엇을 바꿨나 |
| --- | --- |
| `src/app/globals.css` | 디자인 토큰: 흑백 + `#666` 보조 텍스트, 1px 블랙 구분선(`.hairline`), 이미지 자리 `#EDEDED`(`bg-placeholder`), 작은 대문자 라벨(`.label`), 화면 제목(`.screen-title`), 포커스 표시 |
| `src/app/layout.tsx` | 폰트 로딩 주석 정리 (Montserrat = Futura 대체, PRD §3.2) |
| `src/components/ui/index.tsx` | 공통 컴포넌트: `STILL.` 워드마크, 상단 헤더(로고 + MY ARCHIVE + 구분선, `← BACK` 줄), 하단 탭, 52px 버튼, 구역 제목, 다이얼로그. 새 컴포넌트 `Artwork`, `ScreenTitle`, `ArrowLink`. 기존 props 유지 |
| `src/app/page.tsx`, `src/components/home/UrlEntry.tsx` | 홈 (01·02) |
| `src/app/scan/page.tsx`, `src/components/QrScanner.tsx` | QR 스캔 (03). 카메라·인식 로직 그대로 |
| `src/app/e/[slug]/page.tsx`, `src/components/exhibition/ExhibitionGuide.tsx`, `src/components/exhibition/LikeReportBar.tsx` | 전시 가이드 (04) |
| `src/components/audio/AudioOptions.tsx` | 오디오 선택을 테두리 줄 형태로(선택 시 검정). 가이드·저널 공용. 재생 로직 그대로 |
| `src/app/e/[slug]/journal/page.tsx`, `src/components/journal/JournalEditor.tsx` | 저널 (05) |
| `src/app/e/[slug]/keepsake/page.tsx`, `src/app/keepsake/[id]/page.tsx`, `src/components/keepsake/KeepsakeCreator.tsx`, `src/components/keepsake/KeepsakeViewer.tsx` | 웹카드 만들기·보기 (06). 카드 디자인/PNG는 그대로 |
| `src/app/archive/page.tsx`, `src/app/archive/[id]/page.tsx`, `src/components/archive/ArchiveDetail.tsx` | 아카이브 목록·상세 (07·08) |
| `src/app/account/page.tsx`, `src/components/account/AccountPanel.tsx` | 계정 (09) |
| `src/app/login/page.tsx`, `src/components/auth/LoginForm.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx` | 로그인·404·에러 |
| `src/components/artist/ExhibitionEditor.tsx` | (1줄) 테마 미리보기 서체가 실제 웹카드와 같은 폰트 목록을 쓰도록 수정 |

## PRD 문서와 Figma 시안이 다른 부분 (팀 확인 필요)

| 항목 | PRD §3.2 | Figma | 이 브랜치의 선택 |
| --- | --- | --- | --- |
| 제목 서체 | Futura 계열, 대체 글꼴 Montserrat | Futura | **Montserrat** (PRD 지정, 전시 테마 `display`와도 일치). Futura 라이선스가 있으면 `globals.css`의 `--font-display`만 교체 |
| 정렬 | 중앙 정렬을 활용한 레이아웃 | 첫 화면만 중앙, 나머지는 왼쪽 정렬 | **Figma**를 따름 (화면별로 더 구체적) |
| 포인트 색 | 유채색 포인트 컬러 사용 안 함 | 흑백만 | 앱 UI는 흑백. 단, PO 결정으로 **전시별 테마 색**(전시 제목·웹카드)은 유지 |

## Figma와 다르게 처리한 부분

- Figma의 8–9px 라벨은 실제 휴대폰에서 한글로 읽기 어려워, 비율은 유지하되 최소 10px로 조금 키웠습니다.
- Figma 헤더 오른쪽의 `MENU`는 앱에 메뉴 기능이 없어 `MY ARCHIVE` 링크로 통일했습니다.
- Figma에 없는 기능(URL 직접 입력, 좋아요·신고, Artist Studio·Admin 진입, Dev Login)은 지우지 않고 같은 스타일로 배치했습니다.
- Figma 06은 만들기 화면에 `↓ Download PNG`가 있지만, 실제 기능은 저장 후 보기 화면(`/keepsake/<id>`)에서 다운로드합니다. 만들기 화면에는 안내 문구로 표시했습니다.

## 확인 방법

```bash
git fetch origin
git checkout feat/ui-figma
npm install
npm run db:reset   # main 최신 커밋에서 DB 스키마가 바뀌었다면 한 번 필요 (로컬 테스트 데이터 삭제됨)
npm run dev        # http://localhost:3000
```

- 로그인 후 화면은 Dev Login으로 확인할 수 있습니다 (예: `admin@still.local`).
- 브라우저 개발자 도구(F12) → 기기 모드(Ctrl+Shift+M)에서 390px 폭으로 보면 Figma와 비교하기 쉽습니다.
- **Windows에서** 개발 서버가 `.next` 폴더 관련 `UNKNOWN: unknown error, open ...` 오류를 내면 `npx next dev --turbopack`으로 실행해 보세요 (백신 실시간 검사와의 파일 잠금 충돌로 보이며, 코드 문제는 아닙니다).
- `npm run typecheck`, `npm run lint` 통과 확인.
