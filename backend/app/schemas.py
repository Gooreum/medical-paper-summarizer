from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class PaperBase(BaseModel):
    title: str
    authors: Optional[str] = None
    source: Optional[str] = None
    topic: Optional[str] = None
    url: Optional[str] = None
    citation_count: int = 0
    published_date: Optional[date] = None
    crawled_date: Optional[date] = None
    summary_ko: Optional[str] = None
    model_used: Optional[str] = None


class PaperResponse(PaperBase):
    id: int
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None
    abstract_only: bool = False
    full_text_length: Optional[int] = None

    model_config = {"from_attributes": True}


class PaperListResponse(BaseModel):
    papers: List[PaperResponse]
    total: int


class CrawlTriggerRequest(BaseModel):
    topics: Optional[List[str]] = None
    papers_per_topic: Optional[int] = None
    sources: Optional[List[str]] = None
    model: Optional[str] = None


class ScheduleConfig(BaseModel):
    enabled: bool = True
    hour: int = 8
    minute: int = 0
    topics: List[str] = []
    papers_per_topic: int = 5
    sources: List[str] = ["pubmed", "biorxiv"]
    model: Optional[str] = None
