# Developer Functional Specification

# STILL

## Developer Functional Specification

**Version:** 1.0

**Based on:** PRD MVP v1.1

**Platform:** Mobile-first Web Application

**Design Reference:** STILL Figma Design

**Brand:** Art stays with you.

---

# 0. Development Overview

## 0.1 Core Product Rules

개발 시 반드시 지켜야 하는 핵심 정책이다.

| ID | Policy | Requirement |
| --- | --- | --- |
| CORE-01 | Guest Access | 비로그인 사용자도 전시 가이드를 열람할 수 있다. |
| CORE-02 | Authentication | 개인 기록 저장 시 Google 로그인이 필요하다. |
| CORE-03 | Archive | 사용자와 전시 조합당 Archive는 하나만 생성한다. |
| CORE-04 | Journal | Archive 하나당 Journal은 최대 하나만 존재한다. |
| CORE-05 | Scrap | 전시 해설 가이드에 등록된 문장만 Scrap할 수 있다. |
| CORE-06 | Audio | 기관 제공 플레이리스트가 없으면 Pink Noise를 제공한다. |
| CORE-07 | Audio Default | Pink Noise는 자동 재생하지 않고 기본 Off로 설정한다. |
| CORE-08 | Keepsake | Digital Keepsake은 웹카드로 저장하고 PNG로 다운로드할 수 있다. |
| CORE-09 | Deletion | Archive 삭제 시 연결된 개인 기록도 함께 삭제한다. |
| CORE-10 | UI | 화이트 배경, 블랙/화이트 UI, 텍스트에 한해 그레이를 사용한다. |

## 0.2 User Types

### Guest

- 전시 QR 및 URL 진입 가능
- 전시 가이드 열람 가능
- 해설 가이드 문장 확인 가능
- 개인 기록 저장 불가
- 저장 액션 선택 시 로그인 유도

### Authenticated User

- Google OAuth 인증 완료
- Archive 생성 및 열람
- Scrap 저장 및 삭제
- Journal 작성 및 수정
- Audio 선택 및 재생
- Digital Keepsake 저장 및 PNG 다운로드
- Archive 삭제

## 0.3 Global Access Rules

| Feature | Guest | Logged In |
| --- | --- | --- |
| Home | O | O |
| QR Scan | O | O |
| Exhibition Guide | O | O |
| Scrap 저장 | X | O |
| Journal 작성/수정 | X | O |
| External Playlist 이동 | O | O |
| Pink Noise 재생 | O | O |
| Keepsake 저장 | X | O |
| Keepsake PNG 다운로드 | 저장된 카드 기준 | O |
| My Archive | X | O |
| Archive Detail | X | O |
| Account | X | O |

---

# 1. Screen 01 — Home / Logged Out

## 1.1 Purpose

STILL 서비스의 첫 진입 화면이다. 사용자는 로그인하거나 QR Scan을 통해 전시로 진입한다.

## 1.2 UI Elements

- STILL Wordmark
- Login
- QR Scan

## 1.3 Functional Requirements

### HOME-01 Login

1. 사용자가 Login을 선택한다.
2. Google OAuth 인증 화면으로 이동한다.
3. 인증 성공 시 로그인 사용자 Home으로 이동한다.
4. 인증 실패 또는 취소 시 기존 Home으로 돌아온다.

### HOME-02 QR Scan

1. 사용자가 QR Scan을 선택한다.
2. 카메라 권한을 확인한다.
3. 권한이 있으면 QR Scanner를 실행한다.
4. QR 코드를 인식하면 연결된 전시 URL로 이동한다.

### HOME-03 Direct URL

- 사용자가 외부에서 전달받은 전시 URL로 직접 접속할 수 있어야 한다.
- QR 진입과 동일한 Exhibition Guide를 표시해야 한다.

## 1.4 Error States

| Condition | Expected Behavior |
| --- | --- |
| 카메라 권한 거부 | 권한 안내 및 URL 직접 진입 제공 |
| QR 인식 실패 | 다시 스캔할 수 있도록 안내 |
| 잘못된 QR | 유효한 전시가 아니라는 안내 |
| Google 로그인 취소 | Home으로 복귀 |
| OAuth 실패 | 오류 안내 및 재시도 제공 |

## 1.5 Acceptance Criteria

- 
    
    Guest 상태에서 Home 진입 가능
    
- 
    
    Login 선택 시 Google OAuth 실행
    
- 
    
    QR Scan 선택 시 카메라 권한 확인
    
- 
    
    QR 인식 후 해당 전시로 이동
    
- 
    
    직접 URL 진입 가능
    

---

# 2. Screen 02 — Home / Logged In

## 2.1 Purpose

로그인 사용자가 개인 Archive와 전시 콘텐츠에 접근하는 화면이다.

## 2.2 UI Elements

- STILL Wordmark
- My Archive
- 전시 진입 영역
- Archive 요약
- 하단 Navigation

## 2.3 Functional Requirements

### HOME-04 User Session

- 유효한 로그인 세션을 확인한다.
- 로그인 사용자 정보를 표시한다.

### HOME-05 My Archive

- My Archive 선택 시 Archive Grid로 이동한다.
- 사용자의 Archive 개수를 조회한다.

### HOME-06 Exhibition Entry

- 전시 QR 또는 전시 링크로 진입할 수 있다.
- 이미 Archive가 있는 전시라면 기존 Archive를 재사용한다.

## 2.4 Acceptance Criteria

- [ ]  로그인 사용자 정보 확인
- [ ]  Archive 개수 표시
- [ ]  My Archive 이동
- [ ]  전시 진입 가능

---

# 3. Screen 03 — QR Scanner

## 3.1 Purpose

전시장 QR 코드를 인식해 해당 Exhibition Guide로 연결한다.

## 3.2 Functional Requirements

### QR-01 Camera Permission

- 카메라 권한을 요청한다.
- 권한 허용 후 스캔 화면을 활성화한다.
- 권한 거부 시 URL 직접 입력을 제공한다.

### QR-02 QR Recognition

- QR 코드를 인식한다.
- QR에 연결된 전시 식별자 또는 URL을 추출한다.
- 유효한 전시인지 확인한다.
- 유효하면 Exhibition Guide로 이동한다.

### QR-03 URL Input

- 사용자가 전시 URL을 직접 입력할 수 있다.
- 입력 URL의 형식 및 전시 존재 여부를 검증한다.

## 3.3 Validation

- 빈 URL 입력 불가
- 지원하지 않는 URL 형식 차단
- 존재하지 않는 Exhibition ID 차단
- 비활성 또는 접근 불가 전시 처리

## 3.4 Acceptance Criteria

- [ ]  카메라 권한 허용 시 스캔 가능
- [ ]  QR 인식 후 전시 이동
- [ ]  카메라 권한 거부 시 URL 진입 가능
- [ ]  유효하지 않은 전시 URL에 오류 안내

---

# 4. Screen 04 — Exhibition Guide

## 4.1 Purpose

전시 정보 및 해설 가이드를 제공하는 핵심 콘텐츠 화면이다.

## 4.2 Content Structure

- Exhibition Title
- Venue
- Exhibition Period
- Cover Image
- Exhibition Description
- Commentary Guide
- Scrap Actions
- Audio Entry (정책에 따른 노출)

## 4.3 Functional Requirements

### GUIDE-01 Exhibition Data

- 전시 ID를 기준으로 전시 정보를 조회한다.
- 전시명, 장소, 기간, 설명, 이미지 등을 표시한다.
- 로그인 여부와 관계없이 열람할 수 있다.

### GUIDE-02 Commentary Guide

- 전시 기관이 제공한 해설 콘텐츠를 표시한다.
- 해설 콘텐츠 내 문장별 고유 ID를 유지한다.
- Scrap 가능한 문장에는 저장 액션을 제공한다.

### GUIDE-03 Scrap Action

1. 사용자가 특정 문장의 Scrap 액션을 선택한다.
2. 로그인 여부를 확인한다.
3. Guest라면 Google OAuth를 실행한다.
4. 로그인 완료 후 선택한 문장으로 복귀한다.
5. 해당 문장을 사용자의 Archive에 저장한다.
6. 저장 완료 상태를 UI에 반영한다.

### GUIDE-04 Existing Scrap

- 이미 저장한 문장은 저장 완료 상태로 표시한다.
- 저장 상태를 서버 데이터와 동기화한다.
- 중복 저장 요청은 서버에서 방지한다.

## 4.4 Scrap Interaction States

| State | UI |
| --- | --- |
| Not Saved | Save this sentence |
| Saving | Loading |
| Saved | Saved |
| Already Saved | Saved 상태 유지 |
| Save Failed | Retry 안내 |
| Guest | Login Required |

## 4.5 Data Requirements

Scrap 저장 시 다음 값을 사용한다.

- archive_id
- guide_sentence_id
- sentence_content_snapshot

원본 해설 문장이 추후 변경되더라도 사용자가 저장한 문장은 당시의 내용으로 보존한다.

## 4.6 Acceptance Criteria

- [ ]  Guest도 해설 가이드 열람 가능
- [ ]  해설 가이드 문장별 Scrap 액션 표시
- [ ]  Guest 저장 시 로그인 유도
- [ ]  로그인 완료 후 기존 문장으로 복귀
- [ ]  저장한 문장은 Saved 상태로 표시
- [ ]  동일 문장의 중복 저장 방지

---

# 5. Screen 05 — Journal

## 5.1 Purpose

사용자가 전시 경험에 대한 개인적인 생각과 감정을 기록하는 화면이다.

## 5.2 Core Policy

**전시 하나당 Journal 하나만 생성할 수 있다.**

Archive에 Journal이 존재하지 않으면 신규 작성 화면을 표시한다.

이미 Journal이 존재하면 기존 내용을 불러오고 수정할 수 있도록 한다.

별도의 Journal을 추가 생성하는 기능은 제공하지 않는다.

## 5.3 UI Elements

- Exhibition Title
- Journal Text Area
- Audio Options
- Save Journal Button

## 5.4 Functional Requirements

### JOURNAL-01 Initial Entry

1. 사용자가 Journal을 선택한다.
2. 로그인 여부를 확인한다.
3. Guest라면 Google OAuth를 실행한다.
4. 로그인 후 해당 Archive의 Journal을 조회한다.
5. Journal이 없으면 빈 입력 화면을 표시한다.
6. Journal이 있으면 기존 내용을 불러온다.

### JOURNAL-02 Create

- 사용자가 텍스트를 입력한다.
- Save Journal을 선택한다.
- 서버에 Journal을 생성한다.
- 해당 Archive ID와 연결한다.

### JOURNAL-03 Update

- 기존 Journal이 존재하면 해당 내용을 불러온다.
- 사용자가 기존 텍스트를 수정한다.
- Save Journal을 선택하면 기존 레코드를 업데이트한다.
- 새로운 Journal 레코드를 생성하지 않는다.
- updated_at을 갱신한다.

### JOURNAL-04 One Journal Constraint

- Archive ID는 Journal 테이블에서 UNIQUE여야 한다.
- 동시 저장 요청이 발생해도 중복 Journal이 생성되지 않아야 한다.
- 서버에서 중복 생성 요청을 차단해야 한다.

### JOURNAL-05 Draft Handling

- 사용자가 작성 중 화면을 벗어날 때 미저장 변경사항이 있으면 이탈 확인을 제공한다.
- 로그인 과정에서 작성 중인 내용이 유실되지 않도록 임시 보존한다.
- 저장 성공 여부를 명확히 표시한다.

## 5.5 Journal States

| State | Behavior |
| --- | --- |
| Empty | 빈 Journal 작성 |
| Existing | 저장된 Journal 불러오기 |
| Editing | 내용 수정 가능 |
| Saving | 저장 중 입력 중복 방지 |
| Saved | 저장 완료 |
| Error | 오류 안내 및 재시도 |

## 5.6 Validation

- 빈 내용 저장 정책은 구현 전 확정 필요
- 최대 글자 수는 구현 전 확정 필요
- 저장 중 중복 클릭 방지
- 저장 실패 시 입력 내용 유지

## 5.7 Acceptance Criteria

- [ ]  Archive당 Journal 최대 1개
- [ ]  최초 저장 시 Journal 생성
- [ ]  재진입 시 기존 Journal 조회
- [ ]  기존 Journal 수정 가능
- [ ]  수정 시 동일 journal_id 유지
- [ ]  중복 Journal 생성 방지
- [ ]  저장 실패 시 입력 내용 보존

---

# 6. Audio Functional Specification

## 6.1 Purpose

전시 기관이 제공하는 플레이리스트 또는 STILL Ambience를 통해 감상 환경을 제공한다.

## 6.2 Audio Types

### Type A — External Playlist

전시 기획사 또는 전시 기관이 제공한 플레이리스트다.

지원 서비스:

- Apple Music
- Spotify

### Type B — STILL Ambience

전시 기관이 별도 플레이리스트를 제공하지 않는 경우 제공하는 Pink Noise 기반 사운드다.

사용자가 On / Off를 직접 제어한다.

### Type C — No Audio

사용자가 소리를 듣지 않도록 선택하는 상태다.

## 6.3 Audio Selection Logic

```
Exhibition Audio Configuration
          |
          v
External Playlist Exists?
      /           \
    Yes            No
     |              |
     v              v
External        STILL Ambience
Playlist        Pink Noise
     |              |
Apple Music /    User On / Off
Spotify Link          |
     |                v
External App       No Audio
```

No Audio는 사용자가 언제든 선택할 수 있는 옵션이다.

## 6.4 AUDIO-01 External Playlist

- 전시별 플레이리스트 제공 여부를 확인한다.
- provider가 Apple Music이면 Apple Music 링크를 제공한다.
- provider가 Spotify이면 Spotify 링크를 제공한다.
- 사용자가 선택하면 해당 앱 또는 웹으로 이동한다.
- 링크가 잘못되었거나 연결할 수 없으면 오류 안내를 제공한다.

### External Playlist Data

- audio_provider
- playlist_url
- playlist_title
- playlist_description (optional)

### Important

STILL은 외부 플레이리스트의 재생을 직접 제어하지 않는다.

Apple Music 또는 Spotify의 실제 재생은 해당 외부 서비스에서 처리한다.

## 6.5 AUDIO-02 STILL Ambience

- External Playlist가 없는 경우 Pink Noise 옵션을 제공한다.
- 사용자가 On을 선택하면 Pink Noise를 재생한다.
- 사용자가 Off를 선택하면 즉시 재생을 중지한다.
- 최초 진입 상태는 Off다.
- 사용자 동의 없이 자동 재생하지 않는다.

### Audio State

| State | Behavior |
| --- | --- |
| OFF | 재생 중지 |
| ON | Pink Noise 재생 |
| ERROR | 재생 실패 안내 |

### Technical Requirements

- 오디오 파일 또는 생성된 오디오 스트림을 제공한다.
- 재생 및 중지 상태를 관리한다.
- 브라우저의 Audio Autoplay 제한을 고려한다.
- 반복 재생 시 끊김이 없도록 처리한다.
- 화면 이동 시 재생 유지 여부는 제품 정책 확정 후 구현한다.

## 6.6 AUDIO-03 No Audio

- 사용자가 No Audio를 선택하면 STILL Ambience 재생을 중지한다.
- External Playlist 링크는 별도의 외부 앱 동작이므로 내부에서 재생 중지 명령을 보낼 수 없다는 점을 구분한다.

## 6.7 Audio Acceptance Criteria

- [ ]  전시별 External Playlist 정보 조회
- [ ]  Apple Music 링크 이동
- [ ]  Spotify 링크 이동
- [ ]  Playlist가 없을 때 Pink Noise 옵션 노출
- [ ]  Pink Noise 기본 Off
- [ ]  On 선택 시 재생
- [ ]  Off 선택 시 중지
- [ ]  No Audio 선택 가능
- [ ]  재생 오류 시 안내

---

# 7. Screen 06 — Digital Keepsake

## 7.1 Purpose

전시 경험을 웹카드 형태로 보관하고 PNG 이미지로 다운로드할 수 있도록 한다.

## 7.2 Core Policy

Digital Keepsake은 이미지 생성 기능이 아니라 템플릿 기반 웹카드다.

저장된 웹카드는 STILL 웹 또는 앱 내에서 다시 열람할 수 있다.

동일한 카드 디자인을 PNG 파일로 다운로드할 수 있다.

## 7.3 UI Elements

- Keepsake Preview
- Template Selection
- Save Web Card
- Download PNG

## 7.4 Functional Requirements

### KEEPSAKE-01 Create

1. 사용자가 Archive Detail에서 Digital Keepsake을 선택한다.
2. 템플릿 목록을 확인한다.
3. 템플릿을 선택한다.
4. 전시 정보와 개인 기록이 반영된 미리보기를 확인한다.
5. Save Web Card를 선택한다.
6. 웹카드 데이터를 저장한다.

### KEEPSAKE-02 Content Binding

웹카드에 사용할 수 있는 콘텐츠:

- STILL Wordmark
- Exhibition Title
- Exhibition Date
- Venue
- Artwork Image
- Scrap Sentence
- Journal Excerpt

실제 포함 항목은 템플릿별로 정의한다.

### KEEPSAKE-03 Web Card Storage

- 저장된 웹카드는 archive_id와 연결한다.
- 사용자가 Archive Detail에서 다시 열람할 수 있어야 한다.
- 저장된 웹카드의 레이아웃과 콘텐츠를 유지한다.

### KEEPSAKE-04 PNG Download

1. 사용자가 저장된 웹카드를 연다.
2. Download PNG를 선택한다.
3. 카드 콘텐츠를 이미지로 렌더링한다.
4. PNG 파일을 생성한다.
5. 사용자의 기기에 다운로드한다.

### KEEPSAKE-05 PNG Requirements

- 카드 비율 유지
- 텍스트 잘림 방지
- 이미지 비율 유지
- 폰트 정상 렌더링
- 흰색 및 검정색 디자인 유지
- 저장된 콘텐츠와 PNG 콘텐츠 일치

## 7.5 Keepsake States

| State | Behavior |
| --- | --- |
| Not Created | 템플릿 선택 화면 |
| Editing | 미리보기 및 템플릿 변경 |
| Saving | 저장 중 |
| Saved | 웹카드 보관 |
| Exporting | PNG 생성 중 |
| Exported | 다운로드 완료 |
| Error | 저장 또는 다운로드 재시도 |

## 7.6 Acceptance Criteria

- [ ]  템플릿 선택 가능
- [ ]  전시 정보 반영
- [ ]  개인 기록 반영
- [ ]  웹카드 저장 가능
- [ ]  저장한 웹카드 재열람 가능
- [ ]  PNG 다운로드 가능
- [ ]  PNG와 웹카드의 레이아웃 일치

---

# 8. Screen 07 — My Archive Grid

## 8.1 Purpose

사용자가 경험한 전시를 목록으로 확인하는 화면이다.

## 8.2 UI Elements

- My Archive Title
- Archive Count
- Archive Cards
- Bottom Navigation

## 8.3 Functional Requirements

### ARCHIVE-01 List

- 로그인 사용자 ID를 기준으로 Archive 목록을 조회한다.
- 최신 방문 또는 생성 기준으로 정렬한다.
- 각 카드에 전시 대표 이미지, 제목, 장소, 연도를 표시한다.

### ARCHIVE-02 Detail Navigation

- Archive Card 선택 시 해당 Archive Detail로 이동한다.

### ARCHIVE-03 Empty State

- Archive가 없는 경우 빈 상태 화면을 표시한다.
- QR Scan 또는 전시 탐색으로 진입할 수 있는 액션을 제공한다.

## 8.4 Acceptance Criteria

- [ ]  로그인 사용자 Archive만 표시
- [ ]  Archive 목록 조회
- [ ]  전시 정보 표시
- [ ]  Archive Detail 이동
- [ ]  빈 상태 표시

---

# 9. Screen 08 — Archive Detail

## 9.1 Purpose

전시별 개인 기록을 확인하고 관리하는 화면이다.

## 9.2 UI Elements

- Exhibition Information
- Saved Scrap Count
- Journal Status
- Digital Keepsake Status
- Last Visited
- Delete Archive

## 9.3 Functional Requirements

### DETAIL-01 Archive Information

- Archive ID를 기준으로 전시 정보를 조회한다.
- 해당 Archive에 연결된 Scrap, Journal, Keepsake을 조회한다.

### DETAIL-02 Scrap

- 저장된 문장 목록을 표시한다.
- 문장 원문을 확인할 수 있어야 한다.
- 저장 해제 기능은 별도 정책 확정 후 제공한다.

### DETAIL-03 Journal

- Journal이 있으면 내용을 열람한다.
- Journal 선택 시 수정 화면으로 이동한다.
- Journal이 없으면 작성 화면으로 이동한다.

### DETAIL-04 Digital Keepsake

- 저장된 웹카드 목록 또는 대표 카드를 표시한다.
- 카드 선택 시 상세 웹카드로 이동한다.
- PNG 다운로드를 지원한다.

### DETAIL-05 Delete Archive

1. Delete Archive 선택
2. 삭제 확인 Dialog 표시
3. 사용자가 삭제 확정
4. 서버에서 Archive 삭제 처리
5. 연결된 Scrap, Journal, Keepsake 데이터 삭제
6. My Archive Grid로 이동

## 9.4 Deletion Rule

Archive 삭제 시 다음 데이터가 함께 삭제되어야 한다.

- Archive
- Scrap
- Journal
- Digital Keepsake

삭제 작업은 데이터 일관성을 위해 트랜잭션 또는 이에 준하는 원자적 처리 방식으로 구현한다.

## 9.5 Acceptance Criteria

- [ ]  Archive 상세 정보 조회
- [ ]  Scrap 목록 조회
- [ ]  Journal 열람 및 수정 진입
- [ ]  Digital Keepsake 열람
- [ ]  PNG 다운로드
- [ ]  삭제 확인 Dialog
- [ ]  연결된 개인 데이터 Cascade Delete
- [ ]  삭제 후 Archive Grid 복귀

---

# 10. Screen 09 — Account

## 10.1 Purpose

계정 및 기본 설정 관리 화면이다.

## 10.2 UI Elements

- Google User Information
- Audio Settings
- Logout
- Account Deletion

## 10.3 Functional Requirements

### ACCOUNT-01 User Information

- Google OAuth에서 전달된 사용자 정보를 표시한다.
- 사용자 이름 및 이메일을 표시한다.

### ACCOUNT-02 Logout

1. 사용자가 Logout을 선택한다.
2. 로그아웃 처리한다.
3. 인증 세션을 제거한다.
4. Home / Logged Out으로 이동한다.

### ACCOUNT-03 Account Deletion

- 계정 삭제 확인 절차를 제공한다.
- 삭제 범위 및 데이터 처리 정책은 별도 확정 후 구현한다.

---

# 11. Data Model & Database Constraints

아래는 권장 관계형 데이터 구조다.

## 11.1 users

| Field | Type | Constraint |
| --- | --- | --- |
| id | UUID | PK |
| google_id | VARCHAR | UNIQUE |
| email | VARCHAR | UNIQUE |
| display_name | VARCHAR |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

## 11.2 exhibitions

| Field | Type | Constraint |
| --- | --- | --- |
| id | UUID | PK |
| title | VARCHAR | NOT NULL |
| venue | VARCHAR |  |
| start_date | DATE |  |
| end_date | DATE |  |
| description | TEXT |  |
| cover_image_url | TEXT |  |
| qr_code_url | TEXT |  |
| status | VARCHAR |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

## 11.3 guide_sentences

| Field | Type | Constraint |
| --- | --- | --- |
| id | UUID | PK |
| exhibition_id | UUID | FK |
| content | TEXT | NOT NULL |
| sequence | INTEGER |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

해설 가이드의 Scrap 대상 문장을 관리한다.

## 11.4 archives

| Field | Type | Constraint |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK |
| exhibition_id | UUID | FK |
| first_visited_at | TIMESTAMP |  |
| last_visited_at | TIMESTAMP |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

**UNIQUE (user_id, exhibition_id)**

동일 사용자의 동일 전시 Archive 중복 생성을 방지한다.

## 11.5 scraps

| Field | Type | Constraint |
| --- | --- | --- |
| id | UUID | PK |
| archive_id | UUID | FK |
| guide_sentence_id | UUID | FK |
| sentence_content_snapshot | TEXT | NOT NULL |
| created_at | TIMESTAMP |  |

**권장 UNIQUE (archive_id, guide_sentence_id)**

동일 문장의 중복 Scrap을 방지한다.

## 11.6 journals

| Field | Type | Constraint |
| --- | --- | --- |
| id | UUID | PK |
| archive_id | UUID | FK, UNIQUE |
| content | TEXT |  |
| audio_type | VARCHAR |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

**UNIQUE (archive_id)**

Archive 하나당 Journal 하나만 허용한다.

## 11.7 digital_keepsakes

| Field | Type | Constraint |
| --- | --- | --- |
| id | UUID | PK |
| archive_id | UUID | FK |
| template_id | UUID |  |
| content_data | JSON |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

Keepsake의 개수 제한은 아직 미확정이므로 현재는 1 구조로 설계한다.

## 11.8 audio_configurations

| Field | Type | Constraint |
| --- | --- | --- |
| id | UUID | PK |
| exhibition_id | UUID | FK |
| audio_provider | VARCHAR |  |
| playlist_url | TEXT |  |
| playlist_title | VARCHAR |  |
| ambience_enabled | BOOLEAN |  |
| ambience_type | VARCHAR |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

`audio_provider` 허용값:

- APPLE_MUSIC
- SPOTIFY
- NONE

`ambience_type`:

- PINK_NOISE

실제 Pink Noise On/Off 상태는 사용자 인터랙션 상태로 관리한다. 사용자별 상태를 영구 저장할지는 별도 정책 확정이 필요하다.

---

# 12. API Specification (Suggested)

실제 API URL과 인증 방식은 백엔드 기술 스택 확정 후 결정한다.

## 12.1 Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /auth/google | Google OAuth 시작 |
| GET | /auth/google/callback | OAuth 인증 결과 |
| POST | /auth/logout | 로그아웃 |
| GET | /users/me | 현재 사용자 조회 |

## 12.2 Exhibition

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /exhibitions/{id} | 전시 상세 조회 |
| GET | /exhibitions/{id}/guide | 전시 해설 가이드 조회 |
| GET | /exhibitions/{id}/audio | 전시 오디오 설정 조회 |

## 12.3 Archive

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /archives | 내 Archive 목록 |
| POST | /archives | Archive 생성 또는 기존 Archive 반환 |
| GET | /archives/{id} | Archive 상세 조회 |
| DELETE | /archives/{id} | Archive 삭제 |

Archive 생성 API는 `user_id + exhibition_id` 조합의 중복을 방지해야 한다.

## 12.4 Scrap

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /archives/{id}/scraps | Scrap 목록 |
| POST | /archives/{id}/scraps | Scrap 저장 |
| DELETE | /archives/{id}/scraps/{scrapId} | Scrap 삭제 |

Scrap 삭제 UI 및 정책은 추후 확정한다.

## 12.5 Journal

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /archives/{id}/journal | Journal 조회 |
| PUT | /archives/{id}/journal | Journal 생성 또는 수정 |

PUT은 Archive ID 기준으로 Journal을 Upsert하는 방식으로 권장한다.

동일 Archive에서 중복 Journal 생성이 불가능하도록 DB 제약을 적용한다.

## 12.6 Digital Keepsake

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /archives/{id}/keepsakes | 웹카드 목록 |
| POST | /archives/{id}/keepsakes | 웹카드 저장 |
| GET | /keepsakes/{id} | 웹카드 상세 조회 |
| PUT | /keepsakes/{id} | 웹카드 수정 |
| GET | /keepsakes/{id}/export | PNG 다운로드 |

PNG 생성은 서버 또는 클라이언트 렌더링 방식 중 기술 검토 후 선택한다.

## 12.7 API Error Handling

권장 공통 오류 형식:

```
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Requested resource was not found."
  }
}
```

권장 HTTP Status:

| Status | Meaning |
| --- | --- |
| 200 | 정상 조회 및 수정 |
| 201 | 생성 완료 |
| 400 | 잘못된 요청 |
| 401 | 로그인 필요 |
| 403 | 접근 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 중복 또는 상태 충돌 |
| 422 | 유효성 검증 실패 |
| 500 | 서버 오류 |

---

# 13. Global Error Handling

| Feature | Error | Expected Response |
| --- | --- | --- |
| OAuth | 인증 취소 | 원래 화면 복귀 |
| OAuth | 인증 실패 | 재시도 안내 |
| QR | 인식 실패 | 다시 스캔 |
| Exhibition | 데이터 없음 | 전시 없음 안내 |
| Scrap | 중복 저장 | Saved 상태 유지 |
| Scrap | 저장 실패 | Retry |
| Journal | 저장 실패 | 입력 내용 유지 |
| Audio | 외부 링크 오류 | 링크 오류 안내 |
| Audio | Pink Noise 재생 실패 | 재생 오류 안내 |
| Keepsake | 저장 실패 | 입력 및 미리보기 유지 |
| Keepsake | PNG 변환 실패 | 재시도 |
| Archive | 삭제 실패 | 삭제되지 않았음을 명확히 안내 |

모든 서버 오류는 사용자에게 이해 가능한 문구로 변환한다. 내부 서버 메시지나 개인정보를 직접 노출하지 않는다.

---

# 14. Security & Data Access

## 14.1 Authentication

- Google OAuth 기반 로그인
- 인증 토큰 및 세션 안전하게 관리
- 로그아웃 시 유효 세션 종료

## 14.2 Authorization

- Archive는 소유 사용자만 조회 가능
- Scrap은 소유 Archive에 대해서만 조회 및 수정 가능
- Journal은 소유 사용자만 접근 가능
- Digital Keepsake은 소유 사용자만 조회 및 다운로드 가능

## 14.3 Data Integrity

- Archive 중복 방지
- Journal 중복 방지
- Scrap 중복 방지
- Archive 삭제 시 연결 데이터 삭제
- 동시 저장 요청에 대한 DB 제약 적용

## 14.4 Privacy

- Journal은 비공개 기본값
- 개인 Archive는 외부 공개되지 않음
- 공유 기능은 MVP 범위에서 제외

---

# 15. Analytics Events (Recommended)

MVP의 사용 흐름과 주요 기능 사용 여부를 확인하기 위해 다음 이벤트를 권장한다.

| Event | Trigger | Properties |
| --- | --- | --- |
| home_view | Home 진입 | user_state |
| qr_scan_start | QR Scan 시작 | user_state |
| exhibition_view | 전시 가이드 진입 | exhibition_id |
| login_start | 로그인 시작 | source_action |
| login_success | 로그인 완료 | provider |
| scrap_save | 문장 Scrap 저장 | exhibition_id, sentence_id |
| journal_create | 최초 Journal 저장 | archive_id |
| journal_update | Journal 수정 | archive_id |
| audio_external_click | 외부 플레이리스트 이동 | provider, exhibition_id |
| ambience_on | Pink Noise On | exhibition_id |
| ambience_off | Pink Noise Off | exhibition_id |
| keepsake_save | 웹카드 저장 | archive_id, template_id |
| keepsake_png_download | PNG 다운로드 | keepsake_id |
| archive_delete | Archive 삭제 | archive_id |

Journal 내용, 이메일, 개인 기록 원문 등 민감한 내용을 Analytics 이벤트에 포함하지 않는다.

---

# 16. QA Test Scenarios

## 16.1 Guest Flow

- 비로그인 상태에서 Home 진입
- QR Scan
- 전시 가이드 열람
- Scrap 선택
- Google 로그인 유도
- 로그인 후 원래 문장으로 복귀

## 16.2 Archive Flow

- 최초 전시 진입 시 Archive 생성
- 동일 전시 재진입 시 기존 Archive 반환
- Last Visited 갱신
- 서로 다른 전시는 별도 Archive 생성

## 16.3 Scrap Flow

- 가이드 문장 Scrap 저장
- 저장된 문장 상태 표시
- 동일 문장 중복 요청
- 다른 문장 추가 저장
- Archive에서 Scrap 조회

## 16.4 Journal Flow

- 최초 Journal 작성
- 저장 후 재진입
- 기존 Journal 불러오기
- 기존 Journal 수정
- 중복 저장 요청
- 두 기기에서 동시에 수정하는 경우의 충돌 처리 검토
- 저장 실패 시 내용 유지

## 16.5 Audio Flow

- Apple Music 링크 제공 전시
- Spotify 링크 제공 전시
- External Playlist 미제공 전시
- Pink Noise 기본 Off
- Pink Noise On
- Pink Noise Off
- No Audio 선택
- 브라우저 재생 제한
- 오디오 로딩 실패

## 16.6 Digital Keepsake Flow

- 템플릿 선택
- 미리보기 확인
- 웹카드 저장
- 저장 카드 재열람
- PNG 다운로드
- 이미지 및 폰트 렌더링 확인
- PNG 다운로드 실패 후 재시도

## 16.7 Archive Deletion Flow

- Archive 삭제 확인
- 삭제 취소
- 삭제 확정
- Scrap 삭제 확인
- Journal 삭제 확인
- Keepsake 삭제 확인
- 삭제 후 접근 차단

---

# 17. Definition of Done

다음 조건을 모두 만족하면 MVP 개발 완료로 판단한다.

## Core

- Guest 전시 진입
- Google OAuth
- QR 및 직접 URL 진입
- Exhibition Guide

## Personal Archive

- Archive 자동 생성
- Archive 중복 방지
- Scrap 저장
- Archive당 Journal 1개
- Journal 수정

## Audio

- Apple Music 연결
- Spotify 연결
- Pink Noise On / Off
- No Audio

## Digital Keepsake

- 웹카드 생성
- 웹카드 저장
- 웹카드 재열람
- PNG 다운로드

## Management

- Archive Grid
- Archive Detail
- Archive 삭제
- Cascade Delete
- Logout

## Quality

- 모바일 브라우저 QA
- 주요 오류 상태 QA
- 데이터 권한 검증
- 중복 데이터 방지
- 개인정보 보호 검증

---

# 18. Open Decisions Before Development

다음 항목은 현재 제품 정책에서 아직 결정되지 않은 사항이다. 개발 전에 PO와 합의가 필요하다.

| ID | Topic | Decision Needed | Impact |
| --- | --- | --- | --- |
| TBD-01 | Scrap 삭제 | 저장 해제 허용 여부 | UI / API |
| TBD-02 | Keepsake Count | 전시당 웹카드 개수 제한 | DB / UI |
| TBD-03 | Keepsake Content | Journal 전체 또는 선택 문장 | UI / Data |
| TBD-04 | Playlist Management | 기관 제공 링크 등록 주체 및 방법 | Operations / DB |
| TBD-05 | Pink Noise Scope | Guide 및 Journal 중 어디서 재생할지 | UI / Audio |
| TBD-06 | Audio Persistence | 화면 이동 후 재생 유지 여부 | Frontend |
| TBD-07 | Journal Validation | 최소·최대 글자 수, 빈 기록 허용 여부 | Frontend / Backend |
| TBD-08 | Account Deletion | 계정 삭제 시 Archive 전체 삭제 여부 | Backend / Privacy |
| TBD-09 | Keepsake Export | PNG 해상도 및 카드 비율 | Frontend |
| TBD-10 | Offline Behavior | 네트워크 끊김 시 임시 기록 보존 범위 | Frontend |

---

# 19. Final Development Principle

STILL의 핵심은 기능을 많이 제공하는 것이 아니라 전시 경험을 방해하지 않으면서 개인의 기억을 자연스럽게 축적하는 것이다.

개발 과정에서 다음 원칙을 유지한다.

1. 전시 가이드는 로그인 없이 접근할 수 있어야 한다.
2. 개인 기록 저장 시에만 로그인을 요구한다.
3. 전시 하나당 Archive 하나, Journal 하나의 구조를 유지한다.
4. Scrap은 해설 가이드에 제공된 문장을 수집하는 방식이다.
5. External Playlist는 전시 기관이 제공하는 링크를 사용한다.
6. Pink Noise는 별도의 플레이리스트가 없을 때 제공하고 사용자가 직접 On / Off 한다.
7. Digital Keepsake은 웹카드로 보관하며 PNG 다운로드를 제공한다.
8. 모든 화면은 미니멀한 흑백 디자인 원칙을 따른다.

**STILL — Art stays with you.**