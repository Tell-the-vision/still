# Gemini 요청 덤프 — PDF e-book → 웹뷰 실험 (`run-pdf.mjs`)

실행: `node run-pdf.mjs pdf pdf\hirst-ebook.segments.json results-pdf` (모델 `gemini-2.5-flash`, 엔드포인트 `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=…`, `temperature: 0`, `maxOutputTokens: 65536`).
모든 호출은 같은 system instruction을 쓰고, 세 가지 프롬프트 템플릿(A/B/C)이 있습니다. 아래는 실제로 보낸 payload(2쪽, 1섹션 예시 — 이미지 base64만 생략)입니다.
`node run-pdf.mjs … --dump --dry` 로 모든 호출의 payload를 `results/requests/*.json`에 호출 없이 저장할 수 있습니다.

## 0. System instruction (모든 호출 공통)

```
You are a conversion engine, not a writer. You never paraphrase, summarise, translate, correct, or add text. Every character of the author's text must be reproduced exactly as given (same wording, punctuation, line order). Output only the requested format.
```

## 1. Pass A — 구조화 (페이지 텍스트 줄 → 역할 JSON). `responseMimeType: application/json`

템플릿 (`${…}`는 치환 변수):
```
This is page ${pg.n} of ${pagesAll.length} of an exhibition guide e-book (A5, ${pg.w}×${pg.h} pt). Below are its text lines in reading order, with y position (pt from top), x, and font size.

Group the lines into blocks and label each block. Return JSON:
{"page": ${pg.n}, "blocks": [{"role": "title|heading|subheading|body|toc|caption|footer|pagenum|other", "lines": [line numbers], "text": "<the lines joined exactly as printed, in order>"}]}

Rules:
- "text" must be the verbatim concatenation of those lines. A line that ends mid-word was a wrapped word: join with no space. A line that ends with a space was a word break: keep the space. Never add, drop, reorder, or fix characters.
- Running footers (same tiny text on every page) → role "footer". Page numbers → "pagenum".
- Keep the source language (Korean). No commentary.

LINES:
${linesBlock(pg)}
```

실제 payload (2쪽):
```json
{
  "endpoint": "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=<GEMINI_KEY>",
  "body": {
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "This is page 2 of 29 of an exhibition guide e-book (A5, 420×595 pt). Below are its text lines in reading order, with y position (pt from top), x, and font size.\n\nGroup the lines into blocks and label each block. Return JSON:\n{\"page\": 2, \"blocks\": [{\"role\": \"title|heading|subheading|body|toc|caption|footer|pagenum|other\", \"lines\": [line numbers], \"text\": \"<the lines joined exactly as printed, in order>\"}]}\n\nRules:\n- \"text\" must be the verbatim concatenation of those lines. A line that ends mid-word was a wrapped word: join with no space. A line that ends with a space was a word break: keep the space. Never add, drop, reorder, or fix characters.\n- Running footers (same tiny text on every page) → role \"footer\". Page numbers → \"pagenum\".\n- Keep the source language (Korean). No commentary.\n\nLINES:\n  1 | y=23 x=13 size=36 | 목차\n  2 | y=140 x=67 size=13 | 전시 소개\n\n  3 | y=160 x=79 size=13 | 작가 소개\n\n  4 | y=180 x=79 size=13 | 작가의 예술을 이해하는 다섯 가지 키워드\n\n  5 | y=200 x=79 size=13 | 주요 작품 살펴보기\n\n  6 | y=220 x=98 size=13 | 살아 있는 자의 마음속 죽음의 물리적 불가능성\n\n  7 | y=240 x=98 size=13 | 천 년\n\n  8 | y=260 x=98 size=13 | 스팟 페인팅\n\n  9 | y=280 x=98 size=13 | 신의 사랑을 위하여\n\n 10 | y=300 x=98 size=13 | 약장 시리즈\n\n 11 | y=320 x=98 size=13 | 스핀 페인팅\n\n 12 | y=340 x=79 size=13 | 전시 공간별 해설\n\n 13 | y=360 x=98 size=13 | 3전시실 — 모든 질문에는 의심이 따른다\n\n 14 | y=380 x=98 size=13 | 4전시실 — 우리는 시간 속에 산다\n\n 15 | y=400 x=98 size=13 | 5전시실 — 침묵의 사치\n\n 16 | y=420 x=79 size=13 | 작품 세계와 감상의 확장\n\n 17 | y=440 x=79 size=13 | 전시를 마치며\n 18 | y=579 x=260 size=6 | STILL DIGITAL EXHIBITION GUIDE · DEMO EDITION"
          }
        ]
      }
    ],
    "systemInstruction": {
      "parts": [
        {
          "text": "You are a conversion engine, not a writer. You never paraphrase, summarise, translate, correct, or add text. Every character of the author's text must be reproduced exactly as given (same wording, punctuation, line order). Output only the requested format."
        }
      ]
    },
    "generationConfig": {
      "temperature": 0,
      "maxOutputTokens": 65536,
      "responseMimeType": "application/json"
    }
  }
}
```

실제 응답 (2쪽):
```json
{
  "page": 2,
  "blocks": [
    {
      "role": "title",
      "lines": [
        1
      ],
      "text": "목차"
    },
    {
      "role": "toc",
      "lines": [
        2
      ],
      "text": "전시 소개"
    },
    {
      "role": "toc",
      "lines": [
        3
      ],
      "text": "작가 소개"
    },
    {
      "role": "toc",
      "lines": [
        4
      ],
      "text": "작가의 예술을 이해하는 다섯 가지 키워드"
    },
    {
      "role": "toc",
      "lines": [
        5
      ],
      "text": "주요 작품 살펴보기"
    },
    {
      "role": "toc",
      "lines": [
        6
      ],
      "text": "살아 있는 자의 마음속 죽음의 물리적 불가능성"
    },
    {
      "role": "toc",
      "lines": [
        7
      ],
      "text": "천 년"
    },
    {
      "role": "toc",
      "lines": [
        8
      ],
      "text": "스팟 페인팅"
    },
    {
      "role": "toc",
      "lines": [
        9
      ],
      "text": "신의 사랑을 위하여"
    },
    {
      "role": "toc",
      "lines": [
        10
      ],
      "text": "약장 시리즈"
    },
    {
      "role": "toc",
      "lines": [
        11
      ],
      "text": "스핀 페인팅"
    },
    {
      "role": "toc",
      "lines": [
        12
      ],
      "text": "전시 공간별 해설"
    },
    {
      "role": "toc",
      "lines": [
        13
      ],
      "text": "3전시실 — 모든 질문에는 의심이 따른다"
    },
    {
      "role": "toc",
      "lines": [
        14
      ],
      "text": "4전시실 — 우리는 시간 속에 산다"
    },
    {
      "role": "toc",
      "lines": [
        15
      ],
      "text": "5전시실 — 침묵의 사치"
    },
    {
      "role": "toc",
      "lines": [
        16
      ],
      "text": "작품 세계와 감상의 확장"
    },
    {
      "role": "toc",
      "lines": [
        17
      ],
      "text": "전시를 마치며"
    },
    {
      "role": "footer",
      "lines": [
        18
      ],
      "text": "STILL DIGITAL EXHIBITION GUIDE · DEMO EDITION"
    }
  ]
}
```

## 2. Pass B — 리플로우 (파서 segments → HTML `<section>`)

템플릿:
```
Write ONE <section> of a mobile reading page for this part of an exhibition guide.

Rules:
- Output only the <section>…</section> fragment. No <html>/<head>/<body>, no markdown fences, no explanations.
- Reproduce ALL text verbatim in order. Do not paraphrase, shorten, translate, or add words. Keep Korean.
- Map roles: [h1]/[h2] → h2/h3, [body] → p, [small] → p class="small", [display] → p class="display", [h3] → h4.
- Wrap each body sentence in <span class="s"> (split only at sentence ends: . ? !). No inline styles.

SOURCE:
${src}
```

실제 payload (1번 섹션):
```json
{
  "endpoint": "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=<GEMINI_KEY>",
  "body": {
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Write ONE <section> of a mobile reading page for this part of an exhibition guide.\n\nRules:\n- Output only the <section>…</section> fragment. No <html>/<head>/<body>, no markdown fences, no explanations.\n- Reproduce ALL text verbatim in order. Do not paraphrase, shorten, translate, or add words. Keep Korean.\n- Map roles: [h1]/[h2] → h2/h3, [body] → p, [small] → p class=\"small\", [display] → p class=\"display\", [h3] → h4.\n- Wrap each body sentence in <span class=\"s\"> (split only at sentence ends: . ? !). No inline styles.\n\nSOURCE:\n[display] 데이미안 허스트\n\n[display] LIFE, DEATH & EVERYTHING IN BETWEEN\n\n[display] 삶과 죽음, 그 사이의 모든 것\n\n[display] 국립현대미술관 서울 전시 기간: 2026.03.20 — 2026.06.28"
          }
        ]
      }
    ],
    "systemInstruction": {
      "parts": [
        {
          "text": "You are a conversion engine, not a writer. You never paraphrase, summarise, translate, correct, or add text. Every character of the author's text must be reproduced exactly as given (same wording, punctuation, line order). Output only the requested format."
        }
      ]
    },
    "generationConfig": {
      "temperature": 0,
      "maxOutputTokens": 65536
    }
  }
}
```

## 3. Pass C — 레이아웃 (페이지 이미지 + 텍스트 줄 → 페이지 HTML/CSS). 멀티모달: `parts[0]`가 PNG inlineData, `parts[1]`가 텍스트

템플릿:
```
You are given an image of one A5 page (${pg.w}×${pg.h} pt) from an exhibition guide e-book, plus its text lines with positions.
Rebuild this page as HTML + CSS so that it looks as close as possible to the image when rendered in a ${pg.w}×${pg.h} px box.

Rules:
- Output only one <div class="page" style="position:relative;width:${pg.w}px;height:${pg.h}px;overflow:hidden;background:#fff">…</div>. No markdown fences, no explanation.
- Use the text EXACTLY as given in the lines (verbatim, same line breaks). Every line must appear once. Do not add text that is not in the lines (e.g. do not type what you see if it is not listed).
- Position elements with absolute coordinates (px = pt here). Reproduce rules/lines, font sizes, weights, and the running footer. Font-family: 'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif.
- Korean text must not be re-wrapped: use white-space:pre on each line or one element per line.

LINES:
${linesBlock(pg)}
```

실제 payload (2쪽, 이미지 base64 생략):
```json
{
  "endpoint": "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=<GEMINI_KEY>",
  "body": {
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "inlineData": {
              "mimeType": "image/png",
              "data": "<base64 png, 73608 chars omitted>"
            }
          },
          {
            "text": "You are given an image of one A5 page (420×595 pt) from an exhibition guide e-book, plus its text lines with positions.\nRebuild this page as HTML + CSS so that it looks as close as possible to the image when rendered in a 420×595 px box.\n\nRules:\n- Output only one <div class=\"page\" style=\"position:relative;width:420px;height:595px;overflow:hidden;background:#fff\">…</div>. No markdown fences, no explanation.\n- Use the text EXACTLY as given in the lines (verbatim, same line breaks). Every line must appear once. Do not add text that is not in the lines (e.g. do not type what you see if it is not listed).\n- Position elements with absolute coordinates (px = pt here). Reproduce rules/lines, font sizes, weights, and the running footer. Font-family: 'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif.\n- Korean text must not be re-wrapped: use white-space:pre on each line or one element per line.\n\nLINES:\n  1 | y=23 x=13 size=36 | 목차\n  2 | y=140 x=67 size=13 | 전시 소개\n\n  3 | y=160 x=79 size=13 | 작가 소개\n\n  4 | y=180 x=79 size=13 | 작가의 예술을 이해하는 다섯 가지 키워드\n\n  5 | y=200 x=79 size=13 | 주요 작품 살펴보기\n\n  6 | y=220 x=98 size=13 | 살아 있는 자의 마음속 죽음의 물리적 불가능성\n\n  7 | y=240 x=98 size=13 | 천 년\n\n  8 | y=260 x=98 size=13 | 스팟 페인팅\n\n  9 | y=280 x=98 size=13 | 신의 사랑을 위하여\n\n 10 | y=300 x=98 size=13 | 약장 시리즈\n\n 11 | y=320 x=98 size=13 | 스핀 페인팅\n\n 12 | y=340 x=79 size=13 | 전시 공간별 해설\n\n 13 | y=360 x=98 size=13 | 3전시실 — 모든 질문에는 의심이 따른다\n\n 14 | y=380 x=98 size=13 | 4전시실 — 우리는 시간 속에 산다\n\n 15 | y=400 x=98 size=13 | 5전시실 — 침묵의 사치\n\n 16 | y=420 x=79 size=13 | 작품 세계와 감상의 확장\n\n 17 | y=440 x=79 size=13 | 전시를 마치며\n 18 | y=579 x=260 size=6 | STILL DIGITAL EXHIBITION GUIDE · DEMO EDITION"
          }
        ]
      }
    ],
    "systemInstruction": {
      "parts": [
        {
          "text": "You are a conversion engine, not a writer. You never paraphrase, summarise, translate, correct, or add text. Every character of the author's text must be reproduced exactly as given (same wording, punctuation, line order). Output only the requested format."
        }
      ]
    },
    "generationConfig": {
      "temperature": 0,
      "maxOutputTokens": 65536
    }
  }
}
```

## 4. 결과 요약 (results-pdf/metrics.json)

| pass | 단위 | 문자 유사도 | 문장 커버리지 | 토큰(in/out) | 시간 |
| --- | --- | --- | --- | --- | --- |
| A 구조화 | 3 쪽 | 0.996 | 1.000 | 2484 / 1696 | 29s |
| B 리플로우 | 20 섹션 | 1.000 | 1.000 | 15501 / 13986 | 251s |
| C 레이아웃 | 3 쪽 | 0.954 | 1.000 | 3348 / 3353 | 46s |

C에서 "추가"로 잡힌 문장은 목차의 `1. 2. 3.`과 `•` — PDF 텍스트 레이어에는 없고 이미지에만 있던 것을 모델이 복원한 것입니다.
