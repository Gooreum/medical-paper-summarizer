import requests


def get_citation_count(doi_or_title: str) -> int:
    try:
        url = f"https://api.semanticscholar.org/graph/v1/paper/{doi_or_title}?fields=citationCount"
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json().get("citationCount", 0)
    except Exception:
        pass

    try:
        url = "https://api.semanticscholar.org/graph/v1/paper/search"
        r = requests.get(url, params={"query": doi_or_title, "fields": "citationCount"}, timeout=10)
        if r.status_code == 200:
            data = r.json().get("data", [])
            if data:
                return data[0].get("citationCount", 0)
    except Exception:
        pass

    return 0
