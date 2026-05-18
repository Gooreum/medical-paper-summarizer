import re
from datetime import date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, defer

from app.crawlers.topics import TOPICS
from app.crawlers.url_fetcher import fetch_from_url
from app.database import get_db
from app.models import Paper
from app.schemas import PaperListItem, PaperListResponse, PaperResponse
from app.summarizers.claude_code import ClaudeCodeSummarizer


def _extract_one_liner(summary: str | None) -> str | None:
    if not summary:
        return None
    match = re.search(r'##\s*한 줄 핵심[^\n]*\n([\s\S]*?)(?=\n##|$)', summary)
    raw = match.group(1) if match else summary
    result = ' '.join(
        line for line in raw.split('\n')
        if not re.match(r'^-{3,}$', line.strip())
    ).strip()[:120]
    return result or None

router = APIRouter()


@router.get("/papers", response_model=PaperListResponse)
def list_papers(
    response: Response,
    topic: Optional[str] = None,
    date: Optional[str] = None,
    ids: Optional[str] = None,
    source: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    sort: str = "crawled_date",
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    query = db.query(Paper).options(defer(Paper.full_text))

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

    items = []
    for p in papers:
        item = PaperListItem.model_validate(p)
        item.summary_one_liner = _extract_one_liner(p.summary_ko)
        items.append(item)
    return PaperListResponse(papers=items, total=total)


class SummarizeUrlRequest(BaseModel):
    url: str
    topic: str
    model: Optional[str] = None
    citation_count: Optional[int] = None


class SummarizeTextRequest(BaseModel):
    title: str
    text: str
    topic: str
    model: Optional[str] = None
    authors: Optional[str] = None
    url: Optional[str] = None
    citation_count: Optional[int] = None


# Must be defined BEFORE /papers/{paper_id} to avoid path conflict
@router.post("/papers/summarize-url", response_model=PaperResponse)
def summarize_url(req: SummarizeUrlRequest, db: Session = Depends(get_db)):
    try:
        paper_data = fetch_from_url(req.url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"URL 가져오기 실패: {e}")

    doi = paper_data.get("doi")
    if doi:
        existing = db.query(Paper).filter(Paper.doi == doi).first()
        if existing:
            r = PaperResponse.model_validate(existing)
            r.full_text_length = len(existing.full_text) if existing.full_text else 0
            return r

    model_name = req.model or "sonnet"
    summarizer = ClaudeCodeSummarizer(model=model_name)
    try:
        summary = summarizer.summarize(
            full_text=paper_data["full_text"],
            topic=req.topic,
            title=paper_data["title"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"요약 실패: {e}")

    paper = Paper(
        doi=doi,
        arxiv_id=None,
        title=paper_data["title"],
        authors=paper_data.get("authors", ""),
        source=paper_data.get("source", "url"),
        topic=req.topic,
        url=paper_data.get("url", req.url),
        full_text=paper_data["full_text"],
        summary_ko=summary,
        citation_count=req.citation_count if req.citation_count is not None else paper_data.get("citation_count", 0),
        published_date=paper_data.get("published_date"),
        crawled_date=date_cls.today(),
        model_used=model_name,
        abstract_only=paper_data.get("abstract_only", False),
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    result = PaperResponse.model_validate(paper)
    result.full_text_length = len(paper.full_text) if paper.full_text else 0
    return result


@router.post("/papers/summarize-text", response_model=PaperResponse)
def summarize_text(req: SummarizeTextRequest, db: Session = Depends(get_db)):
    if len(req.text.strip()) < 100:
        raise HTTPException(status_code=422, detail="텍스트가 너무 짧습니다. 최소 100자 이상 입력하세요.")

    model_name = req.model or "sonnet"
    summarizer = ClaudeCodeSummarizer(model=model_name)
    try:
        summary = summarizer.summarize(
            full_text=req.text,
            topic=req.topic,
            title=req.title,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"요약 실패: {e}")

    paper = Paper(
        doi=None,
        arxiv_id=None,
        title=req.title,
        authors=req.authors or "",
        source="manual",
        topic=req.topic,
        url=req.url or "",
        full_text=req.text,
        summary_ko=summary,
        citation_count=req.citation_count or 0,
        published_date=None,
        crawled_date=date_cls.today(),
        model_used=model_name,
        abstract_only=len(req.text) < 500,
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    result = PaperResponse.model_validate(paper)
    result.full_text_length = len(paper.full_text) if paper.full_text else 0
    return result


@router.get("/papers/{paper_id}", response_model=PaperResponse)
def get_paper(paper_id: int, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
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


@router.get("/sources/counts")
def source_counts(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=3600"
    from sqlalchemy import func
    rows = db.query(Paper.source, func.count(Paper.id)).group_by(Paper.source).all()
    counts = {source: count for source, count in rows if source}
    total = sum(counts.values())
    return {"total": total, "counts": counts}


@router.get("/topics/counts")
def topic_counts(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=3600"
    from sqlalchemy import func
    rows = db.query(Paper.topic, func.count(Paper.id)).group_by(Paper.topic).all()
    counts = {topic: count for topic, count in rows if topic}
    total = sum(counts.values())
    return {"total": total, "counts": counts}
