import asyncio
import json
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.crawlers.biorxiv import BioRxivCrawler
from app.crawlers.koreamed import KoreMedCrawler
from app.crawlers.pubmed import PubMedCrawler
from app.crawlers.topics import PAPERS_PER_TOPIC, TOPICS
from app.database import get_db
from app.models import CrawlEvent, CrawlSession, Paper
from app.schemas import CrawlTriggerRequest
from app.summarizers.factory import get_summarizer

router = APIRouter()

crawl_status: Dict[str, Any] = {
    "running": False,
    "progress": "",
    "started_at": None,
    "results": [],
    "logs": [],
}

def _log(msg: str) -> None:
    crawl_status["logs"].append(msg)
    crawl_status["progress"] = msg
    if len(crawl_status["logs"]) > 200:
        crawl_status["logs"] = crawl_status["logs"][-200:]


ALL_SOURCES = ["pubmed", "biorxiv", "koreamed"]

@router.post("/crawl/trigger")
async def trigger_crawl(
    body: CrawlTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if crawl_status["running"]:
        return JSONResponse(status_code=409, content={"detail": "Crawl already running"})

    topics = body.topics if body.topics else list(TOPICS.keys())
    papers_per_topic = max(1, min(body.papers_per_topic or PAPERS_PER_TOPIC, 20))
    sources = body.sources if body.sources else ALL_SOURCES
    model = body.model or None
    background_tasks.add_task(run_crawl_job, topics, db, papers_per_topic, sources, model)
    return {"status": "started", "topics": topics, "papers_per_topic": papers_per_topic, "sources": sources}


@router.get("/crawl/status")
def get_crawl_status():
    return {
        "running": crawl_status["running"],
        "progress": crawl_status["progress"],
        "started_at": crawl_status["started_at"],
        "results": len(crawl_status["results"]),
    }


@router.get("/crawl/stream")
async def stream_crawl_status():
    async def event_generator():
        import json
        last_log_count = 0
        while True:
            current_logs = crawl_status["logs"]
            new_logs = current_logs[last_log_count:]
            last_log_count = len(current_logs)
            data = {
                "running": crawl_status["running"],
                "progress": crawl_status["progress"],
                "results_count": len(crawl_status["results"]),
                "new_logs": new_logs,
            }
            yield {"data": json.dumps(data, ensure_ascii=False)}
            if not crawl_status["running"] and not new_logs:
                break
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


# ── 히스토리 API ──────────────────────────────────────────────

@router.get("/crawl/history")
def list_crawl_history(
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    total = db.query(CrawlSession).count()
    sessions = (
        db.query(CrawlSession)
        .order_by(CrawlSession.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "sessions": [
            {
                "id": s.id,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "finished_at": s.finished_at.isoformat() if s.finished_at else None,
                "status": s.status,
                "topics": json.loads(s.topics) if s.topics else [],
                "sources": json.loads(s.sources) if s.sources else [],
                "papers_per_topic": s.papers_per_topic,
                "total_saved": s.total_saved,
                "total_skipped": s.total_skipped,
                "total_failed": s.total_failed,
            }
            for s in sessions
        ],
    }


@router.get("/crawl/history/{session_id}")
def get_crawl_history_detail(
    session_id: int,
    event_type: str = "all",
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    session = db.query(CrawlSession).filter(CrawlSession.id == session_id).first()
    if not session:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})

    q = db.query(CrawlEvent).filter(CrawlEvent.session_id == session_id)
    if event_type != "all":
        q = q.filter(CrawlEvent.event_type == event_type)

    total = q.count()
    events = q.order_by(CrawlEvent.id).offset((page - 1) * limit).limit(limit).all()

    # count breakdown
    counts = {}
    for et in ["collected", "skipped", "summarized", "failed"]:
        counts[et] = db.query(CrawlEvent).filter(
            CrawlEvent.session_id == session_id,
            CrawlEvent.event_type == et,
        ).count()

    return {
        "session": {
            "id": session.id,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "finished_at": session.finished_at.isoformat() if session.finished_at else None,
            "status": session.status,
            "topics": json.loads(session.topics) if session.topics else [],
            "sources": json.loads(session.sources) if session.sources else [],
            "papers_per_topic": session.papers_per_topic,
            "total_saved": session.total_saved,
            "total_skipped": session.total_skipped,
            "total_failed": session.total_failed,
        },
        "counts": counts,
        "total": total,
        "page": page,
        "limit": limit,
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "topic": e.topic,
                "source": e.source,
                "title": e.title,
                "reason": e.reason,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


# ── 크롤 잡 ──────────────────────────────────────────────────

async def run_crawl_job(
    topics: List[str],
    db_session: Session,
    papers_per_topic: int = PAPERS_PER_TOPIC,
    sources: List[str] = None,
    model: str = None,
) -> None:
    if sources is None:
        sources = ALL_SOURCES

    crawl_status["running"] = True
    crawl_status["started_at"] = datetime.utcnow().isoformat()
    crawl_status["results"] = []
    crawl_status["logs"] = []

    # CrawlSession 생성
    session_obj = CrawlSession(
        started_at=datetime.utcnow(),
        topics=json.dumps(topics, ensure_ascii=False),
        sources=json.dumps(sources, ensure_ascii=False),
        papers_per_topic=papers_per_topic,
        status="running",
    )
    db_session.add(session_obj)
    db_session.commit()
    db_session.refresh(session_obj)
    session_id = session_obj.id

    total_saved = 0
    total_skipped = 0
    total_failed = 0

    try:
        summarizer = get_summarizer(model)

        existing_dois = {row[0] for row in db_session.query(Paper.doi).filter(Paper.doi.isnot(None)).all()}
        existing_biorxiv_ids = {row[0] for row in db_session.query(Paper.arxiv_id).filter(Paper.arxiv_id.isnot(None)).all()}

        db_lock = asyncio.Lock()

        async def process_topic(topic: str) -> None:
            nonlocal total_saved, total_skipped, total_failed

            topic_events: List[dict] = []

            def on_event(evt: dict) -> None:
                evt.setdefault("topic", topic)
                topic_events.append(evt)

            pubmed_papers, biorxiv_papers, koreamed_papers = [], [], []

            if "pubmed" in sources:
                _log(f"[{topic}] PubMed 검색 중...")
                try:
                    pubmed_papers = await asyncio.to_thread(
                        PubMedCrawler().crawl, topic, existing_dois,
                        max_papers=papers_per_topic, on_progress=_log, on_event=on_event
                    )
                    _log(f"[{topic}] PubMed {len(pubmed_papers)}편 수집 완료")
                except Exception as e:
                    _log(f"[{topic}] PubMed 실패 (스킵): {e}")

            if "biorxiv" in sources:
                _log(f"[{topic}] bioRxiv/medRxiv 검색 중...")
                try:
                    biorxiv_papers = await asyncio.to_thread(
                        BioRxivCrawler().crawl, topic, existing_biorxiv_ids,
                        max_papers=papers_per_topic, on_progress=_log, on_event=on_event
                    )
                    _log(f"[{topic}] bioRxiv/medRxiv {len(biorxiv_papers)}편 수집 완료")
                except Exception as e:
                    _log(f"[{topic}] bioRxiv/medRxiv 실패 (스킵): {e}")

            if "koreamed" in sources:
                _log(f"[{topic}] KoreaMed 검색 중...")
                try:
                    koreamed_papers = await asyncio.to_thread(
                        KoreMedCrawler().crawl, topic, existing_dois,
                        max_papers=papers_per_topic, on_progress=_log, on_event=on_event
                    )
                    _log(f"[{topic}] KoreaMed {len(koreamed_papers)}편 수집 완료")
                except Exception as e:
                    _log(f"[{topic}] KoreaMed 실패 (스킵): {e}")

            all_papers = pubmed_papers + biorxiv_papers + koreamed_papers
            saved_count = 0

            for idx, paper_dict in enumerate(all_papers, 1):
                async with db_lock:
                    if paper_dict.get("doi") and paper_dict["doi"] in existing_dois:
                        continue
                    if paper_dict.get("arxiv_id") and paper_dict["arxiv_id"] in existing_biorxiv_ids:
                        continue

                title = paper_dict.get("title", "")
                source = paper_dict.get("source", "").upper()

                try:
                    full_text = (paper_dict.get("full_text", "") or "").replace("\x00", "")

                    _log(f"[{topic}] [{source}] 요약 중 ({idx}/{len(all_papers)}): {title[:50]}...")

                    summary_ko = await asyncio.to_thread(
                        summarizer.summarize, full_text, topic, title
                    )
                    _log(f"[{topic}] [{source}] 요약 완료 ✓ {title[:50]}")

                    async with db_lock:
                        paper = Paper(
                            doi=paper_dict.get("doi"),
                            arxiv_id=paper_dict.get("arxiv_id"),
                            title=title,
                            authors=paper_dict.get("authors"),
                            source=paper_dict.get("source"),
                            topic=topic,
                            url=paper_dict.get("url"),
                            full_text=full_text,
                            summary_ko=summary_ko,
                            citation_count=paper_dict.get("citation_count", 0),
                            published_date=paper_dict.get("published_date"),
                            crawled_date=paper_dict.get("crawled_date"),
                            model_used=summarizer.__class__.__name__,
                            abstract_only=paper_dict.get("abstract_only", False),
                        )
                        db_session.add(paper)
                        db_session.flush()

                        if paper_dict.get("doi"):
                            existing_dois.add(paper_dict["doi"])
                        if paper_dict.get("arxiv_id"):
                            existing_biorxiv_ids.add(paper_dict["arxiv_id"])

                    topic_events.append({
                        "type": "summarized",
                        "topic": topic,
                        "source": paper_dict.get("source", ""),
                        "title": title,
                        "reason": None,
                    })
                    saved_count += 1
                    crawl_status["results"].append({"topic": topic, "title": title})

                except Exception as e:
                    async with db_lock:
                        db_session.rollback()
                    _log(f"[{topic}] [{source}] 저장 실패 (스킵): {title[:40]} — {e}")
                    topic_events.append({
                        "type": "failed",
                        "topic": topic,
                        "source": paper_dict.get("source", ""),
                        "title": title,
                        "reason": str(e)[:200],
                    })
                    continue

            async with db_lock:
                db_session.commit()

            # 이벤트 일괄 저장
            skipped_count = sum(1 for e in topic_events if e["type"] == "skipped")
            failed_count = sum(1 for e in topic_events if e["type"] == "failed")

            async with db_lock:
                for evt in topic_events:
                    db_session.add(CrawlEvent(
                        session_id=session_id,
                        event_type=evt["type"],
                        topic=evt.get("topic", topic),
                        source=evt.get("source", ""),
                        title=(evt.get("title", "") or "")[:300],
                        reason=evt.get("reason"),
                    ))
                db_session.commit()

                total_saved += saved_count
                total_skipped += skipped_count
                total_failed += failed_count

            _log(f"[{topic}] 완료 — {saved_count}편 저장됨")

        await asyncio.gather(*[process_topic(t) for t in topics])
        _log(f"전체 완료 — 총 {len(crawl_status['results'])}편 수집")

        # 세션 완료 처리
        session_obj.status = "completed"
        session_obj.finished_at = datetime.utcnow()
        session_obj.total_saved = total_saved
        session_obj.total_skipped = total_skipped
        session_obj.total_failed = total_failed
        db_session.commit()

    except Exception as e:
        _log(f"오류 발생: {e}")
        session_obj.status = "failed"
        session_obj.finished_at = datetime.utcnow()
        session_obj.total_saved = total_saved
        session_obj.total_skipped = total_skipped
        session_obj.total_failed = total_failed
        db_session.commit()
    finally:
        crawl_status["running"] = False
