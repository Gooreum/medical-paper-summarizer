from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint

from app.database import Base


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    doi = Column(String, nullable=True, index=True)
    arxiv_id = Column(String, nullable=True, index=True)
    title = Column(String, nullable=False)
    authors = Column(Text)
    source = Column(String)
    topic = Column(String, index=True)
    url = Column(String)
    full_text = Column(Text)
    summary_ko = Column(Text)
    citation_count = Column(Integer, default=0)
    published_date = Column(Date, nullable=True)
    crawled_date = Column(Date)
    model_used = Column(String)
    abstract_only = Column(Boolean, default=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("doi", name="uq_papers_doi"),
        UniqueConstraint("arxiv_id", name="uq_papers_arxiv_id"),
        Index("ix_papers_crawled_date", "crawled_date"),
        Index("ix_papers_published_date", "published_date"),
        Index("ix_papers_citation_count", "citation_count"),
        Index("ix_papers_source", "source"),
    )


class CrawlSession(Base):
    __tablename__ = "crawl_sessions"

    id = Column(Integer, primary_key=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    topics = Column(Text)        # JSON list
    sources = Column(Text)       # JSON list
    papers_per_topic = Column(Integer, default=5)
    status = Column(String, default="running")  # running | completed | failed
    total_saved = Column(Integer, default=0)
    total_skipped = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)


class CrawlEvent(Base):
    __tablename__ = "crawl_events"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("crawl_sessions.id"), nullable=False)
    # collected | skipped | summarized | failed
    event_type = Column(String, nullable=False)
    topic = Column(String)
    source = Column(String)
    title = Column(String)
    reason = Column(String, nullable=True)  # skip/fail reason
    paper_id = Column(Integer, nullable=True)  # set for summarized events
    url = Column(String, nullable=True)         # source URL for re-summarization
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_crawl_events_session_id", "session_id"),
        Index("ix_crawl_events_type", "session_id", "event_type"),
    )
