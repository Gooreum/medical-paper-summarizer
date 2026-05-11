import tempfile
from datetime import date
from typing import Callable, Dict, List, Optional, Set

import arxiv
import fitz

from app.crawlers.semantic_scholar import get_citation_count
from app.crawlers.topics import MIN_CITATIONS, PAPERS_PER_TOPIC, TOPICS


class ArxivCrawler:
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
        query = " OR ".join('"' + kw + '"' for kw in keywords)

        client = arxiv.Client()
        search = arxiv.Search(query=query, max_results=50)

        papers: List[Dict] = []
        for result in client.results(search):
            if len(papers) >= max_papers:
                break

            arxiv_id = result.entry_id.split("/")[-1]
            if arxiv_id in existing_ids:
                continue

            log(f"[arXiv] PDF 다운로드 중: {result.title[:50]}")
            full_text = ""
            try:
                with tempfile.TemporaryDirectory() as tmpdir:
                    pdf_path = result.download_pdf(dirpath=tmpdir)
                    doc = fitz.open(pdf_path)
                    pages_text = [page.get_text() for page in doc]
                    raw = chr(10).join(pages_text)

                if len(raw) > 50000:
                    sections = _extract_key_sections(raw)
                    full_text = sections if sections else raw[:40000] + raw[-5000:]
                else:
                    full_text = raw
                log(f"[arXiv] PDF 파싱 완료: {result.title[:50]}")
            except Exception:
                full_text = result.summary or ""
                log(f"[arXiv] PDF 실패, abstract 사용: {result.title[:50]}")

            citations = get_citation_count(result.doi or result.title)
            log(f"[arXiv] 수집 완료 (인용수 {citations}): {result.title[:50]}")

            pub_date = None
            if result.published:
                pub_date = result.published.date()

            papers.append({
                "doi": result.doi,
                "arxiv_id": arxiv_id,
                "title": result.title,
                "authors": ", ".join(str(a) for a in result.authors),
                "source": "arxiv",
                "topic": topic,
                "url": result.entry_id,
                "full_text": full_text,
                "citation_count": citations,
                "published_date": pub_date,
                "crawled_date": date.today(),
            })

        return papers


def _extract_key_sections(text: str) -> str:
    lower = text.lower()
    section_names = ["introduction", "methods", "results", "conclusion"]
    found = {}
    for name in section_names:
        idx = lower.find(name)
        if idx != -1:
            found[name] = idx

    if not found:
        return ""

    ordered = sorted(found.items(), key=lambda x: x[1])
    chunks = []
    for i, (name, start) in enumerate(ordered):
        end = ordered[i + 1][1] if i + 1 < len(ordered) else start + 10000
        chunks.append(text[start:end])

    return (chr(10) + chr(10)).join(chunks)
