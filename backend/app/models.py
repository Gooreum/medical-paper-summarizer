from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, Text, UniqueConstraint

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
    )
