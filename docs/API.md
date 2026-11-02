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
| GET | `/api/users/me` | `{ user: { id, email, displayName, image, createdAt } \| null }` |
| DELETE | `/api/users/me` | 계정 + 모든 기록 삭제 → 204. 이후 클라이언트에서 `signOut()` 필요 |

## Exhibition (공개)

| Method | Endpoint | 응답 |
| --- | --- | --- |
| GET | `/api/exhibitions` | `{ exhibitions: Exhibition[] }` (데모용) |
| GET | `/api/exhibitions/{id}` | `{ exhibition }` — 404 if 없음/비활성 |
| GET | `/api/exhibitions/{id}/guide` | `{ exhibitionId, sentences: GuideSentence[], sections: { section, sentences[] }[] }` |
| GET | `/api/exhibitions/{id}/audio` | `{ mode: "EXTERNAL_PLAYLIST" \| "AMBIENCE", externalPlaylist: { provider, url, title, description } \| null, ambience: { enabled, type } }` — 우선순위 로직 적용됨 |
| GET | `/api/exhibitions/{id}/qr` | SVG QR (`?format=png` → PNG). `/e/<slug>` 주소를 인코딩 |

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
| POST | `/api/archives/{id}/keepsakes` `{ templateId, content }` | 201. `templateId ∈ sentence \| reflection \| cover`, `content`는 아래 `KeepsakeContent` |
| GET | `/api/keepsakes/{id}` | `{ keepsake }` |
| PUT | `/api/keepsakes/{id}` `{ templateId?, content? }` | 수정 |
| DELETE | `/api/keepsakes/{id}` | 삭제 → 204 |

```ts
type KeepsakeContent = {
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

## 데이터 모델 요약

```
users ─1:N─ archives ─1:N─ scraps        (UNIQUE archive_id + guide_sentence_id)
                     ├─1:0..1─ journals  (UNIQUE archive_id)
                     └─1:N─ digital_keepsakes
exhibitions ─1:N─ guide_sentences
            └─1:1─ audio_configurations
archives: UNIQUE (user_id, exhibition_id); 모든 자식 테이블은 ON DELETE CASCADE
```

전체 정의: `src/db/schema.ts`
