import os
import re

import requests

KCI_API_KEY = os.getenv("KCI_API_KEY", "")


def get_citation_count(doi_or_title: str) -> int:
    # 1) Semantic Scholar — DOI 직접 조회
    try:
        r = requests.get(
            f"https://api.semanticscholar.org/graph/v1/paper/{doi_or_title}?fields=citationCount",
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("citationCount", 0)
    except Exception:
        pass

    # 2) Semantic Scholar — 제목 검색
    try:
        r = requests.get(
            "https://api.semanticscholar.org/graph/v1/paper/search",
            params={"query": doi_or_title, "fields": "citationCount"},
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json().get("data", [])
            if data:
                return data[0].get("citationCount", 0)
    except Exception:
        pass

    # DOI인지 확인 (슬래시 포함)
    is_doi = bool(doi_or_title and "/" in doi_or_title)

    # 3) CrossRef — 한국 저널 포함 DOI 등록 논문 커버
    if is_doi:
        try:
            encoded = requests.utils.quote(doi_or_title, safe="")
            r = requests.get(
                f"https://api.crossref.org/works/{encoded}",
                headers={"User-Agent": "MedicalPaperSummarizer/1.0 (mailto:admin@example.com)"},
                timeout=10,
            )
            if r.status_code == 200:
                return r.json().get("message", {}).get("is-referenced-by-count", 0)
        except Exception:
            pass

    # 4) KCI API — CrossRef에 없는 국내 저널 폴백
    if is_doi and KCI_API_KEY:
        try:
            r = requests.get(
                "https://apis.data.go.kr/B552540/KCIOpenApi/getArticleInfoSvc",
                params={"serviceKey": KCI_API_KEY, "doi": doi_or_title},
                timeout=10,
            )
            if r.status_code == 200:
                text = r.text
                # XML 응답에서 피인용수 파싱
                m = re.search(r'<citedCount>(\d+)</citedCount>', text)
                if m:
                    return int(m.group(1))
        except Exception:
            pass

    return 0
