from fastapi import APIRouter

from app.schedule_config import load_config, save_config
from app.schemas import ScheduleConfig

router = APIRouter()


@router.get("/schedule")
def get_schedule():
    return load_config()


@router.put("/schedule")
def update_schedule(config: ScheduleConfig):
    data = config.model_dump()
    save_config(data)
    _apply_schedule(data)
    return data


def _apply_schedule(config: dict):
    from app.scheduler import scheduler, daily_crawl

    job_id = "daily_crawl"
    existing = scheduler.get_job(job_id)
    if config.get("enabled"):
        if existing:
            scheduler.reschedule_job(
                job_id, trigger="cron",
                hour=config["hour"], minute=config["minute"],
            )
        else:
            scheduler.add_job(
                daily_crawl, "cron", id=job_id,
                hour=config["hour"], minute=config["minute"],
            )
    else:
        if existing:
            scheduler.remove_job(job_id)
