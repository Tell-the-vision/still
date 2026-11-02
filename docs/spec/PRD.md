# Product Requirements Document

# STILL

## Product Requirements Document (PRD)

**Version:** MVP v1.1

**Product:** STILL — Mobile Exhibition Experience Archive

**Brand Slogan:** Art stays with you.

**Platform:** Mobile-first Web Application

---

# 1. Product Overview

## 1.1 서비스 소개

STILL은 전시를 관람하는 순간뿐 아니라 전시가 끝난 이후에도 관람객의 경험과 감정, 생각이 지속될 수 있도록 돕는 개인화 아카이빙 서비스다.

일반적인 전시 관람 경험은 전시 공간을 벗어나면서 종료된다. 전시장에서 마주한 작품, 인상 깊었던 문장, 개인적인 감상은 시간이 지나면서 잊히거나 흩어진다.

STILL은 이러한 경험을 디지털 공간에 보관한다.

관람객은 전시장에 비치된 QR 코드 또는 전시 URL을 통해 STILL에 접속하고, 전시 가이드를 확인하며, 인상 깊은 문장을 Scrap으로 저장하고, 개인적인 Journal을 작성할 수 있다.

이렇게 쌓인 기록은 개인의 Archive에 저장된다. Digital Keepsake을 통해 전시 경험을 웹카드 형태로 보관하고 PNG 이미지로 다운로드할 수도 있다.

## 1.2 Brand Concept

**Art stays with you.**

전시는 끝나지만, 전시를 통해 경험한 감정과 생각은 남는다.

STILL은 그 경험이 머무는 공간이다.

핵심 가치:

- Stay: 전시 경험의 지속
- Collect: 인상 깊은 순간과 문장의 수집
- Reflect: 개인의 감상과 생각 기록
- Keep: 전시 경험의 개인 아카이빙

## 1.3 Product Vision

전시 관람을 일회성 경험에서 개인의 지속적인 문화 기록으로 전환한다.

STILL은 전시 정보를 소비하는 플랫폼이 아니라, 전시를 통해 만들어진 개인의 기억을 보관하는 공간을 지향한다.

---

# 2. Product Goals

## 2.1 Primary Goals

1. 전시 관람객이 별도의 앱 설치 없이 전시 경험을 기록할 수 있도록 한다.
2. 로그인하지 않은 사용자도 전시 가이드를 자유롭게 확인할 수 있도록 한다.
3. 로그인한 사용자는 전시 경험을 개인 Archive에 저장할 수 있도록 한다.
4. 해설 가이드의 문장 수집, Journal, Audio를 통해 전시 경험을 다층적으로 기록하도록 한다.
5. 전시별 기록을 개인 Archive에 축적하고 다시 열람할 수 있도록 한다.
6. Digital Keepsake을 웹카드로 보관하고 PNG로 소장할 수 있도록 한다.

## 2.2 MVP Success Criteria

- QR 또는 URL을 통한 전시 진입이 정상적으로 작동한다.
- 비로그인 상태에서 전시 가이드를 열람할 수 있다.
- Google 로그인 후 기존 사용자의 작업 흐름으로 복귀한다.
- 전시별 Archive가 중복 생성되지 않는다.
- 전시 하나당 Journal 하나를 생성하고 수정할 수 있다.
- 해설 가이드에서 문장을 Scrap으로 저장할 수 있다.
- Digital Keepsake 웹카드를 저장하고 PNG로 다운로드할 수 있다.
- External Playlist 및 STILL Ambience의 재생 제어가 가능하다.
- Archive 삭제 시 연결된 Scrap, Journal, Keepsake 데이터가 함께 삭제된다.

---

# 3. Target Platform & Design Principles

## 3.1 Platform

- Mobile-first Web Application
- 별도 앱 설치 없이 브라우저에서 실행
- 전시장 QR 코드 및 직접 URL 진입 지원
- 기준 디자인 화면: 390 × 844 px
- 주요 대응 환경: 모바일 브라우저

## 3.2 Design Direction

**Minimal / Editorial / Monochrome**

STILL의 UI는 사용자의 시선을 분산시키지 않고 전시와 개인의 기록에 집중하도록 설계한다.

### Color System

| Token | Value | Usage |
| --- | --- | --- |
| White | #FFFFFF | 전체 배경 및 기본 UI |
| Black | #000000 | 주요 텍스트, 버튼, 아이콘 |
| Gray | #666666 | 보조 텍스트 |
- 배경은 순수 화이트를 기본으로 한다.
- 주요 UI는 블랙과 화이트만 사용한다.
- 그레이는 텍스트에 한해 사용한다.
- 유채색 포인트 컬러는 사용하지 않는다.
- 불필요한 그림자, 그라데이션, 장식 요소를 최소화한다.

### Typography

| Role | Typeface | Usage |
| --- | --- | --- |
| Display | Futura 계열 기하학적 산세리프 — Montserrat | 로고, 주요 제목 |
| Body / UI | DM Sans | 본문, 버튼, 메뉴, 보조 정보 |

Futura를 직접 사용할 수 있는 환경에서는 Futura를 우선 검토한다. 현재 Figma 시안에는 대체 글꼴인 Montserrat를 적용한다.

### Layout Principles

- 넓은 여백
- 간결한 정보 구조
- 중앙 정렬을 활용한 절제된 레이아웃
- 얇은 구분선
- 최소한의 아이콘과 텍스트
- 콘텐츠보다 UI가 먼저 보이지 않도록 설계

---

# 4. MVP Scope

## 4.1 In Scope

| Feature | Description | Priority |
| --- | --- | --- |
| Home | 로그인 및 QR 진입 | P0 |
| QR Scanner | 전시 QR 인식 | P0 |
| Exhibition Guide | 전시 정보 및 해설 가이드 | P0 |
| Google Login | 개인 기록 저장을 위한 인증 | P0 |
| Sentence Collection | 해설 가이드 문장 저장 | P0 |
| Journal | 전시별 단일 개인 감상 기록 | P0 |
| Audio | External Playlist / Pink Noise | P1 |
| Digital Keepsake | 웹카드 저장 및 PNG 다운로드 | P1 |
| My Archive | 저장한 전시 목록 | P0 |
| Archive Detail | 전시별 기록 열람 | P0 |
| Account | 계정 및 로그아웃 | P0 |

## 4.2 Out of Scope

- 관리자용 CMS 구축
- 결제 및 유료 구독
- 소셜 피드 및 사용자 간 공유
- 사용자 간 팔로우 및 커뮤니티
- 생성형 AI 기반 Keepsake 이미지 생성
- 3D 및 VR 기능
- 복잡한 개인화 추천 시스템

---

# 5. Information Architecture

## 5.1 Main IA

**Home**

- STILL Wordmark
- Login
- QR Scan

**Exhibition**

- Exhibition Guide
- Exhibition Information
- Commentary Guide
- Sentence Collection
- Journal
- Audio
- Digital Keepsake

**My Archive**

- Archive Grid
- Archive Detail
    - Exhibition Information
    - Saved Sentences
    - Journal
    - Digital Keepsake
    - Archive Management

**Account**

- User Information
- Audio Settings
- Logout
- Account Deletion

## 5.2 Navigation Principle

Home은 서비스의 진입점이다.

사용자는 Home에서 Login 또는 QR Scan을 선택한다.

전시 진입 이후에는 전시 경험에 집중할 수 있도록 복잡한 글로벌 내비게이션을 최소화한다.

로그인 사용자는 My Archive와 Account를 통해 개인 기록에 접근한다.

---

# 6. User & Authentication

## 6.1 User Types

### Guest User

- 로그인하지 않은 사용자
- QR 및 URL로 전시 진입 가능
- 전시 가이드 열람 가능
- 개인 기록 저장 불가
- 저장 기능 선택 시 로그인 유도

### Authenticated User

- Google OAuth 로그인을 완료한 사용자
- 전시별 Archive 자동 생성
- 해설 가이드 문장 Scrap 저장
- 전시별 Journal 작성 및 수정
- Audio 설정 및 재생
- Digital Keepsake 저장 및 다운로드
- My Archive 열람 및 관리

## 6.2 Authentication

- Google OAuth만 지원한다.
- 별도 이메일 회원가입은 MVP 범위에서 제외한다.
- 개인 기록을 저장하려는 경우 로그인을 요구한다.

## 6.3 Login Interruption & Resume

로그인이 필요한 기능을 비로그인 사용자가 선택하면 로그인 절차를 제공한다.

로그인 완료 후에는 사용자가 원래 실행하려던 작업으로 복귀해야 한다.

예시:

1. 비로그인 사용자가 해설 가이드에서 문장 저장을 선택한다.
2. Google 로그인 절차로 이동한다.
3. 로그인 완료 후 기존 전시 가이드로 돌아온다.
4. 저장하려던 문장을 저장할 수 있도록 이어서 처리한다.

사용자가 작성 중이던 임시 기록이 있다면 로그인 과정에서 유실되지 않도록 한다.

---

# 7. Core Functional Requirements

## 7.1 Home

### Purpose

STILL의 브랜드 경험을 전달하고 사용자의 첫 행동을 유도한다.

### UI Elements

- STILL Wordmark
- Login
- QR Scan

### Functional Requirements

- Login 선택 시 Google OAuth 절차로 진입한다.
- QR Scan 선택 시 카메라 기반 QR Scanner를 실행한다.
- 로그인 여부에 따라 개인화된 진입 처리를 지원한다.

### UI Direction

- 중앙에 STILL 로고 배치
- Login과 QR Scan만 핵심 진입 동작으로 노출
- 불필요한 소개 문구와 이미지 제거
- 넓은 여백 유지

## 7.2 QR Scanner

### Purpose

전시장 QR 코드를 통해 해당 전시로 진입시킨다.

### Functional Requirements

- 카메라 권한 요청
- QR 코드 인식
- QR에 연결된 전시 URL 확인
- 유효한 전시 페이지로 이동
- 카메라 권한 거부 및 인식 실패 상태 처리
- 직접 URL 진입 지원

## 7.3 Exhibition Guide

### Purpose

전시 관람에 필요한 기본 정보와 해설 콘텐츠를 제공한다.

### Content Elements

- 전시명
- 전시 장소
- 전시 기간
- 전시 대표 이미지
- 전시 소개
- 작품 및 전시 해설
- 해설 가이드 내 Scrap 가능한 문장

### Functional Requirements

- 로그인 없이 열람 가능
- 전시 콘텐츠 확인 가능
- 해설 가이드에 포함된 문장에 Scrap 액션 제공
- 개인 기록 저장 시 로그인 요구
- 저장한 문장이 어느 전시에서 수집되었는지 Archive와 연결

### Important Rule

Scrap은 사용자가 임의로 문장을 입력하는 기능이 아니다.

전시 기획사 또는 전시 기관이 제공한 해설 가이드 안에서 문장을 선택하고 저장하는 방식으로 운영한다.

전시 가이드는 로그인 유도보다 전시 경험 제공을 우선한다.

## 7.4 Sentence Collection / Scrap

### Purpose

관람객이 해설 가이드에서 인상 깊게 느낀 문장을 수집하도록 한다.

### Functional Requirements

- 해설 가이드의 Scrap 가능한 문장에 저장 액션 제공
- 로그인 사용자만 저장 가능
- 저장된 문장은 해당 전시의 Archive에 연결
- 저장된 문장은 Archive Detail에서 확인 가능
- 저장한 문장에 대한 중복 저장 정책은 구현 시 일관되게 처리

### User Flow

1. 사용자가 Exhibition Guide를 읽는다.
2. 인상 깊은 문장을 발견한다.
3. 해당 문장의 Scrap 액션을 선택한다.
4. 문장이 개인 Archive에 저장된다.
5. 사용자는 Archive Detail에서 저장한 문장을 다시 확인한다.

### Data

- scrap_id
- archive_id
- guide_sentence_id
- sentence_content_snapshot
- created_at

`sentence_content_snapshot`은 원본 가이드 문구가 추후 수정되더라도 사용자가 저장한 당시 문장을 유지하기 위한 값이다.

## 7.5 Journal

### Purpose

전시를 관람한 후 개인적인 생각과 감정을 기록한다.

### Core Policy

**전시 하나당 Journal 하나만 생성할 수 있다.**

사용자는 같은 전시에 대해 여러 개의 Journal을 별도로 생성하지 않는다. 기존 Journal을 다시 열어 내용을 수정하고 업데이트할 수 있다.

### Functional Requirements

- 전시별 Journal 작성
- Journal 최초 저장
- 기존 Journal 열람 및 수정
- 수정 시 updated_at 갱신
- 개인 기록은 기본적으로 비공개
- Journal은 해당 Archive에 연결
- 작성 중 임시 내용 보호

### Audio Options

Journal 작성 환경에서 다음 오디오 옵션을 제공한다.

1. External Playlist
2. STILL Ambience
3. No Audio

### Journal Data

- journal_id
- archive_id
- content
- audio_type
- created_at
- updated_at

### Data Constraint

`archive_id`에 UNIQUE 제약을 적용하여 Archive 하나당 Journal이 하나만 존재하도록 한다.

## 7.6 Audio

### Purpose

전시 관람과 Journal 작성 과정에서 감상에 적합한 청각적 환경을 제공한다.

Audio는 전시 기획사 또는 전시 기관이 제공하는 플레이리스트가 있는 경우와 없는 경우를 구분한다.

### A. External Playlist

전시 기획사 또는 전시 기관이 전시 경험에 맞춰 선정한 플레이리스트를 제공한다.

지원 플랫폼:

- Apple Music
- Spotify

### Functional Requirements

- 전시별 External Playlist 정보 제공
- 전시 기관이 제공한 플레이리스트 링크 연결
- Apple Music 또는 Spotify 앱/웹으로 이동
- 플레이리스트가 없는 전시는 External Playlist를 노출하지 않는다.

### Content Data

- audio_provider
- playlist_url
- playlist_title
- playlist_description (optional)

### Important Rule

External Playlist는 STILL이 임의로 선정하는 것이 아니라 전시 기획사 또는 전시 기관이 제공하는 콘텐츠다.

### B. STILL Ambience — Pink Noise

전시 기관에서 별도의 플레이리스트를 제공하지 않는 경우 STILL Ambience를 대체 청취 옵션으로 제공한다.

STILL Ambience는 Pink Noise를 기반으로 한 기본 사운드 환경이다.

### Functional Requirements

- Pink Noise 재생
- On / Off 토글
- 사용자가 원하는 시점에 재생 및 중지
- 기본 상태는 Off
- 사용자가 명시적으로 재생을 선택한 경우에만 소리 출력
- 페이지 이동 또는 브라우저 정책에 따른 재생 중단 처리

### Audio State

- ON: Pink Noise 재생
- OFF: 재생 중지

### C. No Audio

사용자가 어떠한 오디오도 원하지 않는 경우 선택할 수 있다.

### Audio Priority Logic

1. 전시 기관이 External Playlist를 제공하면 해당 플레이리스트를 우선 노출한다.
2. 별도 플레이리스트가 없다면 STILL Ambience(Pink Noise)를 제공한다.
3. 사용자는 언제든 No Audio 상태를 선택할 수 있다.

External Playlist의 실제 재생은 Apple Music 또는 Spotify에서 처리하며, STILL 내부의 재생 제어와 외부 서비스의 재생 제어는 구분한다.

## 7.7 Digital Keepsake

### Purpose

전시 경험을 개인적인 디지털 기념물로 보관한다.

### Core Policy

Digital Keepsake은 웹카드 형태로 생성 및 저장한다.

사용자는 STILL 웹 또는 앱 내에서 저장한 웹카드를 다시 열어볼 수 있으며, 동일한 디자인을 PNG 이미지로 다운로드할 수 있다.

### Functional Requirements

- Archive 내 Digital Keepsake 진입
- 사전 정의된 템플릿 선택
- 템플릿 미리보기
- 전시 정보 및 개인 기록 반영
- 웹카드 저장
- 저장한 웹카드 재열람
- PNG 다운로드

### Potential Content

- STILL Wordmark
- Exhibition Title
- Exhibition Date / Location
- Artwork Image
- Saved Sentence
- Personal Journal Excerpt

### Web Card Behavior

- 웹카드는 해당 사용자의 Archive에 연결한다.
- 저장한 카드는 Archive Detail에서 다시 열람할 수 있다.
- 웹카드 화면은 모바일 화면에 최적화한다.
- 저장된 웹카드는 사용자가 다시 열어볼 수 있어야 한다.

### PNG Export

- 웹카드와 동일한 디자인을 PNG로 변환한다.
- 화면 크기와 관계없이 이미지 비율 및 레이아웃을 유지한다.
- 이미지에 필요한 폰트와 콘텐츠가 정상적으로 렌더링되어야 한다.
- 다운로드 실패 시 재시도할 수 있어야 한다.

### MVP Constraint

- 템플릿 기반 구성
- 생성형 AI 이미지 생성 제외
- 사전 정의된 디자인 레이아웃 활용
- 웹카드 저장 및 PNG 내보내기 지원

## 7.8 My Archive

### Purpose

사용자가 지금까지 경험한 전시를 개인적으로 모아볼 수 있도록 한다.

### Archive Grid

- 저장한 전시 목록
- 전시 대표 이미지
- 전시명
- 장소 및 날짜 등 기본 정보
- Archive Detail 진입

### Functional Requirements

- 로그인 사용자만 접근 가능
- Archive 목록 확인
- 전시별 상세 페이지 진입
- 중복 전시 기록 방지
- 최근 방문 정보 반영

## 7.9 Archive Detail

### Purpose

특정 전시와 관련된 개인 기록을 한곳에서 확인한다.

### Content

- Exhibition Information
- Saved Sentences
- Journal
- Digital Keepsake
- Last Visited

### Functional Requirements

- 전시별 개인 기록 확인
- 저장된 Scrap 열람
- Journal 열람 및 수정
- Digital Keepsake 열람
- Archive 삭제 기능 제공

## 7.10 Account

### Purpose

사용자 계정 및 기본 설정을 관리한다.

### Functional Requirements

- Google 계정 정보 표시
- Audio 설정 진입
- Logout
- Account Deletion 진입

---

# 8. User Flows

## 8.1 Entry & Authentication

1. 사용자가 STILL에 접속한다.
2. Home에서 Login 또는 QR Scan을 선택한다.
3. QR Scan 또는 직접 URL로 전시 가이드에 진입한다.
4. 로그인 없이 전시를 확인한다.
5. 개인 기록 저장을 선택한다.
6. 비로그인 상태라면 Google OAuth를 진행한다.
7. 인증 후 기존 저장 액션으로 복귀한다.

## 8.2 Exhibition Entry & Archive Registration

1. 사용자가 전시 QR 또는 URL로 진입한다.
2. 전시 정보를 확인한다.
3. 로그인 여부를 확인한다.
4. 로그인 상태라면 해당 전시의 Archive를 생성한다.
5. 이미 동일한 Archive가 존재한다면 신규 생성하지 않는다.
6. 기존 Archive의 Last Visited를 갱신한다.

## 8.3 Journal

1. 사용자가 Exhibition Guide를 확인한다.
2. Journal 작성 화면으로 이동한다.
3. 기존 Journal이 없는 경우 새로운 Journal을 작성한다.
4. 기존 Journal이 있다면 저장된 내용을 불러온다.
5. 사용자가 기존 내용을 수정하거나 새롭게 작성한다.
6. Save를 선택한다.
7. 동일한 Archive에 연결된 Journal을 업데이트한다.

## 8.4 Sentence Collection / Scrap

1. 사용자가 해설 가이드를 읽는다.
2. 인상 깊은 문장을 발견한다.
3. 문장 옆 Scrap 액션을 선택한다.
4. 비로그인 사용자라면 Google 로그인으로 이동한다.
5. 로그인 완료 후 원래 문장으로 복귀한다.
6. 선택한 문장이 해당 Archive에 저장된다.
7. Archive Detail에서 다시 확인한다.

## 8.5 Audio

1. 사용자가 전시 또는 Journal 화면에 진입한다.
2. 전시별 Audio 제공 여부를 확인한다.
3. External Playlist가 있으면 Apple Music 또는 Spotify 연결을 표시한다.
4. External Playlist가 없다면 STILL Ambience 옵션을 표시한다.
5. 사용자가 Pink Noise를 On 하면 재생한다.
6. Off를 선택하면 즉시 재생을 중지한다.
7. 사용자는 언제든 No Audio를 선택할 수 있다.

## 8.6 Digital Keepsake

1. My Archive에서 전시를 선택한다.
2. Archive Detail로 진입한다.
3. Digital Keepsake을 선택한다.
4. 템플릿을 선택한다.
5. 전시 정보 및 개인 기록이 반영된 웹카드 미리보기를 확인한다.
6. Save를 선택한다.
7. 웹카드가 Archive에 저장된다.
8. 사용자는 웹카드를 다시 열어보거나 PNG로 다운로드할 수 있다.

## 8.7 Archive Deletion

1. Archive Detail로 진입한다.
2. Delete Archive를 선택한다.
3. 삭제 확인을 요청한다.
4. 사용자가 삭제를 확정한다.
5. Archive 및 연결된 Scrap, Journal, Digital Keepsake 데이터를 함께 삭제한다.
6. My Archive Grid로 돌아간다.

---

# 9. Data Structure

## 9.1 User

- user_id
- google_id
- email
- display_name
- created_at
- updated_at

## 9.2 Exhibition

- exhibition_id
- title
- venue
- start_date
- end_date
- description
- cover_image
- qr_code_url
- external_playlist_provider
- external_playlist_url
- external_playlist_title
- ambience_enabled
- created_at
- updated_at

## 9.3 Exhibition Guide Sentence

- guide_sentence_id
- exhibition_id
- content
- sequence
- created_at
- updated_at

해설 가이드에 포함된 Scrap 대상 문장을 관리한다.

## 9.4 Archive

- archive_id
- user_id
- exhibition_id
- first_visited_at
- last_visited_at
- created_at
- updated_at

**Relationship:** User 1 : N Archive

**Constraint:** 동일 사용자와 동일 전시에 대한 Archive는 중복 생성하지 않는다.

## 9.5 Scrap

- scrap_id
- archive_id
- guide_sentence_id
- sentence_content_snapshot
- created_at

**Relationship:** Archive 1 : N Scrap

## 9.6 Journal

- journal_id
- archive_id
- content
- audio_type
- created_at
- updated_at

**Relationship:** Archive 1 : 0..1 Journal

**Constraint:** `archive_id` UNIQUE

전시 하나당 Journal 하나만 존재한다. 기존 Journal 수정 시 동일한 journal_id를 유지한다.

## 9.7 Digital Keepsake

- keepsake_id
- archive_id
- template_id
- content_data
- output_url 또는 output_data
- created_at
- updated_at

**Relationship:** Archive 1 : N Keepsake 또는 1 : 1 여부는 제품 정책에 따라 추후 확정한다.

## 9.8 Audio Configuration

- audio_config_id
- exhibition_id
- audio_provider
- playlist_url
- playlist_title
- ambience_enabled
- ambience_type
- created_at
- updated_at

`ambience_type`의 기본값은 `pink_noise`로 설정한다.

---

# 10. Content & System Requirements

## 10.1 Exhibition Content

전시 콘텐츠는 다음 정보를 기준으로 구성한다.

- Exhibition ID
- Exhibition Title
- Venue
- Exhibition Period
- Description
- Cover Image
- QR / URL
- Commentary Guide
- Scrap 대상 문장
- External Playlist 정보

전시 정보, 해설 문장, 플레이리스트는 전시 기획사 또는 전시 기관이 제공하는 콘텐츠를 기반으로 한다.

MVP에서는 별도 CMS를 구축 범위에 포함하지 않는다.

## 10.2 Persistence

- 사용자가 저장한 개인 기록은 계정과 연결한다.
- Archive는 사용자 및 전시 ID를 기준으로 관리한다.
- 반복 방문 시 기존 Archive를 재사용한다.
- Journal은 Archive당 하나만 저장한다.
- Journal 수정 시 기존 기록을 업데이트한다.
- Keepsake은 웹카드 데이터로 보관한다.
- PNG 다운로드는 저장된 웹카드의 콘텐츠를 기반으로 생성한다.

## 10.3 Privacy

- Journal은 기본적으로 비공개다.
- 개인 기록은 해당 사용자에게만 노출한다.
- 사용자가 Archive를 삭제하면 연결된 기록도 함께 삭제한다.
- 웹카드도 기본적으로 사용자 개인 Archive 안에서 관리한다.

---

# 11. Error & Empty States

## Home

- QR 카메라 권한 거부
- QR Scan 실패
- 유효하지 않은 전시 URL

## Authentication

- Google 로그인 취소
- 로그인 실패
- 인증 후 복귀 실패

## Exhibition

- 전시 정보 없음
- 전시 이미지 로딩 실패
- 전시 콘텐츠 접근 불가

## Scrap

- 문장 저장 실패
- 이미 저장된 문장
- 원본 가이드 문장 접근 불가

## Journal

- 저장 실패
- 임시 작성 내용 복구
- Journal이 아직 없는 상태

## Audio

- 외부 플레이리스트 링크 오류
- Apple Music 또는 Spotify 연결 실패
- Pink Noise 재생 실패
- 브라우저 오디오 재생 제한

## Digital Keepsake

- 템플릿 미리보기 실패
- 웹카드 저장 실패
- PNG 변환 실패
- PNG 다운로드 실패

## Archive

- Archive가 없는 상태
- 연결된 기록이 없는 상태
- Archive 삭제 실패

모든 오류 상태는 서비스의 미니멀한 UI 톤을 유지하면서 명확한 안내와 재시도 방법을 제공한다.

---

# 12. Non-Functional Requirements

## Usability

- 모바일 우선 설계
- QR 진입을 최소한의 단계로 제공
- 주요 기능은 명확한 텍스트 액션으로 표현
- 로그인 없이 가능한 기능과 로그인 후 가능한 기능을 구분
- Journal은 하나의 전시 안에서 쉽게 재접속하고 수정할 수 있도록 한다.

## Performance

- Home 및 Exhibition Guide의 빠른 로딩
- 이미지 최적화
- 모바일 네트워크 환경 고려
- Pink Noise 오디오 리소스 최적화
- PNG 생성 과정에서 UI가 멈추지 않도록 처리

## Security

- Google OAuth 기반 인증
- 사용자별 개인 기록 접근 제어
- 비인가 사용자의 개인 데이터 접근 방지
- Archive 및 연결된 데이터 삭제의 일관성 보장

## Responsive Design

- 모바일 화면 최적화
- 다양한 모바일 브라우저 대응
- 작은 화면에서도 콘텐츠 및 액션이 잘리지 않도록 설계
- 웹카드의 화면 비율 유지 및 PNG 출력 품질 보장

---

# 13. Main Screen Specifications

MVP의 주요 화면은 다음 9개를 기준으로 한다.

| No. | Screen | Primary Purpose |
| --- | --- | --- |
| 01 | Home / Logged Out | 브랜드 진입, Login, QR Scan |
| 02 | Home / Logged In | 로그인 사용자 진입 및 Archive 접근 |
| 03 | QR Scanner | QR 인식 및 전시 진입 |
| 04 | Exhibition Guide | 전시 콘텐츠 열람 및 문장 Scrap |
| 05 | Journal | 개인 감상 기록 및 Audio 선택 |
| 06 | Digital Keepsake | 웹카드 생성, 저장, PNG 다운로드 |
| 07 | My Archive Grid | 전시 기록 목록 |
| 08 | Archive Detail | 전시별 개인 기록 관리 |
| 09 | Account | 계정 및 설정 관리 |

## 13.1 Home / Logged Out

- 중앙 STILL Wordmark
- Login
- QR Scan
- 순수 화이트 배경
- 최소한의 텍스트와 넓은 여백

## 13.2 Home / Logged In

- STILL 브랜드
- My Archive 진입
- 전시 진입 액션

## 13.3 QR Scanner

- 카메라 스캔 영역
- QR 인식 가이드
- URL 직접 입력 진입

## 13.4 Exhibition Guide

- 전시명 및 기본 정보
- 대표 이미지
- 전시 소개
- 해설 콘텐츠
- Scrap 액션

## 13.5 Journal

- 전시별 단일 Journal 입력 영역
- 기존 Journal 불러오기
- 저장 및 수정
- External Playlist 또는 Pink Noise 제어
- Save Journal 액션

## 13.6 Digital Keepsake

- 웹카드 Preview
- Template Selection
- Save
- PNG Download

## 13.7 My Archive Grid

- 전시별 카드
- 대표 이미지
- 전시명
- Archive Detail 진입

## 13.8 Archive Detail

- 전시 정보
- Scrap 목록
- Journal
- Digital Keepsake
- Delete Archive

## 13.9 Account

- 사용자 정보
- Audio 설정
- Logout
- Account Deletion

---

# 14. MVP Acceptance Criteria

## Entry

- [ ]  Home에서 Login 및 QR Scan을 선택할 수 있다.
- [ ]  QR 코드로 전시 페이지에 진입할 수 있다.
- [ ]  URL을 통한 직접 진입이 가능하다.
- [ ]  비로그인 상태에서 전시 가이드를 열람할 수 있다.

## Authentication

- [ ]  Google OAuth가 정상 작동한다.
- [ ]  로그인 후 원래 실행하려던 저장 액션으로 복귀한다.
- [ ]  작성 중인 임시 데이터가 유실되지 않는다.

## Archive

- [ ]  로그인 사용자의 전시 진입 시 Archive가 생성된다.
- [ ]  동일 전시의 Archive가 중복 생성되지 않는다.
- [ ]  재방문 시 Last Visited가 갱신된다.

## Scrap

- [ ]  해설 가이드에 제공된 문장에 Scrap 액션이 표시된다.
- [ ]  로그인 사용자는 해당 문장을 저장할 수 있다.
- [ ]  저장된 문장은 해당 전시 Archive에 연결된다.
- [ ]  Archive Detail에서 저장한 문장을 다시 확인할 수 있다.

## Journal

- [ ]  전시 하나당 Journal 하나만 생성할 수 있다.
- [ ]  이미 Journal이 존재하면 기존 내용을 불러온다.
- [ ]  기존 Journal 내용을 수정하고 저장할 수 있다.
- [ ]  수정 시 동일한 Journal 레코드가 업데이트된다.

## Audio

- [ ]  전시별 External Playlist 정보를 표시할 수 있다.
- [ ]  Apple Music 또는 Spotify 링크로 이동할 수 있다.
- [ ]  External Playlist가 없을 경우 Pink Noise 옵션을 제공한다.
- [ ]  Pink Noise On 시 재생된다.
- [ ]  Off 시 재생이 중지된다.
- [ ]  No Audio 상태를 선택할 수 있다.

## Digital Keepsake

- [ ]  템플릿을 선택할 수 있다.
- [ ]  전시 정보 및 개인 기록이 웹카드에 반영된다.
- [ ]  웹카드를 저장할 수 있다.
- [ ]  저장한 웹카드를 다시 열 수 있다.
- [ ]  웹카드를 PNG로 다운로드할 수 있다.

## Management

- [ ]  Archive를 삭제할 수 있다.
- [ ]  삭제 시 연결된 Scrap, Journal, Keepsake도 삭제된다.
- [ ]  Logout이 정상 작동한다.

## UI

- [ ]  배경은 순수 화이트를 유지한다.
- [ ]  UI 컬러는 블랙과 화이트를 기본으로 한다.
- [ ]  그레이는 보조 텍스트에만 사용한다.
- [ ]  모바일 환경에서 주요 화면이 정상적으로 표시된다.

---

# 15. Remaining Decisions

다음은 아직 확정되지 않은 세부 정책이다.

1. **Scrap 중복 저장**
    - 동일한 문장을 한 번만 저장할 것인가?
    - 저장 해제 및 재저장을 허용할 것인가?
2. **Digital Keepsake 개수**
    - 전시 하나당 하나만 생성할 것인가?
    - 여러 템플릿을 선택해 복수의 웹카드를 보관할 수 있는가?
3. **Digital Keepsake 콘텐츠**
    - Journal 전체를 넣을 것인가?
    - Journal 중 사용자가 선택한 일부 문장만 넣을 것인가?
    - Scrap 문장은 몇 개까지 반영할 것인가?
4. **External Playlist 운영**
    - 전시 기관이 제공한 링크를 어떤 방식으로 STILL에 등록할 것인가?
    - MVP에서 운영자가 직접 설정하는 방식으로 진행할 것인가?
5. **Pink Noise 동작 범위**
    - Journal 화면에서만 제공할 것인가?
    - 전시 가이드 화면에서도 제공할 것인가?
    - 화면 이동 시 재생을 유지할 것인가?
6. **Account Deletion**
    - 계정 삭제 시 모든 Archive와 개인 기록을 함께 삭제할 것인가?
    - 삭제 완료 및 재가입 정책은 어떻게 할 것인가?

---

# 16. Product Summary

STILL은 전시를 관람하는 순간을 넘어, 그 경험이 개인의 삶에 남을 수 있도록 돕는 서비스다.

사용자는 전시장 QR 코드를 통해 전시에 진입하고, 전시를 경험하며, 해설 가이드에서 문장을 수집하고, 자신의 생각을 기록한다.

전시별 Journal은 하나의 기록으로 유지되며, 사용자는 필요할 때 내용을 다시 열어 수정할 수 있다.

전시 기관이 제공하는 플레이리스트를 들을 수도 있고, 별도 음악이 없는 경우 Pink Noise 기반 STILL Ambience를 선택할 수도 있다.

이 모든 경험은 개인의 Archive에 축적된다.

Digital Keepsake은 웹카드로 보관되며 PNG 이미지로도 소장할 수 있다.

STILL이 제공하는 것은 단순한 전시 정보가 아니다.

전시가 끝난 후에도 다시 꺼내 볼 수 있는 개인의 기억이다.

**STILL — Art stays with you.**