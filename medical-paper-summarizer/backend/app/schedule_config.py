import json
import os
from app.crawlers.topics import TOPICS

SCHEDULE_CONFIG_PATH = "schedule_config.json"

DEFAULT_CONFIG = {
    "enabled": True,
    "hour": 8,
    "minute": 0,
    "topics": list(TOPICS.keys()),
    "papers_per_topic": 5,
    "sources": ["pubmed", "biorxiv"],
    "model": None,
}


def load_config() -> dict:
    if os.path.exists(SCHEDULE_CONFIG_PATH):
        try:
            with open(SCHEDULE_CONFIG_PATH) as f:
                return {**DEFAULT_CONFIG, **json.load(f)}
        except Exception:
            pass
    return DEFAULT_CONFIG.copy()


def save_config(config: dict) -> None:
    with open(SCHEDULE_CONFIG_PATH, "w") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
