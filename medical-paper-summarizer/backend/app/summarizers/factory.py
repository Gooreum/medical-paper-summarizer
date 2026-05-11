import os
from typing import Optional

from .base import BaseSummarizer


def get_summarizer(model: Optional[str] = None) -> BaseSummarizer:
    provider = os.getenv("SUMMARY_PROVIDER", "claude-code")
    resolved_model = model or os.getenv("SUMMARY_MODEL", "")
    match provider:
        case "claude-code":
            from .claude_code import ClaudeCodeSummarizer
            return ClaudeCodeSummarizer(resolved_model) if resolved_model else ClaudeCodeSummarizer()
        case "gemini":
            from .gemini import GeminiSummarizer
            return GeminiSummarizer(resolved_model) if resolved_model else GeminiSummarizer()
        case "ollama":
            from .ollama import OllamaSummarizer
            return OllamaSummarizer(resolved_model) if resolved_model else OllamaSummarizer()
        case _:
            raise ValueError(f"Unknown SUMMARY_PROVIDER: {provider!r}")
