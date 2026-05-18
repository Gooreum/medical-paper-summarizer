import os
from datetime import date
from typing import Dict, List

TOPICS: Dict[str, dict] = {
    "근비대": {
        "keywords": [
            "muscle hypertrophy", "skeletal muscle growth",
            "muscle protein synthesis", "myofibrillar hypertrophy",
            "muscle mass gain resistance training",
        ],
        "mesh": ["Muscle, Skeletal", "Hypertrophy", "Muscle Proteins"],
        "pubmed_types": ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial", "Clinical Trial"],
        "biorxiv_citation_filter": False,
    },
    "해부학": {
        "keywords": [
            "musculoskeletal anatomy", "muscle architecture",
            "anatomical variation", "skeletal muscle fiber type",
        ],
        "mesh": ["Musculoskeletal System", "Anatomy"],
        "pubmed_types": ["Review", "Systematic Review", "Meta-Analysis"],
        "biorxiv_citation_filter": False,
    },
    "자세교정": {
        "keywords": [
            "posture correction", "postural alignment",
            "spinal alignment rehabilitation", "musculoskeletal posture",
            "postural rehabilitation exercise",
        ],
        "mesh": ["Posture", "Spinal Curvatures", "Musculoskeletal Rehabilitation"],
        "pubmed_types": ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial"],
        "biorxiv_citation_filter": False,
    },
    "영양학": {
        "keywords": [
            "sports nutrition", "dietary protein muscle",
            "protein intake exercise", "nutritional supplementation performance",
            "macronutrient body composition",
        ],
        "mesh": ["Sports Nutritional Sciences", "Dietary Proteins", "Nutritional Status"],
        "pubmed_types": ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial"],
        "biorxiv_citation_filter": False,
    },
    "탈모치료": {
        "keywords": [
            "hair loss treatment", "androgenetic alopecia",
            "hair follicle regeneration", "alopecia treatment efficacy",
            "hair growth therapy clinical",
        ],
        "mesh": ["Alopecia", "Hair Follicle", "Alopecia, Androgenetic"],
        "pubmed_types": ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial", "Clinical Trial"],
        "biorxiv_citation_filter": False,
    },
    "노화": {
        "keywords": [
            "aging longevity intervention", "anti-aging",
            "cellular senescence", "age-related decline",
            "healthspan lifespan extension",
        ],
        "mesh": ["Aging", "Longevity", "Cellular Senescence"],
        "pubmed_types": ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial", "Review"],
        "biorxiv_citation_filter": False,
    },
    "웨이트 트레이닝": {
        "keywords": [
            "resistance training adaptation", "strength training",
            "progressive overload", "resistance exercise performance",
            "weightlifting muscle strength",
        ],
        "mesh": ["Resistance Training", "Muscle Strength", "Physical Conditioning, Human"],
        "pubmed_types": ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial"],
        "biorxiv_citation_filter": False,
    },
    "수면": {
        "keywords": [
            "sleep quality health", "sleep deprivation",
            "circadian rhythm sleep", "sleep duration outcome",
            "sleep intervention recovery",
        ],
        "mesh": ["Sleep", "Sleep Deprivation", "Circadian Rhythm"],
        "pubmed_types": ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial", "Review"],
        "biorxiv_citation_filter": False,
    },
    "다이어트": {
        "keywords": [
            "weight loss intervention", "caloric restriction",
            "dietary intervention obesity", "fat loss diet",
            "energy restriction weight management",
        ],
        "mesh": ["Weight Loss", "Caloric Restriction", "Obesity"],
        "pubmed_types": ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial"],
        "biorxiv_citation_filter": False,
    },
}

PAPERS_PER_TOPIC = int(os.getenv("PAPERS_PER_TOPIC", "5"))
MIN_CITATIONS = int(os.getenv("MIN_CITATIONS", "10"))


def get_keywords(topic: str) -> List[str]:
    cfg = TOPICS.get(topic, {})
    return cfg.get("keywords", [topic]) if isinstance(cfg, dict) else list(cfg)


def get_mesh(topic: str) -> List[str]:
    cfg = TOPICS.get(topic, {})
    return cfg.get("mesh", []) if isinstance(cfg, dict) else []


def get_pubmed_types(topic: str) -> List[str]:
    cfg = TOPICS.get(topic, {})
    default = ["Systematic Review", "Meta-Analysis", "Randomized Controlled Trial"]
    return cfg.get("pubmed_types", default) if isinstance(cfg, dict) else default


def get_koreamed_keywords(topic: str) -> List[str]:
    """Korean topic name first, then top English keywords for KoreaMed."""
    return [topic] + get_keywords(topic)[:2]


def use_biorxiv_citation_filter(topic: str) -> bool:
    cfg = TOPICS.get(topic, {})
    return cfg.get("biorxiv_citation_filter", False) if isinstance(cfg, dict) else False


def build_pubmed_queries(topic: str) -> List[str]:
    """Return tiered PubMed queries from most to least restrictive (max 4)."""
    keywords = get_keywords(topic)
    mesh = get_mesh(topic)
    pub_types = get_pubmed_types(topic)

    today = date.today()
    y5 = today.year - 5
    y3 = today.year - 3

    type_filter = " OR ".join(f"{pt}[pt]" for pt in pub_types)
    hq_filter = "Systematic Review[pt] OR Meta-Analysis[pt]"

    queries: List[str] = []

    # Tier 1: MeSH + SR/MA + 5 years  (highest precision)
    if mesh:
        mesh_q = " OR ".join(f'"{m}"[MH]' for m in mesh)
        queries.append(
            f'({mesh_q}) AND ({hq_filter}) AND ("{y5}"[PDAT]:"{today.year}"[PDAT])'
        )

    # Tier 2: top keyword + all study types
    if keywords:
        queries.append(f'"{keywords[0]}"[Title/Abstract] AND ({type_filter})')

    # Tier 3: second keyword + all study types (if available)
    if len(keywords) > 1:
        queries.append(f'"{keywords[1]}"[Title/Abstract] AND ({type_filter})')

    # Tier 4: top keyword, no type filter, recent 3 years (broadest fallback)
    if keywords:
        queries.append(f'"{keywords[0]}"[Title/Abstract] AND ("{y3}"[PDAT]:"{today.year}"[PDAT])')

    return queries
