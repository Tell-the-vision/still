# 스펙 대조 점검 (PRD §14 Acceptance Criteria · 개발 명세 §17 Definition of Done)

마지막 점검: 2026-11-02 · 자동화 테스트(Playwright, 68개 체크) + 수동 확인 기준.
✅ 구현·검증 완료 / 🟡 구현됐으나 실기기 확인 필요 / ⬜ UI 담당자 몫 / ❌ 미구현

## Entry
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| Home에서 Login 및 QR Scan 선택 | ✅ | `/` |
| QR 코드로 전시 페이지 진입 | 🟡 | 디코딩(BarcodeDetector→jsQR)·검증·이동 구현. 카메라는 HTTPS 또는 localhost에서만 동작 → 휴대폰 실기기 테스트는 ngrok 등 HTTPS 필요 |
| URL 직접 진입 | ✅ | `/e/<slug>`, Home·Scan 화면의 URL 입력 |
| 비로그인 전시 가이드 열람 | ✅ | |

## Authentication
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| Google OAuth 정상 작동 | 🟡 | Auth.js Google provider. 팀 Google Cloud OAuth 클라이언트 발급 후 `.env` 설정 필요. 그 전엔 Dev Login으로 동일 흐름 검증됨 |
| 로그인 후 원래 저장 액션으로 복귀 | ✅ | Scrap·Journal·Keepsake·좋아요·신고 모두 자동 재개 (`pending-action.ts`) |
| 작성 중 임시 데이터 유실 없음 | ✅ | Journal → localStorage, Keepsake → sessionStorage |

## Archive
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| 로그인 사용자 전시 진입 시 Archive 생성 | ✅ | `POST /api/archives` (가이드 진입 시 자동) |
| 동일 전시 Archive 중복 생성 방지 | ✅ | UNIQUE(user_id, exhibition_id) + 경합 시 기존 반환 |
| 재방문 시 Last Visited 갱신 | ✅ | |

## Scrap
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| 해설 문장에 Scrap 액션 표시 | ✅ | |
| 로그인 사용자 저장 | ✅ | |
| 저장 문장 → 해당 Archive 연결 | ✅ | 스냅샷 보존, 가이드 수정 시에도 id 유지 |
| Archive Detail에서 재확인 | ✅ | |
| 동일 문장 중복 저장 방지 | ✅ | UNIQUE + 멱등 API(200) |

## Journal
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| 전시당 Journal 1개 | ✅ | UNIQUE(archive_id) |
| 기존 Journal 불러오기 / 수정 / 동일 레코드 갱신 | ✅ | `PUT` upsert, 같은 id 유지 확인 |
| 저장 실패 시 입력 내용 유지 | ✅ | |
| 이탈 확인(미저장 변경) | ✅ | 새로고침/닫기 + 앱 내 링크 이동 모두 확인창 |
| 두 기기 동시 수정 충돌 | 🟡 | 마지막 저장이 이김(last-write-wins). 명세 §16.4 "검토" 항목 — 필요 시 updatedAt 비교로 충돌 경고 추가 가능 |

## Audio
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| External Playlist 정보 표시, Apple Music / Spotify 이동 | ✅ | 샘플 전시 2개 (각각 Spotify / Apple Music) |
| Playlist 없을 때 Pink Noise 옵션 | ✅ | 샘플 전시 `traces-of-light` |
| Pink Noise 기본 Off / On 재생 / Off 중지 | ✅ | Web Audio 합성, 사용자 제스처로만 시작 |
| No Audio 선택 | ✅ | |
| 재생 오류 안내 | ✅ | 미지원 브라우저·autoplay 차단 시 Retry 안내 |

## Digital Keepsake
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| 템플릿 선택 | ✅ | Sentence / Reflection / Cover |
| 전시 정보·개인 기록 반영 | ✅ | |
| 웹카드 저장 / 재열람 | ✅ | 스냅샷으로 고정 |
| PNG 다운로드, 웹카드와 레이아웃 일치 | ✅ | 1080×1440, 동일 컴포넌트 래스터라이즈. iOS Safari에서 다운로드 동작은 실기기 확인 권장 |

## Management
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| Archive 삭제 + Scrap/Journal/Keepsake 연쇄 삭제 | ✅ | 트랜잭션 |
| Logout | ✅ | |
| Account Deletion (ACCOUNT-03) | ✅ | TBD-08: 전부 삭제로 결정 |

## UI (PRD §3.2) — UI 담당자 몫
| 기준 | 상태 | 비고 |
| --- | --- | --- |
| 순수 화이트 배경, 블랙/화이트 UI, 그레이는 텍스트만 | ⬜ | 토큰은 `globals.css`에 규칙대로 선언됨. 세부 레이아웃·타이포 디테일은 Figma 기준으로 작업 필요 |
| 모바일 주요 화면 정상 표시 | 🟡 | 390px 프레임에서 스크린샷 확인. 실기기(iOS Safari / Android Chrome) QA 필요 |

## 명세 §13 Global Error Handling
| 오류 | 상태 |
| --- | --- |
| OAuth 취소/실패 → 복귀·재시도 안내 | ✅ (`/login?error=…`) |
| QR 인식 실패 → 다시 스캔 / 잘못된 QR → 안내 | ✅ |
| 전시 없음 → 404 안내 | ✅ |
| Scrap 중복 → Saved 유지 / 실패 → Retry | ✅ |
| Journal 실패 → 내용 유지 | ✅ |
| 외부 링크 오류 / Pink Noise 실패 안내 | ✅ |
| Keepsake 저장·PNG 실패 → Retry | ✅ |
| Archive 삭제 실패 → 삭제되지 않았음 안내 | ✅ |

## 명세 §15 Analytics
모든 권장 이벤트를 `track()`으로 발행(dataLayer). 추가: `exhibition_like/unlike/report`, `artist_*`. 본문·이메일 미포함 ✅

## 명세에 없는 추가 구현 (2차 요청)
- 역할: Guest / USER / ARTIST / ADMIN, 로그인 화면에서 계정 유형 선택, 아티스트 인증 신청 → 관리자 승인
- Artist Studio: 전시 등록·수정·공개/비공개·소프트 삭제, 해설 가이드 편집, 대표 이미지 업로드, 오디오 설정, QR 발급
- 전시 좋아요 / 신고, 관리자 신고 처리(전시 숨김 · 아티스트 정지 · 기각)
- Admin 콘솔: 통계, 사용자(승인/역할/정지/삭제), 전시(상태 변경/완전 삭제), 신고

## 총괄(김보겸) 채팅 결정 사항 대조 (2026-11-02 대화 기준)

| 김보겸 발언 | 구현 상태 | 비고 |
| --- | --- | --- |
| "처음에 생각했던 건 모바일 앱" (일영: MVP는 웹, 최종에 따라 스택 변경 가능) | 🟡 웹(MVP) + 설치형 | PRD대로 모바일 퍼스트 웹. `manifest.webmanifest` 추가로 "홈 화면에 추가"하면 앱처럼 실행. 네이티브 앱은 같은 REST API(docs/API.md)를 그대로 쓰면 됨 |
| "Keepsake는 전시 1개당 1개" / "전시 1개당 기념 이미지 1개 생성" | ✅ 수정 반영 | `digital_keepsakes.archive_id` UNIQUE. 다시 저장하면 기존 카드를 **교체**(API 200 `replaced: true`), Archive Detail에 카드 1장만 표시 |
| "템플릿은 정해져 있고 전시에 따라서 색상이나 타이포가 바뀌는 형식" | ✅ 구현 | 전시마다 `theme`(배경·글자·포인트 색, 서체 sans/serif/display). Keepsake 3종 템플릿에 적용되고 저장 시 카드에 고정. 가이드 화면에는 제목 서체·포인트 라인 + `--ex-*` CSS 변수로 노출(UI 작업용). 아티스트 에디터에 프리셋 4종 + 색상 입력 |
| "생성은 저희가 하는 게 아니라 이미 있는 거" / 일영 "이미지 모델 생성은 최종에" → "그렇게 가는 게 좋을 것" | ✅ MVP 범위대로 | 템플릿 기반. AI 이미지 생성은 미구현(최종 단계 과제). `content_data`가 JSON이라 생성 이미지 URL을 넣는 확장은 스키마 변경 없이 가능 |
| Audio: external → 기관의 Apple Music/Spotify 링크 연결, pink noise → 앱/웹 내 자체 생성 + on/off | ✅ | 링크는 새 탭으로 열려 STILL로 돌아와 계속 사용 가능("링크로 연결된 후에 앱으로 다시 돌아와서" ✓). Pink Noise는 Web Audio 합성, 기본 Off |
| "아트홀이나 기관 단위는 생각하지 않고 전시 단위로만" | ✅ | 기관 엔티티 없음. 전시가 최상위 단위이고, 소유자(아티스트/기획자)는 전시에 붙는 속성 |
| "콘텐츠 입력 우선은 개발자/운영자, 이후 기관·전시 기획자가 직접 입력" | ✅ 두 단계 모두 | 1단계: `seed.ts` + 관리자 콘솔(`/admin/exhibitions` → 편집). 2단계: Artist Studio(`/artist`)가 바로 "기관/기획자 직접 입력" 경로. 로그인 라벨을 "아티스트 · 전시 기획자"로 바꿔 둠 |

## 아직 안 된 것 / 알려진 제한
- 실기기 QA (카메라 QR, iOS PNG 다운로드, 오디오 autoplay 정책) — HTTPS 환경에서 팀이 직접 확인 필요
- Google OAuth 클라이언트 발급 (팀 계정)
- UI 디자인 적용 (Figma)
- 관리자 CMS 수준의 전시 콘텐츠 관리(이미지 다중 업로드, 작품 단위 모델)는 범위 밖 — 현재는 전시 단위 + 섹션/문장
- Keepsake AI 이미지 생성(최종 단계 아이디어) — 미구현
- 네이티브 모바일 앱 — 미구현(웹 + 홈 화면 설치로 대체). API는 그대로 재사용 가능
