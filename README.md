# STILL — Art stays with you.

전시를 관람하는 순간뿐 아니라 전시가 끝난 뒤에도 감상과 기억이 남도록 돕는 **개인화 전시 경험 아카이브**입니다.
STILL은 관람객의 기억이 머무는 공간을 지향합니다.

[SPEC](https://github.com/Tell-the-vision/PRD/blob/main/docs/SPEC.md) · [AGENTS.md](./AGENTS.md)

<table align="center">
  <tr>
    <td align="center"><img src=".github/readme/02-home.png" width="140" alt="Home" /><br /><sub>Home</sub></td>
    <td align="center"><img src=".github/readme/04-exhibition-guide.png" width="140" alt="Exhibition Guide" /><br /><sub>Exhibition Guide</sub></td>
    <td align="center"><img src=".github/readme/05-journal.png" width="140" alt="Journal" /><br /><sub>Journal</sub></td>
    <td align="center"><img src=".github/readme/06-keepsake-view.png" width="140" alt="Keepsake" /><br /><sub>Keepsake</sub></td>
    <td align="center"><img src=".github/readme/07-archive.png" width="140" alt="Archive" /><br /><sub>Archive</sub></td>
  </tr>
</table>

## 제품 컨셉

**QR/URL → Exhibition Guide(로그인 시 Archive 등록) → Scrap · Journal → Archive Detail → Digital Keepsake(PNG)**

1. 전시장 QR 또는 URL로 진입해 해설 가이드를 봅니다.
2. 인상 깊은 해설 문장을 **Scrap**으로 저장합니다. 임의 문장 입력은 없습니다.
3. 전시별 **Journal**을 씁니다.
4. Archive Detail에서 **Digital Keepsake**를 만듭니다. 전시 커버 이미지와 전시 정보, 개인 기록(Scrap·Journal 발췌)을 담은 흑백 웹카드를 저장한 뒤 PNG로 소장합니다. 진입점과 세부는 미결정 3·4·5·6입니다.
5. 모든 기록은 전시별 **Archive**에 쌓입니다.

Audio(External Playlist / Pink Noise / NO AUDIO, P1)는 Guide와 Journal에 있습니다. Pink Noise는 Journal에서만, 기본 Off입니다.
웹(설치 불필요)과 iOS/Android 앱을 지원하며, 같은 QR URL, 계정, 데이터를 씁니다.
범위 밖: 소셜·공유, 결제, 관리자 CMS UI, 생성형 AI 카드 이미지(로드맵), 3D/VR.

## 디자인 결정

- **Minimal / Editorial / Monochrome.** White `#FFFFFF`, Black `#000000`, 보조 텍스트만 Gray `#666666`.
- 유채색, 그림자, 그라데이션, 장식 없이 여백과 얇은 구분선을 씁니다.
- 서체: Display는 Futura(없으면 Montserrat), Body/UI는 DM Sans. 한글 서체는 미결정입니다.
- 기준 화면은 **390 × 844**. 하단 탭은 HOME · ARCHIVE · ACCOUNT(01 제외).
- 화면: 01 Home(Logged Out) · 02 Home(Logged In) · 03 QR Scanner · 04 Exhibition Guide · 05 Journal · 06 Digital Keepsake · 07 My Archive Grid · 08 Archive Detail · 09 Account
- UI 라벨은 영어, 전시 콘텐츠는 기관이 제공한 언어 그대로 표시합니다 (Figma 기준, 한국어 UI는 미결정 21).

## 핵심 규칙

- **Guest**는 Home, QR, Exhibition Guide, Audio 재생·선택을 쓰고 Journal은 로컬 Draft까지 씁니다. Save하면 로그인 후 Draft가 한 번 저장됩니다 (열 때 로그인 여부는 미결정 11).
- 그 밖의 기록 기능과 Audio Settings는 로그인(MVP는 Google)이 필요하고, 로그인 후 하던 동작을 이어갑니다.
- 첫 로그인 시 약관·방침 동의, 개인 기록은 본인에게만 보이며, 앱·웹에서 계정 삭제 시 모든 기록이 삭제됩니다 (세부는 미결정 12·13).
- Scrap 저장과 해제는 **멱등**입니다.
- Guide에서 한 번 Saved된 문장은 Saved로 유지되고, 해제는 Archive Detail에서만 합니다.
- Scrap 문장과 Keepsake의 개인 기록은 저장 시점의 **스냅샷**입니다. 전시 정보와 커버 이미지는 현재 값을 씁니다.
- Archive, Journal, Keepsake는 전시당 사용자별 하나입니다.
- Archive를 삭제하면 Scrap, Journal, Keepsake도 함께 삭제됩니다.

## 실행

```bash
npm install
npm run dev
```
