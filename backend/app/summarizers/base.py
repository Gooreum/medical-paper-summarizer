from abc import ABC, abstractmethod


class BaseSummarizer(ABC):
    @abstractmethod
    def summarize(self, full_text: str, topic: str, title: str) -> str: ...
