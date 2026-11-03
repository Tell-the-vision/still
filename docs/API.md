# API Reference

모든 엔드포인트는 `/api` 아래에 있으며 JSON을 주고받습니다. 인증은 Auth.js 세션 쿠키(같은 도메인)로 처리됩니다.

## 공통 오류 형식

```json
{ "error": { "code": "RESOURCE_NOT_FOUND", "message": "전시를 찾을 수 없습니다." } }
```

| Status | code | 의미 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | 잘못된 JSON 등 |
| 401 | `UNAUTHORIZED` | 로그인 필요 |
| 403 | `FORBIDDEN` | 내 소유가 아닌 Archive/Keepsake |
| 404 | `RESOURCE_NOT_FOUND` | 리소스 없음 (비활성 전시 포함) |
| 409 | `CONFLICT` | 상태 충돌 (현재 미사용 — 중복 저장은 200으로 멱등 처리) |
| 422 | `VALIDATION_FAILED` | 유효성 실패 (빈 Journal, 2,000자 초과, 다른 전시의 문장 등) |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

`{id}`로 표기한 전시 식별자는 **id 또는 slug** 모두 허용됩니다.

## Auth

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET/POST | `/api/auth/*` | Auth.js 핸들러 (`/api/auth/signin`, `/api/auth/callback/google`, `/api/auth/signout` …). 클라이언트에서는 `next-auth/react`의 `signIn('google', { redirectTo })` / `signOut()` 사용 |
| GET | `/api/users/me` | `{ user: { id, email, displayName, image, role, status, artistStatus, artistName, …, createdAt } \| null }` |
| DELETE | `/api/users/me` | 계정 + 모든 기록 삭제 → 204. 이후 클라이언트에서 `signOut()` 필요 |
| POST | `/api/users/me/artist-application` `{ artistName, artistBio?, artistPortfolioUrl? }` | 아티스트 인증 신청 → `artistStatus=PENDING` (201) |

`role ∈ USER \| ARTIST \| ADMIN`, `status ∈ ACTIVE \| SUSPENDED`, `artistStatus ∈ NONE \| PENDING \| APPROVED \| REJECTED`. 정지된 계정은 모든 쓰기 API에서 403.

## Exhibition (공개)

| Method | Endpoint | 응답 |
| --- | --- | --- |
| GET | `/api/exhibitions` | `{ exhibitions: Exhibition[] }` (데모용) |
| GET | `/api/exhibitions/{id}` | `{ exhibition }` — 404 if 없음/비활성. `themeBg/themeFg/themeAccent/themeFont` 포함(전시별 색상·서체) |
| GET | `/api/exhibitions/{id}/guide` | `{ exhibitionId, sentences: GuideSentence[], sections: { section, sentences[] }[] }` |
| GET | `/api/exhibitions/{id}/audio` | `{ mode: "EXTERNAL_PLAYLIST" \| "AMBIENCE", externalPlaylist: { provider, url, title, description } \| null, ambience: { enabled, type } }` — 우선순위 로직 적용됨 |
| GET | `/api/exhibitions/{id}/qr` | SVG QR (`?format=png` → PNG). `/e/<slug>` 주소를 인코딩. 초안도 발급 가능 |
| GET | `/api/exhibitions/{id}/like` | `{ count, liked }` (게스트는 liked=false) |
| POST / DELETE | `/api/exhibitions/{id}/like` | 좋아요 / 취소 (로그인, 멱등) |
| GET | `/api/exhibitions/{id}/reports` | `{ reported }` — 내가 올린 미처리 신고가 있는지 |
| POST | `/api/exhibitions/{id}/reports` `{ reason: INAPPROPRIATE\|COPYRIGHT\|SPAM\|OTHER, detail? }` | 신고 (201 / 이미 있으면 200). 본인 전시는 422 |

공개 조회(`/api/exhibitions/*`, `/e/<slug>`)는 **ACTIVE이고 소유 아티스트가 정지되지 않은** 전시만 반환합니다. 초안/숨김 전시는 소유자·관리자에게만 `/e/<slug>` 미리보기로 열립니다.

## Archive (로그인 필요)

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/archives` | `{ archives: [{ id, exhibition, firstVisitedAt, lastVisitedAt, scrapCount, hasJournal, keepsakeCount }], count }` — 최근 방문순 |
| POST | `/api/archives` `{ exhibitionId }` | 생성(201) 또는 기존 반환(200, `last_visited_at` 갱신). `{ archive, created }` |
| GET | `/api/archives/{id}` | `{ archive: { …, exhibition, scraps[], journal \| null, keepsakes[] } }` |
| DELETE | `/api/archives/{id}` | 연쇄 삭제 → 204 |

## Scrap

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/archives/{id}/scraps` | `{ scraps: Scrap[] }` |
| POST | `/api/archives/{id}/scraps` `{ guideSentenceId }` | 201 저장 / 200 이미 저장됨(멱등). `{ scrap, created }`. 다른 전시 문장이면 422 |
| DELETE | `/api/archives/{id}/scraps/{scrapId}` | 저장 해제 → 204 |

## Journal

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/archives/{id}/journal` | `{ journal: Journal \| null }` |
| PUT | `/api/archives/{id}/journal` `{ content, audioType }` | upsert. 201 생성 / 200 수정(같은 id 유지). `audioType ∈ EXTERNAL_PLAYLIST \| AMBIENCE \| NONE` |

## Digital Keepsake

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/archives/{id}/keepsakes` | `{ keepsakes: Keepsake[] }` |
| POST | `/api/archives/{id}/keepsakes` `{ templateId, content }` | **전시당 1장**: 없으면 201 생성, 있으면 200 교체(`replaced: true`). `templateId ∈ sentence \| reflection \| cover`, `content`는 아래 `KeepsakeContent`. `content.theme`은 서버가 정규화해 카드에 고정 |
| GET | `/api/keepsakes/{id}` | `{ keepsake }` |
| PUT | `/api/keepsakes/{id}` `{ templateId?, content? }` | 수정 |
| DELETE | `/api/keepsakes/{id}` | 삭제 → 204 |

```ts
type KeepsakeContent = {
  theme?: { bg: "#RRGGBB"; fg: "#RRGGBB"; accent: "#RRGGBB"; font: "sans" | "serif" | "display" };
  exhibitionTitle: string;
  exhibitionSubtitle?: string | null;
  venue?: string | null;
  periodLabel?: string | null;      // "2026.10.10 – 2026.12.28"
  savedDateLabel: string;           // "2026.11.02"
  coverImageUrl?: string | null;
  sentence?: string | null;         // ≤ 300자
  journalExcerpt?: string | null;   // ≤ 240자
};
```

PNG 내보내기는 서버 엔드포인트가 아니라 클라이언트(`src/lib/client/export-png.ts`)에서 수행합니다.

## Artist Studio (승인된 아티스트 또는 관리자)

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/artist/exhibitions` | 내 전시 목록 (`likeCount`, `openReportCount`, `archiveCount` 포함) |
| POST | `/api/artist/exhibitions` | 초안 생성. body: `{ title, subtitle?, venue?, startDate?, endDate?, description?, coverImageUrl?, guide?: [{ section, sentences: string[] }], audio?: { provider: NONE\|SPOTIFY\|APPLE_MUSIC, playlistUrl?, playlistTitle?, playlistDescription?, ambienceEnabled? }, theme?: { bg, fg, accent: "#RRGGBB", font: sans\|serif\|display } }` |
| GET | `/api/artist/exhibitions/{id}` | 편집용 전체 데이터 `{ exhibition, theme, guide, audio }` (소유자/관리자) |
| PUT | `/api/artist/exhibitions/{id}` | 부분 수정 (POST와 같은 body). `guide`를 보내면 전체 교체하되 문장 내용이 같으면 id 유지 → 방문자 Scrap 연결 보존 |
| POST | `/api/artist/exhibitions/{id}/status` `{ status: ACTIVE\|DRAFT }` | 공개 / 비공개. 공개하려면 해설 문장 1개 이상. HIDDEN은 소유자가 못 풂 |
| DELETE | `/api/artist/exhibitions/{id}` | 소프트 삭제 (`status=DELETED`) |
| POST | `/api/images` (multipart `file`, jpeg/png/webp ≤ 3MB) | 이미지 업로드 → `{ id, url, storage: "r2" \| "db" }`. R2가 설정돼 있으면 버킷에 올리고 `url`은 `MEDIA_BASE_URL/covers/…` 공개 주소, 아니면 DB(`bytea`)에 저장하고 `url: /api/images/{id}` |
| GET | `/api/images/{id}` | DB 저장 이미지 서빙 (공개, 캐시 1년) |

## Admin (ADMIN 전용, 아니면 403)

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/admin/stats` | `{ users, pendingArtists, exhibitions, activeExhibitions, openReports, suspendedUsers }` |
| GET | `/api/admin/users?q=&filter=pending\|artists\|admins\|suspended` | 사용자 목록 |
| GET | `/api/admin/users/{id}` | 사용자 + 그의 전시 |
| PATCH | `/api/admin/users/{id}` | `{ artistDecision: APPROVE\|REJECT, note? }` / `{ role }` / `{ status: ACTIVE\|SUSPENDED, reason? }` (자기 자신 강등·정지 불가) |
| DELETE | `/api/admin/users/{id}` | 계정 + 개인 기록 삭제 (그가 만든 전시는 소유자 없음으로 유지) |
| GET | `/api/admin/exhibitions?q=&status=&reported=1` | 전체 전시 (소유자·좋아요·신고·방문자 수 포함) |
| PATCH | `/api/admin/exhibitions/{id}` `{ status }` | DRAFT / ACTIVE / HIDDEN / DELETED |
| DELETE | `/api/admin/exhibitions/{id}` | **완전 삭제** (방문자 Archive도 FK cascade로 삭제) |
| GET | `/api/admin/reports?status=OPEN\|RESOLVED\|DISMISSED` | 신고 목록 |
| PATCH | `/api/admin/reports/{id}` `{ status: RESOLVED\|DISMISSED, action?: NONE\|HIDE_EXHIBITION\|SUSPEND_ARTIST, note? }` | 처리. SUSPEND_ARTIST는 전시 숨김 + 소유자 정지. 같은 전시의 다른 OPEN 신고도 같이 종료 |

## 데이터 모델 요약

```
users ─1:N─ archives ─1:N─ scraps        (UNIQUE archive_id + guide_sentence_id)
      │              ├─1:0..1─ journals  (UNIQUE archive_id)
      │              └─1:N─ digital_keepsakes
      ├─1:N─ exhibitions (owner_id, NULL = 공식 콘텐츠) ─1:N─ guide_sentences
      │                                                  ├─1:1─ audio_configurations
      │                                                  ├─1:N─ exhibition_likes   (UNIQUE exhibition_id + user_id)
      │                                                  └─1:N─ exhibition_reports (reporter_id, status, action)
      └─1:N─ images (업로드 바이트를 bytea로 저장)
archives: UNIQUE (user_id, exhibition_id); 모든 자식 테이블은 ON DELETE CASCADE
users.role / status / artist_status, exhibitions.status (DRAFT·ACTIVE·HIDDEN·DELETED)
```

전체 정의: `src/db/schema.ts`
