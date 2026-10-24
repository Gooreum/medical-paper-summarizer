# 의학 논문 AI 요약 (medical-paper-summarizer)

주제별 최신 의학·건강 논문을 매일 모으고, 의학 지식이 없는 사람도 읽을 수 있도록 한국어로 요약해 보여 주는 웹 서비스입니다.

> 최신 코드는 저장소 안의 `medical-paper-summarizer/` 폴더에 있습니다. 저장소 최상위의 `backend/`·`frontend/`는 그보다 앞선 버전입니다.

## 주요 기능

- **주제별 논문 수집**: 근비대, 해부학, 자세교정, 영양학, 탈모치료, 노화, 웨이트 트레이닝, 수면, 다이어트 주제마다 키워드·MeSH 용어로 검색어를 만들어 PubMed, bioRxiv, KoreaMed에서 논문을 모읍니다.
- **인용 수 필터**: Semantic Scholar에서 인용 수를 조회하고, 없으면 CrossRef·KCI로 보완해 최소 인용 수 기준으로 거릅니다.
- **관련도 필터**: 제목·초록의 키워드 점수로 주제와 관련 없는 논문을 뺍니다.
- **한국어 요약**: 논문 전문(PDF는 PyMuPDF로 추출)을 넘겨 "한 줄 핵심 · 왜 이 연구를 했나 · 어떻게 연구했나 · 무엇을 발견했나 · 어려운 용어 풀이 · 내 삶에서의 의미 · 오늘부터 실천하는 방법 · 주의할 점" 8개 섹션으로 요약합니다.
- **요약 모델 선택**: `SUMMARY_PROVIDER`로 Claude Code CLI(`claude -p`), Gemini, Ollama 중 하나를 고릅니다.
- **URL·텍스트 직접 요약**: PubMed·bioRxiv·DOI 링크, PDF 주소, 일반 웹 페이지 주소나 붙여 넣은 본문을 바로 요약합니다.
- **예약 수집과 진행 상황**: APScheduler가 매일 정해진 시각(기본 08:00)에 수집합니다. 관리자 화면에서 시각·주제·출처·모델을 바꿀 수 있고, 수집 진행 상황은 SSE로 실시간 표시됩니다. 지난 수집 기록에서 원문과 요약을 다시 볼 수 있습니다.
- **화면**: 주제 탭과 날짜별 논문 목록, 논문 상세, 북마크, 관리자 페이지

## 구조

```
medical-paper-summarizer/
├── backend/                 # FastAPI 서버
│   ├── app/main.py          # 앱 시작 시 DB 생성·마이그레이션, 스케줄러 시작
│   ├── app/routers/         # papers · crawl · schedule API (/api/...)
│   ├── app/crawlers/        # pubmed · biorxiv · koreamed · url_fetcher · topics · semantic_scholar(인용 수)
│   ├── app/summarizers/     # claude_code · gemini · ollama, factory.py에서 선택
│   ├── app/scheduler.py     # 매일 수집 작업
│   └── requirements.txt
└── frontend/                # Next.js 14 (App Router) · Tailwind CSS
    ├── app/                 # 목록 · papers/[id] · bookmarks · admin
    └── src/lib/api.ts       # 백엔드 주소: NEXT_PUBLIC_API_URL (기본 http://localhost:8000)
```

### API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/papers` | 논문 목록 |
| GET | `/api/papers/{paper_id}` | 논문 상세 |
| POST | `/api/papers/summarize-url` | URL로 요약 |
| POST | `/api/papers/summarize-text` | 붙여 넣은 본문 요약 |
| GET | `/api/topics`, `/api/topics/counts`, `/api/sources/counts` | 주제·출처별 개수 |
| POST | `/api/crawl/trigger` | 수집 바로 실행 |
| GET | `/api/crawl/status`, `/api/crawl/stream` | 수집 상태 (stream은 SSE) |
| GET | `/api/crawl/history`, `/api/crawl/history/{session_id}` | 수집 기록 |
| GET·PUT | `/api/schedule` | 예약 수집 설정 |

## 기술

- 백엔드: Python, FastAPI, SQLAlchemy(SQLite 기본), APScheduler, sse-starlette, Biopython(PubMed), PyMuPDF
- 프론트엔드: TypeScript, Next.js 14, React 18, SWR, Tailwind CSS
- 요약: Claude Code CLI, Gemini API, Ollama

## 로컬 실행

### 백엔드

```bash
cd medical-paper-summarizer/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt beautifulsoup4   # URL 요약(url_fetcher.py)에 beautifulsoup4가 필요하지만 requirements.txt에는 없음
cp .env.example .env                             # 값 채우기
uvicorn app.main:app --reload                    # http://localhost:8000
```

기본 요약 방식(`SUMMARY_PROVIDER=claude-code`)은 `claude` CLI가 설치·로그인되어 있어야 합니다.

### 프론트엔드

```bash
cd medical-paper-summarizer/frontend
npm install
npm run dev                                      # http://localhost:3000
```

백엔드 주소가 다르면 `NEXT_PUBLIC_API_URL`을 지정합니다.

## 환경 변수 (backend/.env)

| 이름 | 용도 |
|---|---|
| `DATABASE_URL` | DB 주소 (예시: `sqlite:///./papers.db`) |
| `SUMMARY_PROVIDER` | `claude-code` · `gemini` · `ollama` |
| `SUMMARY_MODEL` | 요약 모델 이름 (claude-code 기본 `sonnet`) |
| `GEMINI_API_KEY` | Gemini 사용 시 |
| `OLLAMA_BASE_URL` | Ollama 사용 시 |
| `NCBI_API_KEY` | PubMed 요청 한도 완화 (선택) |
| `KCI_API_KEY` | KCI 인용 수 조회 (선택) |
| `MIN_CITATIONS` | 최소 인용 수 |
| `PAPERS_PER_TOPIC` | 주제당 수집할 논문 수 |
