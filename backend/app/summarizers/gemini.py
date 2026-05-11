import os

import google.generativeai as genai

from .base import BaseSummarizer

PROMPT_TEMPLATE = """다음은 '{title}' 논문의 전문입니다.

{full_text}

---
이 논문을 의학 지식이 전혀 없는 일반인이 이해할 수 있도록 한국어로 요약해주세요.
독자는 의학 용어를 전혀 모르는 일반인이므로, 전문용어 사용 시 반드시 쉬운 비유로 설명하세요.
반드시 아래 8섹션 형식으로 작성하세요:

## 한 줄 핵심
(논문의 핵심을 단 한 문장으로 — 뉴스 헤드라인처럼)

## 왜 이 연구를 했나
(연구 배경과 동기를 3~5문장으로. "기존에는 ~라고 알려져 있었는데, 이 논문은 ~을 밝히려 했다")

## 어떻게 연구했나
(연구 방법을 쉬운 말로 4~6문장. 참가자 수, 실험 기간, 측정 방법 등 구체적으로)

## 무엇을 발견했나
(핵심 결과를 5~8문장으로. 숫자가 있으면 숫자도 포함. "A그룹은 B그룹보다 ~% 높았다"처럼)

## 어려운 용어 풀이
(논문에 나오는 전문용어 3~5개를 골라 일상 비유로 설명. 형식: **용어**: 설명)

## 내 삶에서의 의미
(이 연구 결과가 일상생활에 왜 중요한지 3~5문장)

## 오늘부터 실천하는 방법
1. (구체적 행동 — 언제, 어떻게, 얼마나)
2. (구체적 행동)
3. (구체적 행동)

## 주의할 점
(이 연구의 한계나 주의사항 2~3문장)"""


class GeminiSummarizer(BaseSummarizer):
    def __init__(self, model: str = "gemini-2.0-flash"):
        self.model = model
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])

    def summarize(self, full_text: str, topic: str, title: str) -> str:
        if len(full_text) > 50000:
            full_text = full_text[:40000] + "\n...[중략]...\n" + full_text[-5000:]
        prompt = PROMPT_TEMPLATE.format(title=title, full_text=full_text)
        model = genai.GenerativeModel(self.model)
        return model.generate_content(prompt).text
