# 구현 결정 사항 (Open Decisions → MVP 기본값)

개발 명세 §18 "Open Decisions Before Development"의 항목을 MVP에서 아래처럼 처리했습니다.
모두 **코드 한 곳**만 바꾸면 정책을 뒤집을 수 있도록 두었습니다. PO 합의 후 조정하세요.

| ID | 주제 | MVP 결정 | 바꾸려면 |
| --- | --- | --- | --- |
| TBD-01 | Scrap 저장 해제 | **허용.** 가이드에서 Saved를 다시 누르면 해제, Archive Detail에도 "저장 해제" 제공. API `DELETE /archives/{id}/scraps/{scrapId}` | 해제 UI만 숨기면 됨 (`ExhibitionGuide.tsx`의 `remove`, `ArchiveDetail.tsx`의 `removeScrap`) |
| TBD-02 | Keepsake 개수 | **전시당 여러 장 허용 (1 : N).** Archive Detail에 가로 스크롤 목록 | `POST /archives/{id}/keepsakes`에서 기존 카드 수 검사 후 409 |
| TBD-03 | Keepsake 콘텐츠 | 템플릿별로 다름: Sentence = 저장한 문장 1개 선택, Reflection = Journal 발췌(자동 240자, 수정 가능), Cover = 대표 이미지 + 문장 1개. 저장 시 **스냅샷**으로 고정 | `lib/keepsake-templates.ts`의 `uses`, `KEEPSAKE_LIMITS` |
| TBD-04 | 플레이리스트 등록 | 운영자가 `src/db/seed.ts`(또는 DB `audio_configurations`)에 직접 입력. CMS 없음 | — |
| TBD-05 | Pink Noise 노출 범위 | **Exhibition Guide + Journal + Account** 모두에서 제어 | `AudioOptions` 컴포넌트 배치만 조정 |
| TBD-06 | 재생 유지 | **화면 이동 시 유지**(앱 루트의 `AudioProvider`가 상태 보유). 로그아웃/전체 새로고침 시 중지 | `AudioProvider`를 페이지 레벨로 내리면 화면 단위로 끊김 |
| TBD-07 | Journal 검증 | 공백만 있는 내용 저장 불가(422), **최대 2,000자** | `lib/archives.ts`의 `JOURNAL_MAX_LENGTH`, `JournalEditor.tsx`의 `JOURNAL_MAX` |
| TBD-08 | 계정 삭제 | 사용자 + 모든 Archive/Scrap/Journal/Keepsake **즉시 영구 삭제**. 같은 Google 계정으로 재로그인 시 새 사용자 생성 | `deleteUserCompletely()` |
| TBD-09 | PNG 해상도/비율 | **3 : 4, 360×480 CSS px → 3배 = 1080×1440 PNG** | `lib/keepsake-templates.ts`의 `KEEPSAKE_CARD`, `globals.css`의 `.keepsake-card` |
| TBD-10 | 오프라인 임시 기록 | Journal 초안은 `localStorage`(전시별, 새로고침·로그인 왕복·짧은 오프라인에 보존), Keepsake 초안은 `sessionStorage`(로그인 왕복만) | `lib/client/drafts.ts` |

## 추가로 정한 것

- **로그인 중단 → 복귀**: 비로그인 사용자가 저장을 누르면 `sessionStorage`에 `pending-action`(scrap / journal / keepsake)을 기록하고 `/login?callbackUrl=현재주소`로 이동. 로그인 후 같은 화면이 다시 열리면 해당 액션을 자동으로 마저 실행(문장 저장, Journal 저장, 웹카드 저장). 30분이 지난 pending action은 무시.
- **Dev Login**: Google 설정이 없을 때 개발 환경에서만 노출되는 이메일 전용 로그인. 프로덕션에서는 `ENABLE_DEV_LOGIN=true`를 명시하지 않는 한 비활성.
- **전시 식별**: 모든 전시 API와 `/e/<slug>`는 id와 slug를 모두 받습니다. QR에는 사람이 읽을 수 있는 slug를 씁니다.
- **가이드 문장 그룹화**: `guide_sentences.section`(선택)으로 작품/챕터별 소제목을 표현합니다. 스펙의 평면 구조(sequence)와 호환됩니다.
- **Scrap 스냅샷**: `guide_sentence_id`는 nullable + `ON DELETE SET NULL`. 기관이 문장을 삭제해도 사용자가 저장한 문장은 `sentence_content_snapshot`으로 남습니다.
- **PNG 생성 위치**: 클라이언트(`html-to-image`). 서버 렌더링 대신 선택한 이유는 "웹카드와 PNG가 픽셀 단위로 동일"하다는 요구(KEEPSAKE-05) 충족이 가장 쉽기 때문. 서버 `GET /keepsakes/{id}/export`는 구현하지 않았습니다.
- **Analytics**: `lib/client/analytics.ts`의 `track()`이 `window.dataLayer`에 push. GTM/GA를 붙이면 그대로 수집됩니다. 민감 정보(본문, 이메일)는 넣지 않습니다.
