from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crawlers.topics import TOPICS
from app.database import get_db
from app.models import Paper
from app.schemas import PaperListResponse, PaperResponse

router = APIRouter()


@router.get("/papers", response_model=PaperListResponse)
def list_papers(
    topic: Optional[str] = None,
    date: Optional[str] = None,
    ids: Optional[str] = None,
    source: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    sort: str = "crawled_date",
    db: Session = Depends(get_db),
):
    query = db.query(Paper)

    if topic:
        query = query.filter(Paper.topic == topic)

    if source:
        query = query.filter(Paper.source == source)

    if ids:
        id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
        if id_list:
            query = query.filter(Paper.id.in_(id_list))

    if date:
        try:
            from datetime import date as date_cls
            filter_date = date_cls.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
        query = query.filter(Paper.crawled_date == filter_date)

    if sort == "published_date":
        query = query.order_by(Paper.published_date.desc(), Paper.crawled_date.desc())
    elif sort == "citation_count":
        query = query.order_by(Paper.citation_count.desc(), Paper.published_date.desc())
    else:
        query = query.order_by(Paper.crawled_date.desc(), Paper.published_date.desc())
    total = query.count()
    papers = query.offset(skip).limit(limit).all()

    return PaperListResponse(papers=papers, total=total)


@router.get("/papers/{paper_id}", response_model=PaperResponse)
def get_paper(paper_id: int, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    result = PaperResponse.model_validate(paper)
    result.full_text_length = len(paper.full_text) if paper.full_text else 0
    return result


@router.get("/topics")
def list_topics(db: Session = Depends(get_db)):
    db_topics = db.query(Paper.topic).distinct().all()
    db_topic_set = {row[0] for row in db_topics if row[0]}
    all_topics = list(db_topic_set | set(TOPICS.keys()))
    return {"topics": sorted(all_topics)}


@router.get("/topics/counts")
def topic_counts(db: Session = Depends(get_db)):
    from sqlalchemy import func
    rows = db.query(Paper.topic, func.count(Paper.id)).group_by(Paper.topic).all()
    counts = {topic: count for topic, count in rows if topic}
    total = sum(counts.values())
    return {"total": total, "counts": counts}
