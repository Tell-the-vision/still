# UI 작업 진행 상황 — Figma 디자인 적용

> ⚠️ **작업 중인 브랜치(`feat/ui-figma`)입니다. 아직 `main`에 합쳐지지 않았습니다.**
> 화면 일부만 바뀐 상태라, 아직 작업하지 않은 화면은 새 헤더와 예전 배치가 섞여 보일 수 있습니다.
> 작업이 끝나면 PR(Pull Request)을 열어 팀 확인 후 merge할 예정입니다.

- 기준 브랜치: `main` @ `adbc6b3` (2026-11-03 기준 최신)
- 마지막 업데이트: 2026-11-03

## 기준으로 삼은 것

| 기준 | 위치 | 쓰임 |
| --- | --- | --- |
| Figma 시안 (원본) | PRD 저장소 `figma/02-mobile-screens/*.png`, 레이어별 수치 `figma/specs.md` | 화면 배치, 글자 크기, 간격 |
| PRD §3.2 Design Direction | `docs/spec/PRD.md` | 색 규칙, 서체, 레이아웃 원칙 |
| PO 결정 (전시별 테마) | `docs/DECISIONS.md` | 전시 제목·웹카드의 색/서체는 전시 테마를 따름 |

**바꾸지 않은 것:** 기능 코드(저장·로그인·복귀 흐름), API, DB 스키마, 웹카드 템플릿(`KeepsakeCard.tsx`).
화면 모양(className·마크업)만 바꿨고, 테스트가 의존하는 `role` / `aria-*` 속성은 유지했습니다.

## 바뀐 파일

| 파일 | 무엇을 바꿨나 |
| --- | --- |
| `src/app/globals.css` | 디자인 토큰: 흑백 + `#666` 보조 텍스트, 1px 블랙 구분선(`.hairline`), 이미지 자리 `#EDEDED`(`bg-placeholder`), 작은 대문자 라벨(`.label`), 화면 제목(`.screen-title`), 포커스 표시 |
| `src/app/layout.tsx` | 폰트 로딩 주석 정리 (Montserrat = Futura 대체, PRD §3.2) |
| `src/components/ui/index.tsx` | 공통 컴포넌트를 Figma 스타일로: `STILL.` 워드마크, 상단 헤더(로고 + MY ARCHIVE + 구분선, 뒤로가기는 `← BACK` 줄), 하단 탭(HOME · ARCHIVE · ACCOUNT), 52px 버튼, 구역 제목(구분선 + 라벨), 다이얼로그. 새 컴포넌트 `Artwork`(회색 액자 이미지), `ScreenTitle`, `ArrowLink` 추가. 기존 props는 그대로 |
| `src/app/page.tsx` | **홈** — 로그인 전(Figma 01) / 로그인 후(Figma 02) |
| `src/app/scan/page.tsx`, `src/components/QrScanner.tsx` | **QR 스캔** (Figma 03). 카메라·QR 인식 로직은 그대로, 화면 배치만 변경 |
| `src/components/home/UrlEntry.tsx` | URL 입력칸 스타일 정리 |
| `src/components/artist/ExhibitionEditor.tsx` | (1줄) 테마 미리보기 서체가 실제 웹카드와 같은 폰트 목록을 쓰도록 수정 |
| `src/components/exhibition/ExhibitionGuide.tsx`, `src/app/e/[slug]/page.tsx` | **전시 가이드** (Figma 04). 저장·복귀·좋아요 로직은 그대로 |
| `src/components/audio/AudioOptions.tsx` | 오디오 선택을 Figma 05의 테두리 줄 형태로 (선택 시 검정 채움). 가이드·저널 공용. 재생 로직은 그대로 |
| `src/components/exhibition/LikeReportBar.tsx` | 좋아요·신고 글씨 크기만 정리 |

## 화면별 진행 상황

| # | 화면 | Figma | 상태 |
| --- | --- | --- | --- |
| 01 | Home / 로그인 전 | 01-home-logged-out | ✅ 완료 — 가운데 `STILL.`, ■ Log in(Google 설정 시 "Continue with Google"), ● Scan Exhibition QR |
| 02 | Home / 로그인 후 | 02-home-logged-in | ✅ 완료 — Welcome back, 최근 전시 카드 + Open Exhibition Guide, 아카이브 개수, View all. (Figma에 없는 URL 입력·Artist/Admin 링크·로그아웃은 같은 스타일로 아래에 유지) |
| 03 | QR Scanner | 03-qr-scanner | ✅ 완료 — Scan to enter., 모서리 표시 카메라 칸, Having trouble? + Enter Exhibition URL |
| 04 | Exhibition Guide | 04-exhibition-guide | ✅ 완료 — EXHIBITION / 연도 라벨, 왼쪽 정렬 큰 제목(전시 테마 서체 + 포인트 선), 회색 액자 이미지, About the exhibition, ＋ Save this guide sentence / ✓ Saved, LISTENING 오디오 줄, 하단 탭 |
| 05 | Journal | 05-journal | ⏳ 다음 작업 (오디오 선택 줄은 04에서 함께 적용됨) |
| 06 | Digital Keepsake | 06-digital-keepsake | ⏳ 예정 |
| 07 | My Archive Grid | 07-my-archive-grid | ⏳ 예정 |
| 08 | Archive Detail | 08-archive-detail | ⏳ 예정 |
| 09 | Account | 09-account | ⏳ 예정 |
| — | Login, 에러/빈 화면 | (시안 없음) | ⏳ 같은 디자인 규칙으로 맞출 예정 |
| — | Artist Studio, Admin | (시안 없음) | 공통 컴포넌트 변경만 반영. 별도 작업 범위 밖 |

## PRD 문서와 Figma 시안이 다른 부분 (팀 확인 필요)

| 항목 | PRD §3.2 | Figma | 이 브랜치의 선택 |
| --- | --- | --- | --- |
| 제목 서체 | Futura 계열, 대체 글꼴 Montserrat | Futura | **Montserrat** (PRD 지정, 전시 테마 `display`와도 일치). Futura 라이선스가 있으면 `globals.css`의 `--font-display`만 교체 |
| 정렬 | 중앙 정렬을 활용한 레이아웃 | 첫 화면만 중앙, 나머지는 왼쪽 정렬 | **Figma**를 따름 (화면별로 더 구체적) |
| 포인트 색 | 유채색 포인트 컬러 사용 안 함 | 흑백만 | 앱 UI는 흑백. 단, PO 결정으로 **전시별 테마 색**(전시 제목·웹카드)은 유지 |

그 밖에 Figma의 8–9px 라벨은 실제 휴대폰에서 한글로 읽기 어려워, 비율은 유지하되 최소 10px로 조금 키웠습니다.

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
- `npm run typecheck`, `npm run lint` 통과 확인.
