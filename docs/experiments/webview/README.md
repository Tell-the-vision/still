# EBOOK → WebView 변환 실험 (기본 파서 + Gemini)

작가가 작품 설명을 EBOOK(EPUB)으로 주면, 그걸 **기본 파서**로 구조화하고 **Gemini**로 웹페이지를 구성했을 때
원본(문장·순서·이미지·스타일)이 WebView에서 얼마나 보존되는지 재는 실험입니다. npm 설치 없이 Node만 있으면 됩니다.

## 실행

```bat
cd ebook-exp
node run.mjs <샘플 폴더 또는 파일> results
```

- Gemini 키는 같은 폴더의 `.key` 파일(`GEMINI_KEY=...`) 또는 환경변수 `GEMINI_KEY`에서 읽습니다. (`.key`는 .gitignore 처리)
- `--no-gemini`를 붙이면 파서만 돌립니다. `--model gemini-2.5-pro`처럼 모델을 바꿀 수 있습니다.
- 지원 입력: `.epub`, `.html`, `.md`, `.txt` (PDF/DOCX는 아직 아님)

## 결과물 (`results/<샘플이름>/`)

| 파일 | 내용 |
| --- | --- |
| `parsed.json` | 파서 출력: 메타데이터, 챕터 순서(spine), 챕터별 HTML/본문 텍스트, 이미지·CSS 목록 |
| `baseline.html` | **AI 없이** 파서만으로 만든 WebView 페이지. 원본 마크업 유지, CSS와 이미지를 인라인. = 기준점(ground truth) |
| `A-structure.json` / `A-structure.html` | **Pass A**: Gemini가 챕터를 구조화 JSON(블록 + 문장 목록, 원문 그대로)으로 변환 → 우리가 결정적으로 HTML 렌더 |
| `B-render.html` | **Pass B**: Gemini가 직접 WebView용 HTML `<section>`을 작성 |
| `metrics.json` | A/B 각각 원문 대비 보존율 (문자 유사도, 문장 커버리지, 누락·변형 문장, 토큰, 소요 시간) |

`results/report.md`에 샘플별 요약이 모입니다.

## 보는 법

- `charSimilarity` 1.0 = 글자 단위로 원문과 동일. `sentenceCoverage` 1.0 = 원문 문장이 모두 들어 있음.
- `missingSentences` / `addedSentences`에 빠지거나 바뀐 문장이 그대로 찍히니, Gemini가 어디서 손을 댔는지 바로 보입니다.
- `baseline.html`, `A-structure.html`, `B-render.html` 세 파일을 휴대폰(또는 Chrome 모바일 모드)에서 나란히 열어 보면 레이아웃 차이를 눈으로 비교할 수 있습니다.

## 구조 요약

```
EPUB ──(parse.mjs: zip → OPF spine → 챕터 XHTML, CSS, 이미지)──▶ parsed.json + baseline.html
                                                       │
                                     ┌─────────────────┴─────────────────┐
                              Pass A: Gemini → JSON             Pass B: Gemini → HTML
                              (문장은 verbatim 제약)              (verbatim 제약 + 이미지 placeholder)
                                     │                                   │
                              A-structure.html                     B-render.html
                                     └──────── fidelity 비교 (vs parsed.json 텍스트) ────────┘
```

---

## PDF e-book (hirst-ebook.pdf) 실험 — 원본 복원 우선

샘플의 원본은 EPUB이 아니라 Figma에서 내보낸 29쪽 A5 PDF라서, PDF용 경로를 따로 만들었습니다.

| 단계 | 파일 | 하는 일 |
| --- | --- | --- |
| 추출 | `extract.py` (PyMuPDF) | 페이지별 텍스트 줄(좌표·크기·굵기), 벡터 도형, 페이지 SVG/PNG → `pdf/pages.json`, `pdf/png/` |
| 복원 A | `build.py` → `pdf-build/view-raster.html` | 페이지 래스터 + 투명 텍스트 레이어(선택 가능). pdf.js가 하는 방식을 라이브러리 없이 |
| 복원 B | `pdf-build/view-css.html` | 줄 단위 절대 좌표 + 웹폰트(Pretendard) + 괘선. **"CSS만으로 복원" 검증용** |
| 복원 C | `pdf-build/view-reflow.html` | 일영님 `parse_pdf.py`의 segments → 반응형 읽기 페이지(문장 span 포함) |
| 측정 | `measure.mjs` (Playwright) | B를 페이지별 스크린샷해 PDF 래스터와 픽셀/잉크 비교 → `pdf-build/visual.json`, `shots/` |
| Gemini | `run-pdf.mjs` | A 구조화(줄→역할 JSON) · B 리플로우(segments→HTML) · C 레이아웃(페이지 이미지+줄→HTML/CSS) + 원문 보존율 |

Gemini 패스 실행 (Windows, 키는 `.key`):

```bat
node run-pdf.mjs pdf pdf\hirst-ebook.segments.json results-pdf
node run-pdf.mjs pdf pdf\hirst-ebook.segments.json results-pdf --pages 1-5,13   (일부 페이지만)
```
