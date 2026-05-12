import re
import xml.etree.ElementTree as ET
from datetime import date
from typing import Optional

import fitz
import requests
from bs4 import BeautifulSoup

from app.crawlers.scihub_resolver import SciHubResolver

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; MedicalPaperSummarizer/1.0)"}
_resolver = SciHubResolver()


def fetch_from_url(url: str) -> dict:
    """
    Fetch paper metadata and full text from a URL.
    Returns dict with: title, authors, abstract, full_text, doi, url, published_date, source, abstract_only
    Raises ValueError with a user-friendly message on failure.
    """
    url = url.strip()

    # PubMed
    pmid = _extract_pmid(url)
    if pmid:
        return _fetch_pubmed(pmid, url)

    # bioRxiv / medRxiv
    doi = _extract_biorxiv_doi(url)
    if doi:
        server = "medrxiv" if "medrxiv" in url else "biorxiv"
        return _fetch_biorxiv(doi, server, url)

    # DOI redirect (doi.org)
    doi = _extract_doi_org(url)
    if doi:
        return _fetch_by_doi(doi, url)

    # Direct PDF
    if url.lower().endswith(".pdf") or "pdf" in url.lower():
        return _fetch_pdf_url(url)

    # Fallback: generic HTML
    return _fetch_html(url)


def _extract_pmid(url: str) -> Optional[str]:
    m = re.search(r'pubmed\.ncbi\.nlm\.nih\.gov/(\d+)', url)
    return m.group(1) if m else None


def _extract_biorxiv_doi(url: str) -> Optional[str]:
    m = re.search(r'(?:biorxiv|medrxiv)\.org/content/(10\.\d+/[^\s?#v]+)', url)
    if m:
        return m.group(1).rstrip('/')
    return None


def _extract_doi_org(url: str) -> Optional[str]:
    m = re.search(r'(?:dx\.)?doi\.org/(10\.\d+/.+)', url)
    if m:
        return m.group(1).split('?')[0].rstrip('/')
    return None


def _fetch_pubmed(pmid: str, original_url: str) -> dict:
    r = requests.get(
        f"{EUTILS}/efetch.fcgi",
        params={"db": "pubmed", "id": pmid, "rettype": "xml", "retmode": "xml"},
        headers=HEADERS,
        timeout=30,
    )
    r.raise_for_status()
    root = ET.fromstring(r.content)

    art = root.find(".//Article")
    if art is None:
        raise ValueError(f"PubMed PMID {pmid}에서 논문 정보를 찾을 수 없습니다.")

    title = art.findtext("ArticleTitle") or ""
    abstract_parts = [t.text or "" for t in art.findall(".//AbstractText")]
    abstract = " ".join(abstract_parts).strip()

    doi = None
    pmc_id = None
    for id_node in root.findall(".//ArticleId"):
        if id_node.get("IdType") == "doi":
            doi = id_node.text
        elif id_node.get("IdType") == "pmc":
            pmc_id = id_node.text

    authors = ", ".join(
        f"{a.findtext('ForeName') or ''} {a.findtext('LastName') or ''}".strip()
        for a in art.findall(".//Author")
        if a.findtext("LastName")
    )

    pub_date = None
    try:
        _MONTHS = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,
                   "Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
        pd_node = art.find(".//PubDate")
        if pd_node is not None:
            y = int(pd_node.findtext("Year") or 0)
            m_raw = pd_node.findtext("Month") or "1"
            m = int(m_raw) if m_raw.isdigit() else _MONTHS.get(m_raw[:3], 1)
            d_raw = pd_node.findtext("Day") or "1"
            d = int(d_raw) if d_raw.isdigit() else 1
            if y:
                pub_date = date(y, m, d)
    except Exception:
        pass

    full_text = ""
    abstract_only = False

    if pmc_id:
        try:
            r2 = requests.get(
                f"{EUTILS}/efetch.fcgi",
                params={"db": "pmc", "id": pmc_id, "rettype": "full", "retmode": "xml"},
                headers=HEADERS,
                timeout=30,
            )
            if r2.ok and len(r2.text) > 500:
                full_text = r2.text
        except Exception:
            pass

    if not full_text and doi:
        pdf_bytes = _resolver.fetch_pdf_by_doi(doi)
        if pdf_bytes:
            try:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                raw = "\n".join(page.get_text() for page in doc).strip()
                if raw:
                    full_text = raw[:45000]
            except Exception:
                pass

    if not full_text:
        if abstract:
            full_text = abstract
            abstract_only = True
        else:
            raise ValueError(f"PubMed PMID {pmid}: 초록과 전문 모두 가져올 수 없습니다. 해당 논문은 오픈 액세스가 아닐 수 있습니다.")

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "full_text": full_text,
        "doi": doi,
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "published_date": pub_date,
        "source": "pubmed",
        "abstract_only": abstract_only,
    }


def _fetch_biorxiv(doi: str, server: str, original_url: str) -> dict:
    # Try EuropePMC for metadata
    try:
        r = requests.get(
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            params={"query": f"DOI:{doi}", "format": "json", "resultType": "core"},
            headers=HEADERS,
            timeout=20,
        )
        results = r.json().get("resultList", {}).get("result", [])
        item = results[0] if results else {}
    except Exception:
        item = {}

    title = item.get("title", "").strip() or doi
    authors = item.get("authorString", "").strip()
    abstract = item.get("abstractText", "").strip()

    pub_date = None
    try:
        pub_date = date.fromisoformat(item.get("firstPublicationDate", ""))
    except Exception:
        pass

    # PDF fetch
    full_text = _fetch_biorxiv_pdf(doi, server)
    abstract_only = False

    if not full_text:
        if abstract:
            full_text = abstract
            abstract_only = True
        else:
            raise ValueError(f"bioRxiv/medRxiv {doi}: 텍스트를 가져올 수 없습니다.")

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "full_text": full_text,
        "doi": doi,
        "url": f"https://doi.org/{doi}",
        "published_date": pub_date,
        "source": server,
        "abstract_only": abstract_only,
    }


def _fetch_biorxiv_pdf(doi: str, server: str) -> str:
    servers = [server, "medrxiv" if server == "biorxiv" else "biorxiv"]
    for srv in servers:
        base_url = f"https://www.{srv}.org/content/{doi}"
        for version in ("v1", "v2", "v3"):
            try:
                pdf_url = f"{base_url}{version}.full.pdf"
                r = requests.get(pdf_url, timeout=30, allow_redirects=True, headers=HEADERS)
                if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf"):
                    doc = fitz.open(stream=r.content, filetype="pdf")
                    raw = "\n".join(page.get_text() for page in doc)
                    if raw.strip():
                        return raw[:45000]
            except Exception:
                continue
    return ""


def _fetch_by_doi(doi: str, original_url: str) -> dict:
    # Try to detect source from DOI prefix
    if "10.1101" in doi:
        server = "biorxiv"
        return _fetch_biorxiv(doi, server, original_url)

    # Generic: try to fetch as PDF or HTML
    try:
        return _fetch_pdf_url(f"https://doi.org/{doi}")
    except Exception:
        pass

    try:
        return _fetch_html(f"https://doi.org/{doi}")
    except Exception:
        raise ValueError(f"DOI {doi}: 텍스트를 가져올 수 없습니다.")


def _fetch_pdf_url(url: str) -> dict:
    r = requests.get(url, timeout=30, allow_redirects=True, headers=HEADERS)
    r.raise_for_status()

    content_type = r.headers.get("content-type", "")
    if "pdf" not in content_type and not url.lower().endswith(".pdf"):
        # Not a PDF — try HTML fallback
        return _fetch_html_from_response(url, r)

    doc = fitz.open(stream=r.content, filetype="pdf")
    raw = "\n".join(page.get_text() for page in doc).strip()
    if not raw:
        raise ValueError("PDF에서 텍스트를 추출할 수 없습니다.")

    # Try to extract title from first page
    first_page_text = doc[0].get_text() if doc.page_count > 0 else ""
    title = first_page_text.split("\n")[0].strip()[:200] if first_page_text else url

    return {
        "title": title,
        "authors": "",
        "abstract": "",
        "full_text": raw[:45000],
        "doi": None,
        "url": url,
        "published_date": None,
        "source": "url",
        "abstract_only": False,
    }


def _fetch_html(url: str) -> dict:
    r = requests.get(url, timeout=30, allow_redirects=True, headers=HEADERS)
    r.raise_for_status()
    return _fetch_html_from_response(url, r)


def _fetch_html_from_response(url: str, r: requests.Response) -> dict:
    soup = BeautifulSoup(r.text, "html.parser")

    # Meta tags
    title = (
        _meta(soup, "citation_title")
        or _meta(soup, "og:title")
        or (soup.find("title").get_text(strip=True) if soup.find("title") else "")
        or url
    )
    authors = _meta(soup, "citation_author") or _meta(soup, "author") or ""
    abstract = _meta(soup, "citation_abstract") or _meta(soup, "description") or ""
    doi = _meta(soup, "citation_doi") or ""

    pub_date = None
    date_str = _meta(soup, "citation_publication_date") or _meta(soup, "citation_online_date") or ""
    if date_str:
        try:
            pub_date = date.fromisoformat(date_str[:10])
        except Exception:
            pass

    # Body text extraction
    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    article = soup.find("article") or soup.find("main") or soup.find("body")
    full_text = article.get_text(separator="\n", strip=True) if article else soup.get_text(separator="\n", strip=True)
    full_text = re.sub(r'\n{3,}', '\n\n', full_text).strip()

    if not full_text or len(full_text) < 100:
        raise ValueError(f"URL에서 충분한 텍스트를 가져올 수 없습니다: {url}")

    abstract_only = len(full_text) < 500

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "full_text": full_text[:45000],
        "doi": doi or None,
        "url": url,
        "published_date": pub_date,
        "source": "url",
        "abstract_only": abstract_only,
    }


def _meta(soup: BeautifulSoup, name: str) -> str:
    tag = soup.find("meta", attrs={"name": name}) or soup.find("meta", attrs={"property": name})
    if tag:
        return tag.get("content", "").strip()
    return ""
