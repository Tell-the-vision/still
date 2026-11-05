# 문서 → 모바일 웹뷰 실험: 추가·수정 사항 정리 (GitHub `PRD/experiments` 기준)

작성: 채정윤 · 2026-11-05 · 폴더 `ebook-exp/`

`PRD/experiments`에 있는 것은 `parse_pdf.py`(PDF → segments), `export_ebook_pdf.py`(Figma → PDF), `gen/`(엣지 케이스 생성기), `samples/`, `out/hirst-ebook.segments.*` 입니다. 아래는 **거기에 없는 것**과 **기존 로직을 바꾼 것**만 적었습니다. 실험 수치·결론은 `FINDINGS.md`, Gemini 프롬프트와 실제 payload는 `GEMINI-PROMPTS.md`에 있습니다.

## 1. 파이프라인 한눈에

```
PDF ─ extract.py ─▶ pages.json (줄 좌표·크기·색·굵기, 벡터 도형, 이미지 배치), png/, svg/, img/, fonts.json
   ├ columns.py ─▶ *.columns.json   parse_pdf.py 호환 segments, 단(column) 순서로   ← 기존 파서 수정판
   ├ build_mobile.py ─▶ mobile.html  ★ 목표물: 모바일 리플로우, 디자인 보존, 모델 없음
   ├ build.py ─▶ view-css.html / view-raster.html / view-reflow.html   ("원본 그대로" 검증·보조용)
   ├ measure.mjs ─▶ visual.json      Playwright로 페이지 스크린샷 ↔ PDF 래스터 픽셀 비교
   └ run-pdf.mjs ─▶ results/         Gemini A(구조화)·B(리플로우)·C(레이아웃) + 원문 보존율 metrics.json
EPUB ─ parse.mjs ─▶ parsed.json, baseline.html  (zip 직접 해석, npm 의존성 없음) ─ run.mjs ─▶ Gemini A/B
```

## 2. 새로 만든 파일

| 파일 | 역할 | 비고 |
| --- | --- | --- |
| `extract.py` | PyMuPDF로 페이지별 **줄 단위** 텍스트(x,y,w,h,size,bold,color), 벡터 도형 사각형, **이미지 배치 좌표**(`get_image_info`)와 원본 바이트, 페이지 PNG(144dpi)·SVG(글리프→패스), 폰트 이름 목록 | `parse_pdf.py`는 텍스트만 다룸. 레이아웃·이미지·색은 여기서 나옴 |
| `columns.py` | `parse_pdf.py`의 규칙(크기→역할, 반복 텍스트 제거, 문단 조립)을 유지하되 아래 3절의 수정 적용. 출력 형식 호환(`segments[].id/page/role/text/sentences`) + `col` 필드 추가 | 기존 파서를 대체 가능 |
| `build_mobile.py` | **모바일 리플로우 빌더.** 모델 없이 PDF의 디자인 정보로 폰 화면 재조판: 본문 크기·색 자동 판정, 강조색(명도 < 0.55인 비본문색 중 최다) 유지, 서체 계열(세리프/산세리프)을 폰트명에서 판정, 큰 사진은 전폭 figure + 사진 위 흰 글씨는 오버레이 캡션, 작은 이미지는 y가 가장 가까운 아래 블록 앞에 삽입(썸네일–항목 짝), 연도로 시작하는 줄은 `<dl>` 리스트, 반복 머리글·쪽번호 제거 | 결과 예: `screens/*.mobile.html` |
| `build.py` | 같은 데이터로 3가지 "원본 복원" 뷰. B(CSS 절대좌표)는 줄마다 PDF의 원래 폭에 맞춰 `scaleX`(대체 폰트 자간 차이 보정) | 뷰어 모듈 필요성 검증용 |
| `measure.mjs`, `shots.mjs` | 페이지별 스크린샷 ↔ PDF PNG 픽셀 유사도·잉크 IoU, 폰 화면 4컷 캡처 | 수치는 `FINDINGS.md` 2절 |
| `parse.mjs`, `run.mjs` | EPUB 파서(zip·OPF·spine·NCX/nav·CSS·이미지 인라인)와 Gemini A/B 러너 | 샘플이 PDF라 실험은 PDF 경로로 진행 |
| `lib.mjs` | Gemini 호출(AI Studio/Vertex 엔드포인트 자동, `GEMINI_API=ais|vertex`, 재시도), 원문 보존율 계산(문자 유사도·문장 커버리지·누락/추가 문장) | `--dump --dry`로 payload만 저장 가능 |
| `run-pdf.mjs` | PDF용 Gemini 3패스. 모든 호출에 "원문 그대로, 재작성 금지" system instruction | 프롬프트 전문은 `GEMINI-PROMPTS.md` |
| `FINDINGS.md`, `GEMINI-PROMPTS.md` | 결론·수치 / 프롬프트·payload 덤프 | |

## 3. `parse_pdf.py` 대비 바꾼 로직 (`columns.py`)

| 문제 (실제 전시 PDF에서 발견) | 기존 | 수정 |
| --- | --- | --- |
| 다단 본문이 줄 단위로 섞임 (3단 영문·2단 국문) | 페이지 전체를 y로 정렬 | 텍스트 블록을 **왼쪽 가장자리로 단(column) 클러스터링** → 단 순서로, 단 안에서 y 순서로 |
| 국문 문단이 줄마다 끊김 | 크기 6.4/6.9가 번갈아 나와 역할이 바뀜 (라틴·CJK 폰트 혼용) | 본문 크기 **±0.6pt 밴드**는 모두 본문 |
| 연도 "1986", "1993"이 사라짐 | 반복 텍스트를 *출현 횟수*로 셈 | **페이지 수**로 셈 (한 페이지 안 반복은 무시) |
| 문단 경계 | 블록 경계 의존 (InDesign은 줄마다 블록) | **줄 간격**(> 0.9×줄높이) 또는 역할 변화로 문단 분리 |
| 쪽번호 `- 1 -`, `13 / 14`, `Page 5 of 15` | 본문에 섞임 | 페이지 상·하단 12%의 숫자 패턴 제거 (`build_mobile.py`) |

아직 미해결: 같은 연도에 여러 줄인 리스트의 들여쓰기, 본문과 크기가 같은 소제목, 매 페이지 반복되는 사이드바(1회는 보여야 함), 세로쓰기·회전 텍스트, 투명 PNG 로고.

## 4. Gemini 사용 방식 (요약)

- 공통 system instruction: 변환 엔진이지 작가가 아니다 / 의역·요약·번역·수정·추가 금지 / 요청 형식만 출력.
- **A 구조화**: 페이지의 줄 목록(번호·y·x·크기) → `{page, blocks:[{role, lines:[번호], text}]}` JSON. 역할: title/heading/subheading/body/toc/caption/footer/pagenum.
- **B 리플로우**: 파서 segments(역할 태그 포함) → `<section>` 하나. 역할→태그 매핑 고정, 문장마다 `<span class="s">`.
- **C 레이아웃(비전)**: 페이지 PNG + 줄 목록 → 420×595 절대좌표 HTML. 줄 밖 텍스트 추가 금지, 이미지에서 본 번호·불릿은 복원됨.
- 측정: 출력 텍스트를 파서 텍스트와 대조(문자 유사도, 문장 커버리지, 누락/추가 문장 목록).
- 결과: A 0.996/1.000, B 1.000/1.000(20섹션), C 0.954/1.000(추가분 = 목차 번호·불릿). 29쪽 전체 ≈ 58호출·8분·15만 토큰.
- 제안: 모델은 글자를 쓰지 않고 **segment id만 배치/역할 판정**하는 "보정 패스" 한 번으로 축소. 글자는 파서가 책임.

## 5. 실행

```bat
pip install pymupdf
python extract.py <in.pdf> <outdir>
python columns.py <in.pdf> <outdir>\doc.columns.json
python build_mobile.py <outdir> <outdir>\mobile.html          :: 모바일 화면
python build.py <outdir> <outdir>\doc.columns.json . <outdir>\views   :: 원본 복원 3종(선택)
node run-pdf.mjs <outdir> <outdir>\doc.columns.json results --pages 1-3   :: Gemini (키는 .key 또는 GEMINI_KEY, GEMINI_API=ais)
```

## 6. 같이 넘길 파일

- 코드: 위 표의 `.py`/`.mjs` 전부 (작음)
- 문서: `HANDOFF.md`(이 파일), `FINDINGS.md`, `GEMINI-PROMPTS.md`, `gemini-requests.zip`
- 결과 예시: `screens/*.compare.png` 7장 (PDF↔모바일 비교), `results-pdf/metrics.json`
- HTML은 용량이 커서(최대 11MB) 대표 2개만: `screens/real-can-i-see-you.mobile.html`, `screens/real-manet.mobile.html`
- 제외: `pdf/`(추출 산출물, 재생성 가능), `samples-real/`(저작물, 링크만 공유), `.key`
