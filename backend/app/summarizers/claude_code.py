import subprocess

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
(연구 방법을 쉬운 말로 7~10문장. 반드시 포함: 참가자 수와 특징, 실험 그룹 구성, 실험 기간, 측정 방법과 도구, 어떤 조건에서 비교했는지. 전문용어는 일상어로 풀어서 설명.)

## 무엇을 발견했나
(핵심 결과를 8~12문장으로 상세히. 반드시 포함: 주요 수치와 통계 결과, 그룹 간 비교 ("A그룹은 B그룹보다 ~% 높았다"), 예상과 달랐던 결과, 부가적으로 발견된 내용. 숫자와 구체적 수치를 최대한 포함.)

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


class ClaudeCodeSummarizer(BaseSummarizer):
    def __init__(self, model: str = "sonnet"):
        self.model = model

    def summarize(self, full_text: str, topic: str, title: str) -> str:
        if len(full_text) > 50000:
            full_text = full_text[:40000] + "\n...[중략]...\n" + full_text[-5000:]
        prompt = PROMPT_TEMPLATE.format(title=title, full_text=full_text)
        result = subprocess.run(
            ["claude", "-p", "--model", self.model, prompt],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"claude exited with code {result.returncode}: {result.stderr}"
            )
        return result.stdout
