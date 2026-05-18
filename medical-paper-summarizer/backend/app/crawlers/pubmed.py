import math
import os
import threading
import time
import xml.etree.ElementTree as ET
from datetime import date
from typing import Callable, Dict, List, Optional, Set

import fitz
import requests

from app.crawlers.scihub_resolver import SciHubResolver
from app.crawlers.semantic_scholar import get_citation_count
from app.crawlers.topics import MIN_CITATIONS, PAPERS_PER_TOPIC, build_pubmed_queries
from app.summarizers.claude_code import check_relevance

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
PAGE_SIZE = 50
_resolver = SciHubResolver()

# NCBI allows 3 req/sec without API key, 10/sec with key
_NCBI_API_KEY = os.getenv("NCBI_API_KEY", "")
_RATE_INTERVAL = 0.12 if _NCBI_API_KEY else 0.4  # seconds between requests

_pubmed_lock = threading.Lock()
_pubmed_last_call = 0.0


def _pubmed_get(url: str, params: dict) -> requests.Response:
    """Thread-safe rate-limited GET with retry on 429."""
    global _pubmed_last_call
    if _NCBI_API_KEY:
        params = {**params, "api_key": _NCBI_API_KEY}

    for attempt in range(4):
        with _pubmed_lock:
            now = time.time()
            wait = _RATE_INTERVAL - (now - _pubmed_last_call)
            if wait > 0:
                time.sleep(wait)
            _pubmed_last_call = time.time()

        r = requests.get(url, params=params, timeout=30)
        if r.status_code == 429:
            backoff = 2 ** attempt * 3  # 3s, 6s, 12s, 24s
            time.sleep(backoff)
            continue
        r.raise_for_status()
        return r

    r.raise_for_status()
    return r  # unreachable but satisfies type checker


def _quality_score(paper: dict) -> int:
    """Higher = better quality paper for prioritization."""
    score = 0
    text = (paper.get("title", "") + " " + paper.get("abstract", "")).lower()

    # Study type signals in title/abstract
    if "meta-analysis" in text or "systematic review" in text:
        score += 30
    elif "randomized" in text or "randomised" in text:
        score += 15
    elif "clinical trial" in text:
        score += 10
    elif "cohort" in text or "prospective" in text:
        score += 5

    # Full text available (not abstract-only)
    if not paper.get("abstract_only", True):
        score += 15

    # Citation count (log scale, capped at 25)
    citations = paper.get("citation_count", 0) or 0
    if citations > 0:
        score += min(int(math.log10(citations + 1) * 10), 25)

    # Recency
    pub_date = paper.get("published_date")
    if pub_date:
        try:
            years_old = (date.today() - pub_date).days / 365
            if years_old <= 2:
                score += 15
            elif years_old <= 5:
                score += 8
        except Exception:
            pass

    return score


def _esearch(query: str, retstart: int = 0, retmax: int = PAGE_SIZE) -> List[str]:
    r = _pubmed_get(
        f"{EUTILS}/esearch.fcgi",
        {"db": "pubmed", "term": query, "retstart": retstart, "retmax": retmax, "retmode": "json"},
    )
    return r.json().get("esearchresult", {}).get("idlist", [])


def _efetch_pubmed_xml(pmid: str) -> ET.Element:
    r = _pubmed_get(
        f"{EUTILS}/efetch.fcgi",
        {"db": "pubmed", "id": pmid, "rettype": "xml", "retmode": "xml"},
    )
    return ET.fromstring(r.content)


def _efetch_pmc_text(pmc_id: str) -> str:
    r = _pubmed_get(
        f"{EUTILS}/efetch.fcgi",
        {"db": "pmc", "id": pmc_id, "rettype": "full", "retmode": "xml"},
    )
    return r.text


class PubMedCrawler:
    def crawl(
        self,
        topic: str,
        existing_ids: Set[str],
        max_papers: int = PAPERS_PER_TOPIC,
        on_progress: Optional[Callable[[str], None]] = None,
        on_event: Optional[Callable[[dict], None]] = None,
    ) -> List[Dict]:
        def log(msg: str) -> None:
            if on_progress:
                on_progress(msg)

        def emit(evt: dict) -> None:
            if on_event:
                on_event(evt)

        # Collect up to 3x requested papers across all query tiers, then quality-sort
        MAX_COLLECT = max_papers * 3
        queries = build_pubmed_queries(topic)
        papers: List[Dict] = []
        seen_pmids: Set[str] = set()

        for query in queries:
            if len(papers) >= MAX_COLLECT:
                break
            page = 0
            log(f"[PubMed] 쿼리: {query[:80]}...")
            while len(papers) < MAX_COLLECT:
                try:
                    ids = _esearch(query, retstart=page * PAGE_SIZE)
                except Exception as e:
                    log(f"[PubMed] 검색 실패 (스킵): {e}")
                    break
                if not ids:
                    break
                for pmid in ids:
                    if pmid in seen_pmids:
                        continue
                    seen_pmids.add(pmid)
                    try:
                        log(f"[PubMed] PMID {pmid} 가져오는 중...")
                        root = _efetch_pubmed_xml(pmid)

                        art_node = root.find(".//Article")
                        if art_node is None:
                            continue

                        title = art_node.findtext("ArticleTitle") or ""
                        abstract_parts = [t.text or "" for t in art_node.findall(".//AbstractText")]
                        abstract = " ".join(abstract_parts)

                        doi = None
                        pmc_id = None
                        for id_node in root.findall(".//ArticleId"):
                            id_type = id_node.get("IdType", "")
                            if id_type == "doi":
                                doi = id_node.text
                            elif id_type == "pmc":
                                pmc_id = id_node.text

                        # 1) DOI 중복체크 (PDF 전에)
                        if doi and doi in existing_ids:
                            continue

                        # 2) 관련도 체크 (PDF 전에)
                        _pmid_url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                        if not check_relevance(title, abstract, topic):
                            log(f"[PubMed] 관련도 낮음 스킵: {title[:50]}")
                            emit({"type": "skipped", "source": "pubmed", "title": title, "reason": "관련도 낮음", "url": _pmid_url})
                            continue

                        # 3) 인용수 체크 (PDF 전에)
                        citations = get_citation_count(doi or title)
                        if citations < MIN_CITATIONS:
                            log(f"[PubMed] 스킵 (인용수 {citations} < {MIN_CITATIONS}): {title[:40]}")
                            emit({"type": "skipped", "source": "pubmed", "title": title, "reason": f"인용수 부족 ({citations}회)", "url": _pmid_url})
                            continue

                        # 4) PDF 다운로드 — 여기까지 통과한 논문만
                        authors = ", ".join(
                            f"{a.findtext('ForeName') or ''} {a.findtext('LastName') or ''}".strip()
                            for a in art_node.findall(".//Author")
                            if a.findtext("LastName")
                        )

                        pub_date = None
                        try:
                            _MONTHS = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,
                                       "Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
                            pd = art_node.find(".//PubDate")
                            if pd is not None:
                                y = int(pd.findtext("Year") or 0)
                                m_raw = pd.findtext("Month") or "1"
                                m = int(m_raw) if m_raw.isdigit() else _MONTHS.get(m_raw[:3], 1)
                                d_raw = pd.findtext("Day") or "1"
                                d = int(d_raw) if d_raw.isdigit() else 1
                                if y:
                                    pub_date = date(y, m, d)
                        except Exception:
                            pass

                        full_text = ""
                        if pmc_id:
                            try:
                                pmc_text = _efetch_pmc_text(pmc_id)
                                if len(pmc_text) > 500:
                                    full_text = pmc_text
                            except Exception:
                                pass
                        if not full_text and doi:
                            pdf_bytes = _resolver.fetch_pdf_by_doi(doi)
                            if pdf_bytes:
                                try:
                                    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                                    full_text = "\n".join(page.get_text() for page in doc)
                                except Exception:
                                    pass

                        abstract_only = False
                        if not full_text:
                            if abstract:
                                full_text = abstract
                                abstract_only = True
                                log(f"[PubMed] 초록만 사용: {title[:50]}")
                            else:
                                log(f"[PubMed] 텍스트 없음, 스킵: {title[:50]}")
                                emit({"type": "skipped", "source": "pubmed", "title": title, "reason": "텍스트 없음", "url": _pmid_url})
                                continue

                        log(f"[PubMed] 수집 완료 (인용수 {citations}){' [초록]' if abstract_only else ''}: {title[:50]}")
                        emit({"type": "collected", "source": "pubmed", "title": title, "reason": f"인용 {citations}회" + (" [초록]" if abstract_only else ""), "url": _pmid_url})
                        papers.append({
                            "doi": doi,
                            "arxiv_id": None,
                            "title": title,
                            "authors": authors,
                            "source": "pubmed",
                            "topic": topic,
                            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                            "full_text": full_text,
                            "citation_count": citations,
                            "published_date": pub_date,
                            "crawled_date": date.today(),
                            "abstract": abstract,
                            "abstract_only": abstract_only,
                        })
                        if len(papers) >= MAX_COLLECT:
                            break
                    except Exception as e:
                        log(f"[PubMed] PMID {pmid} 실패 (스킵): {e}")
                        continue
                else:
                    page += 1
                    continue
                break

        # Quality-sort and return top N
        papers.sort(key=_quality_score, reverse=True)
        return papers[:max_papers]
