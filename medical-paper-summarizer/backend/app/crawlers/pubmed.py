import time
import xml.etree.ElementTree as ET
from datetime import date
from typing import Callable, Dict, List, Optional, Set

import fitz
import requests

from app.crawlers.scihub_resolver import SciHubResolver
from app.crawlers.semantic_scholar import get_citation_count
from app.crawlers.topics import MIN_CITATIONS, PAPERS_PER_TOPIC, TOPICS
from app.summarizers.claude_code import check_relevance

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
PAGE_SIZE = 50
_resolver = SciHubResolver()


def _esearch(query: str, retstart: int = 0, retmax: int = PAGE_SIZE) -> List[str]:
    r = requests.get(
        f"{EUTILS}/esearch.fcgi",
        params={"db": "pubmed", "term": query, "retstart": retstart, "retmax": retmax, "retmode": "json"},
        timeout=20,
    )
    r.raise_for_status()
    return r.json().get("esearchresult", {}).get("idlist", [])


def _efetch_pubmed_xml(pmid: str) -> ET.Element:
    r = requests.get(
        f"{EUTILS}/efetch.fcgi",
        params={"db": "pubmed", "id": pmid, "rettype": "xml", "retmode": "xml"},
        timeout=30,
    )
    r.raise_for_status()
    return ET.fromstring(r.content)


def _efetch_pmc_text(pmc_id: str) -> str:
    r = requests.get(
        f"{EUTILS}/efetch.fcgi",
        params={"db": "pmc", "id": pmc_id, "rettype": "full", "retmode": "xml"},
        timeout=30,
    )
    r.raise_for_status()
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

        keywords = TOPICS.get(topic, [topic])
        papers: List[Dict] = []
        seen_pmids: Set[str] = set()

        for kw in keywords:
            if len(papers) >= max_papers:
                break
            page = 0
            query = f'"{kw}"[Title/Abstract] AND (Clinical Trial[pt] OR Randomized Controlled Trial[pt])'
            while len(papers) < max_papers:
                try:
                    ids = _esearch(query, retstart=page * PAGE_SIZE)
                except Exception as e:
                    log(f"[PubMed] '{kw}' 검색 실패 (스킵): {e}")
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
                        time.sleep(0.35)

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
                        if not check_relevance(title, abstract, topic):
                            log(f"[PubMed] 관련도 낮음 스킵: {title[:50]}")
                            emit({"type": "skipped", "source": "pubmed", "title": title, "reason": "관련도 낮음"})
                            continue

                        # 3) 인용수 체크 (PDF 전에)
                        citations = get_citation_count(doi or title)
                        if citations < MIN_CITATIONS:
                            log(f"[PubMed] 스킵 (인용수 {citations} < {MIN_CITATIONS}): {title[:40]}")
                            emit({"type": "skipped", "source": "pubmed", "title": title, "reason": f"인용수 부족 ({citations}회)"})
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
                                time.sleep(0.35)
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
                                emit({"type": "skipped", "source": "pubmed", "title": title, "reason": "텍스트 없음"})
                                continue

                        log(f"[PubMed] 수집 완료 (인용수 {citations}){' [초록]' if abstract_only else ''}: {title[:50]}")
                        emit({"type": "collected", "source": "pubmed", "title": title, "reason": f"인용 {citations}회" + (" [초록]" if abstract_only else "")})
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
                        if len(papers) >= max_papers:
                            break
                    except Exception as e:
                        log(f"[PubMed] PMID {pmid} 실패 (스킵): {e}")
                        continue
                else:
                    page += 1
                    time.sleep(0.35)
                    continue
                break

        return papers
