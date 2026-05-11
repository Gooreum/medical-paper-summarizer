import json
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup

KNOWN_MIRRORS = [
    "https://sci-hub.se",
    "https://sci-hub.st",
    "https://sci-hub.ru",
    "https://sci-hub.ren",
]
CACHE_FILE = "/tmp/.scihub_mirror_cache"
CACHE_TTL = 3600


class SciHubResolver:
    def get_working_mirror(self) -> Optional[str]:
        try:
            with open(CACHE_FILE) as f:
                cached = json.load(f)
            if time.time() - cached["ts"] < CACHE_TTL:
                return cached["mirror"]
        except Exception:
            pass

        for mirror in KNOWN_MIRRORS:
            try:
                r = requests.head(mirror, timeout=5)
                if r.status_code < 400:
                    try:
                        with open(CACHE_FILE, "w") as f:
                            json.dump({"mirror": mirror, "ts": time.time()}, f)
                    except Exception:
                        pass
                    return mirror
            except Exception:
                continue
        return None

    def fetch_pdf_by_doi(self, doi: str) -> Optional[bytes]:
        mirror = self.get_working_mirror()
        if not mirror:
            return None
        try:
            r = requests.get(f"{mirror}/{doi}", timeout=15)
            if r.status_code != 200:
                return None
            soup = BeautifulSoup(r.text, "html.parser")
            pdf_tag = soup.find("iframe", id="pdf") or soup.find("embed")
            if not pdf_tag:
                return None
            pdf_url = pdf_tag.get("src", "")
            if pdf_url.startswith("//"):
                pdf_url = "https:" + pdf_url
            elif pdf_url.startswith("/"):
                pdf_url = mirror + pdf_url
            pdf_r = requests.get(pdf_url, timeout=30)
            if pdf_r.status_code == 200:
                return pdf_r.content
        except Exception:
            pass
        return None
