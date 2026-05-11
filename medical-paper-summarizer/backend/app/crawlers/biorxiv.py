import time
from datetime import date
from typing import Callable, Dict, List, Optional, Set

import fitz
import requests

from app.crawlers.topics import PAPERS_PER_TOPIC, TOPICS

EUROPEPMC_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


class BioRxivCrawler:
    def crawl(
        self,
        topic: str,
        existing_ids: Set[str],
        max_papers: int = PAPERS_PER_TOPIC,
        on_progress: Optional[Callable[[str], None]] = None,
    ) -> List[Dict]:
        def log(msg: str) -> None:
            if on_progress:
                on_progress(msg)

        keywords = TOPICS.get(topic, [topic])
        papers: List[Dict] = []
        seen_dois: Set[str] = set()

        for kw in keywords:
            if len(papers) >= max_papers:
                break
            try:
                query = f'"{kw}" AND (SRC:PPR) AND (DOI:10.1101*)'
                r = requests.get(
                    EUROPEPMC_URL,
                    params={
                        "query": query,
                        "format": "json",
                        "pageSize": 40,
                        "resultType": "core",
                        "sort": "CITED desc",
                    },
                    timeout=20,
                )
                r.raise_for_status()
                results = r.json().get("resultList", {}).get("result", [])
                time.sleep(0.5)

                for item in results:
                    if len(papers) >= max_papers:
                        break

                    doi = (item.get("doi") or "").strip()
                    if not doi or doi in existing_ids or doi in seen_dois:
                        continue
                    seen_dois.add(doi)

                    title = (item.get("title") or "").strip()
                    abstract_text = (item.get("abstractText") or "").strip()
                    is_medrxiv = "medrxiv" in (item.get("source") or "").lower() or "medrxiv" in doi
                    server = "medrxiv" if is_medrxiv else "biorxiv"
                    source_label = "medRxiv" if is_medrxiv else "bioRxiv"

                    log(f"[{source_label}] PDF 다운로드 중: {title[:50]}")
                    full_text = _fetch_pdf_text(doi, server)

                    abstract_only = False
                    if not full_text:
                        if abstract_text:
                            full_text = abstract_text
                            abstract_only = True
                            log(f"[{source_label}] 초록만 사용: {title[:50]}")
                        else:
                            log(f"[{source_label}] 텍스트 없음, 스킵: {title[:50]}")
                            continue
                    else:
                        log(f"[{source_label}] PDF 파싱 완료: {title[:50]}")

                    citation_count = item.get("citedByCount") or 0

                    pub_date = None
                    pub_year = item.get("pubYear")
                    if pub_year:
                        try:
                            pub_date = date(int(pub_year), 1, 1)
                        except Exception:
                            pass

                    log(f"[{source_label}] 수집 완료 (인용수 {citation_count}){' [초록]' if abstract_only else ''}: {title[:50]}")
                    papers.append({
                        "doi": doi,
                        "arxiv_id": None,
                        "title": title,
                        "authors": item.get("authorString") or "",
                        "source": server,
                        "topic": topic,
                        "url": f"https://doi.org/{doi}",
                        "full_text": full_text,
                        "citation_count": citation_count,
                        "published_date": pub_date,
                        "crawled_date": date.today(),
                        "abstract": abstract_text,
                        "abstract_only": abstract_only,
                    })

            except Exception as e:
                log(f"[bioRxiv/medRxiv] '{kw}' 검색 실패 (스킵): {e}")

        return papers


def _fetch_pdf_text(doi: str, server: str) -> str:
    # Try the given server first, then the other one (some papers are stored with wrong server)
    servers = [server, "medrxiv" if server == "biorxiv" else "biorxiv"]
    for srv in servers:
        base_url = f"https://www.{srv}.org/content/{doi}"
        for version in ("v1", "v2", "v3"):
            try:
                pdf_url = f"{base_url}{version}.full.pdf"
                r = requests.get(pdf_url, timeout=30, allow_redirects=True)
                if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf"):
                    doc = fitz.open(stream=r.content, filetype="pdf")
                    raw = "\n".join(page.get_text() for page in doc)
                    if raw.strip():
                        return raw[:45000] if len(raw) > 45000 else raw
            except Exception:
                continue
    return ""
