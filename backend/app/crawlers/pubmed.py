import time
import xml.etree.ElementTree as ET
from datetime import date
from typing import Callable, Dict, List, Optional, Set

import fitz
import requests

from app.crawlers.scihub_resolver import SciHubResolver
from app.crawlers.semantic_scholar import get_citation_count
from app.crawlers.topics import MIN_CITATIONS, PAPERS_PER_TOPIC, TOPICS

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
_resolver = SciHubResolver()


def _esearch(query: str, retmax: int = 50) -> List[str]:
    r = requests.get(
        f"{EUTILS}/esearch.fcgi",
        params={"db": "pubmed", "term": query, "retmax": retmax, "retmode": "json"},
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
    ) -> List[Dict]:
        def log(msg: str) -> None:
            if on_progress:
                on_progress(msg)

        keywords = TOPICS.get(topic, [topic])
        pmids: List[str] = []
        seen: Set[str] = set()

        for kw in keywords:
            try:
                query = f'"{kw}"[Title/Abstract] AND (Clinical Trial[pt] OR Randomized Controlled Trial[pt])'
                ids = _esearch(query)
                for pmid in ids:
                    if pmid not in seen:
                        seen.add(pmid)
                        pmids.append(pmid)
                time.sleep(0.35)  # NCBI rate limit: 3 req/sec
            except Exception as e:
                log(f"[PubMed] '{kw}' 검색 실패 (스킵): {e}")

        papers: List[Dict] = []
        for pmid in pmids:
            if len(papers) >= max_papers:
                break
            if pmid in existing_ids:
                continue
            try:
                log(f"[PubMed] PMID {pmid} 가져오는 중...")
                root = _efetch_pubmed_xml(pmid)
                time.sleep(0.35)

                art_node = root.find(".//Article")
                if art_node is None:
                    continue

                title = art_node.findtext("ArticleTitle") or ""
                authors = ", ".join(
                    f"{a.findtext('ForeName') or ''} {a.findtext('LastName') or ''}".strip()
                    for a in art_node.findall(".//Author")
                    if a.findtext("LastName")
                )

                doi = None
                pmc_id = None
                for id_node in root.findall(".//ArticleId"):
                    id_type = id_node.get("IdType", "")
                    if id_type == "doi":
                        doi = id_node.text
                    elif id_type == "pmc":
                        pmc_id = id_node.text

                abstract_parts = [t.text or "" for t in art_node.findall(".//AbstractText")]
                abstract = " ".join(abstract_parts)

                pub_date = None
                try:
                    pd = art_node.find(".//PubDate")
                    if pd is not None:
                        y = int(pd.findtext("Year") or 0)
                        m_raw = pd.findtext("Month") or "1"
                        m = int(m_raw) if m_raw.isdigit() else 1
                        if y:
                            pub_date = date(y, m, 1)
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
                        continue

                citations = get_citation_count(doi or title)
                if citations < MIN_CITATIONS:
                    log(f"[PubMed] 스킵 (인용수 {citations} < {MIN_CITATIONS}): {title[:40]}")
                    continue

                log(f"[PubMed] 수집 완료 (인용수 {citations}){' [초록]' if abstract_only else ''}: {title[:50]}")
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
                    "abstract_only": abstract_only,
                })
            except Exception as e:
                log(f"[PubMed] PMID {pmid} 실패 (스킵): {e}")
                continue

        return papers
