import os

TOPICS = {
    "근비대": ["muscle hypertrophy", "skeletal muscle growth", "muscle protein synthesis"],
    "해부학": ["musculoskeletal anatomy", "body composition", "anatomical structure"],
    "자세교정": ["posture correction", "postural alignment", "spinal alignment"],
    "영양학": ["sports nutrition", "dietary protein", "macronutrient timing"],
    "탈모치료": ["hair loss treatment", "androgenetic alopecia", "hair follicle", "alopecia treatment"],
    "노화": ["aging", "longevity", "anti-aging", "cellular senescence"],
    "웨이트 트레이닝": ["resistance training", "strength training", "weightlifting", "progressive overload"],
    "수면": ["sleep quality", "sleep deprivation", "circadian rhythm", "sleep and recovery"],
    "다이어트": ["weight loss", "caloric restriction", "fat loss", "obesity diet", "dietary intervention"],
}
PAPERS_PER_TOPIC = int(os.getenv("PAPERS_PER_TOPIC", "5"))
MIN_CITATIONS = int(os.getenv("MIN_CITATIONS", "10"))
