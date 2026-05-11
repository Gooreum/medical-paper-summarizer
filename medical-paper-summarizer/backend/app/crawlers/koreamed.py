import re
import time
from datetime import date
from typing import Callable, Dict, List, Optional, Set

import requests
from bs4 import BeautifulSoup

from app.crawlers.semantic_scholar import get_citation_count
from app.crawlers.topics import PAPERS_PER_TOPIC, TOPICS
from app.summarizers.claude_code import check_relevance

BASE = "https://www.koreamed.org"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MedicalPaperSummarizer/1.0)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}

_MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}


def _parse_pub_date(text: str) -> Optional[date]:
    m = re.search(r'(\d{4})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', text)
    if m:
        try:
            return date(int(m.group(1)), _MONTHS[m.group(2)], 1)
        except Exception:
            pass
    m = re.search(r'(\d{4})/(\d{1,2})/(\d{1,2})', text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except Exception:
            pass
    m = re.search(r'(\d{4})', text)
    if m:
        try:
            return date(int(m.group(1)), 1, 1)
        except Exception:
            pass
    return None


def _search_first_page(keyword: str) -> tuple:
    r = requests.get(
        f"{BASE}/SearchBasic.php",
        params={"QY": keyword, "display": 100, "sort": "C"},
        headers=HEADERS,
        timeout=20,
    )
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    sub_query_input = soup.find("input", {"name": "sub_query_search"})
    sub_query = sub_query_input["value"] if sub_query_input else keyword

    total = 0
    count_div = soup.find("div", class_="count")
    if count_div:
        m = re.search(r'\d+', count_div.get_text())
        if m:
            total = int(m.group())

    return soup, sub_query, total


def _search_next_page(keyword: str, page: int, sub_query: str, total: int) -> BeautifulSoup:
    payload = {
        "search_type": "page_search",
        "sub_query_search": sub_query,
        "s_result_year": "",
        "s_chart_index": "",
        "s_direct_page": str(page),
        "s_totalRecord": str(total),
        "s_query_searc_view": keyword,
        "s_display_type": "summary",
        "s_num_per_page": "100",
        "s_display_sort": "3",
    }
    r = requests.post(f"{BASE}/SearchBasic.php", data=payload, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


def _parse_items(soup: BeautifulSoup) -> List[Dict]:
    items = []
    for dl in soup.find_all("dl", class_="resultItem"):
        try:
            title_tag = dl.find("a", class_="title")
            if not title_tag:
                continue
            title = title_tag.get_text(strip=True)
            href = title_tag.get("href", "")
            kmid_m = re.search(r'RID=([^\s&]+)', href)
            if not kmid_m:
                continue
            kmid = kmid_m.group(1)

            citation_p = dl.find("p", class_="citation")
            authors = citation_p.get_text(strip=True) if citation_p else ""

            doi = None
            pub_date_text = ""
            for li in dl.find_all("li", class_="fcPoint"):
                doi_link = li.find("a", href=lambda h: h and "doi.org" in h)
                if doi_link:
                    raw = doi_link.get("href", "")
                    doi = re.sub(r'^https?://(?:dx\.)?doi\.org/', '', raw).strip()
                text = li.get_text(strip=True)
                if re.search(r'\d{4}', text) and re.search(
                    r'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec', text
                ):
                    pub_date_text = text

            snippet_div = dl.find("div", class_="snippet")
            snippet = snippet_div.get_text(strip=True) if snippet_div else ""

            items.append({
                "kmid": kmid,
                "title": title,
                "authors": authors,
                "doi": doi,
                "snippet": snippet,
                "pub_date": _parse_pub_date(pub_date_text) if pub_date_text else None,
            })
        except Exception:
            continue
    return items


def _fetch_abstract(kmid: str) -> str:
    try:
        r = requests.get(
            f"{BASE}/SearchBasic.php",
            params={"RID": kmid},
            headers=HEADERS,
            timeout=20,
        )
        soup = BeautifulSoup(r.text, "html.parser")
        meta = soup.find("meta", {"name": "citation_abstract"})
        if meta and meta.get("content", "").strip():
            return meta["content"].strip()
        abstract_div = soup.find("div", class_="abstract")
        if abstract_div:
            dd = abstract_div.find("dd")
            if dd:
                return dd.get_text(strip=True)
    except Exception:
        pass
    return ""


def _has_next_page(soup: BeautifulSoup) -> bool:
    pager = soup.find("ul", class_="pager")
    if not pager:
        return False
    next_li = pager.find("li", class_="next")
    return bool(next_li and next_li.find("a"))


class KoreMedCrawler:
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
        seen_ids: Set[str] = set()

        for kw in keywords:
            if len(papers) >= max_papers:
                break

            log(f"[KoreaMed] '{kw}' 검색 중...")
            try:
                soup, sub_query, total = _search_first_page(kw)
                log(f"[KoreaMed] '{kw}' 총 {total}건 발견")

                page = 1
                while len(papers) < max_papers:
                    if page > 1:
                        soup = _search_next_page(kw, page, sub_query, total)
                        time.sleep(0.5)

                    items = _parse_items(soup)
                    if not items:
                        break

                    for item in items:
                        if len(papers) >= max_papers:
                            break

                        kmid = item["kmid"]
                        doi = item.get("doi")
                        title = item["title"]
                        check_id = doi or f"koreamed:{kmid}"

                        if check_id in existing_ids or check_id in seen_ids:
                            continue
                        seen_ids.add(check_id)

                        abstract = item.get("snippet", "")
                        if len(abstract) < 100:
                            abstract = _fetch_abstract(kmid)
                            time.sleep(0.4)

                        if not abstract:
                            log(f"[KoreaMed] 초록 없음, 스킵: {title[:50]}")
                            continue

                        if not check_relevance(title, abstract, topic):
                            log(f"[KoreaMed] 관련도 낮음 스킵: {title[:50]}")
                            continue

                        citations = get_citation_count(doi) if doi else 0

                        log(f"[KoreaMed] 수집 완료 (인용수 {citations}) [초록]: {title[:50]}")
                        papers.append({
                            "doi": doi,
                            "arxiv_id": None,
                            "title": title,
                            "authors": item.get("authors", ""),
                            "source": "koreamed",
                            "topic": topic,
                            "url": f"{BASE}/SearchBasic.php?RID={kmid}",
                            "full_text": abstract,
                            "citation_count": citations,
                            "published_date": item.get("pub_date"),
                            "crawled_date": date.today(),
                            "abstract": abstract,
                            "abstract_only": True,
                        })

                    if not _has_next_page(soup):
                        break
                    page += 1
                    time.sleep(0.5)

            except Exception as e:
                log(f"[KoreaMed] '{kw}' 검색 실패 (스킵): {e}")
                continue

        return papers
