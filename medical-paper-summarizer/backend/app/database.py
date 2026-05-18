import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./papers.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    from sqlalchemy import text
    with engine.connect() as conn:
        stmts = [
            "CREATE INDEX IF NOT EXISTS ix_papers_crawled_date ON papers (crawled_date)",
            "CREATE INDEX IF NOT EXISTS ix_papers_published_date ON papers (published_date)",
            "CREATE INDEX IF NOT EXISTS ix_papers_citation_count ON papers (citation_count)",
            "CREATE INDEX IF NOT EXISTS ix_papers_source ON papers (source)",
        ]
        for stmt in stmts:
            conn.execute(text(stmt))
        conn.commit()

        # nullable column additions — SQLite ignores duplicate column errors
        for stmt in [
            "ALTER TABLE crawl_events ADD COLUMN paper_id INTEGER",
            "ALTER TABLE crawl_events ADD COLUMN url TEXT",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # column already exists
