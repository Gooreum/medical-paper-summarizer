from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.schedule_config import load_config

scheduler = AsyncIOScheduler()


def start_scheduler(app):
    config = load_config()
    if config.get("enabled", True):
        scheduler.add_job(
            daily_crawl, "cron", id="daily_crawl",
            hour=config["hour"], minute=config["minute"],
        )
    scheduler.start()


async def daily_crawl():
    from app.database import SessionLocal
    from app.routers.crawl import run_crawl_job
    from app.schedule_config import load_config

    config = load_config()
    db = SessionLocal()
    try:
        await run_crawl_job(
            config["topics"], db,
            papers_per_topic=config.get("papers_per_topic", 5),
            sources=config.get("sources"),
            model=config.get("model"),
            min_citation_count=config.get("min_citation_count", 0),
        )
    finally:
        db.close()
