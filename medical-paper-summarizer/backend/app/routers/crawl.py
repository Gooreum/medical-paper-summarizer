import asyncio
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
from app.models import Paper
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
    return crawl_status


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

    try:
        summarizer = get_summarizer(model)

        existing_dois = {row[0] for row in db_session.query(Paper.doi).filter(Paper.doi.isnot(None)).all()}
        existing_biorxiv_ids = {row[0] for row in db_session.query(Paper.arxiv_id).filter(Paper.arxiv_id.isnot(None)).all()}

        db_lock = asyncio.Lock()

        async def process_topic(topic: str) -> None:
            pubmed_papers = []
            biorxiv_papers = []
            koreamed_papers = []

            if "pubmed" in sources:
                _log(f"[{topic}] PubMed 검색 중...")
                try:
                    pubmed_papers = await asyncio.to_thread(
                        PubMedCrawler().crawl, topic, existing_dois, max_papers=papers_per_topic, on_progress=_log
                    )
                    _log(f"[{topic}] PubMed {len(pubmed_papers)}편 수집 완료")
                except Exception as e:
                    _log(f"[{topic}] PubMed 실패 (스킵): {e}")

            if "biorxiv" in sources:
                _log(f"[{topic}] bioRxiv/medRxiv 검색 중...")
                try:
                    biorxiv_papers = await asyncio.to_thread(
                        BioRxivCrawler().crawl, topic, existing_biorxiv_ids, max_papers=papers_per_topic, on_progress=_log
                    )
                    _log(f"[{topic}] bioRxiv/medRxiv {len(biorxiv_papers)}편 수집 완료")
                except Exception as e:
                    _log(f"[{topic}] bioRxiv/medRxiv 실패 (스킵): {e}")

            if "koreamed" in sources:
                _log(f"[{topic}] KoreaMed 검색 중...")
                try:
                    koreamed_papers = await asyncio.to_thread(
                        KoreMedCrawler().crawl, topic, existing_dois, max_papers=papers_per_topic, on_progress=_log
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

                try:
                    full_text = (paper_dict.get("full_text", "") or "").replace("\x00", "")
                    title = paper_dict.get("title", "")
                    source = paper_dict.get("source", "").upper()

                    _log(f"[{topic}] [{source}] 요약 중 ({idx}/{len(all_papers)}): {title[:50]}...")

                    summary_ko = await asyncio.to_thread(
                        summarizer.summarize, full_text, topic, title
                    )
                    _log(f"[{topic}] [{source}] 요약 완료 ✓ {title[:50]}")

                    async with db_lock:
                        paper = Paper(
                            doi=paper_dict.get("doi"),
                            arxiv_id=paper_dict.get("arxiv_id"),
                            title=paper_dict["title"],
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

                    saved_count += 1
                    crawl_status["results"].append({"topic": topic, "title": title})
                except Exception as e:
                    async with db_lock:
                        db_session.rollback()
                    _log(f"[{topic}] [{source}] 저장 실패 (스킵): {title[:40]} — {e}")
                    continue

            async with db_lock:
                db_session.commit()
            _log(f"[{topic}] 완료 — {saved_count}편 저장됨")

        await asyncio.gather(*[process_topic(t) for t in topics])
        _log(f"전체 완료 — 총 {len(crawl_status['results'])}편 수집")
    except Exception as e:
        _log(f"오류 발생: {e}")
    finally:
        crawl_status["running"] = False
