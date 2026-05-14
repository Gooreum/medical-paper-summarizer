from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from app.database import run_migrations
    run_migrations()
    from app.scheduler import start_scheduler
    start_scheduler(app)
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import crawl, papers, schedule

app.include_router(papers.router, prefix="/api")
app.include_router(crawl.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "service": "medical-paper-summarizer"}
