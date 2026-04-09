import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

ROOT_ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"

if ROOT_ENV_PATH.exists():
    load_dotenv(dotenv_path=ROOT_ENV_PATH)

from fastapi.middleware.cors import CORSMiddleware

from routers import jobs
from routers import applications
from routers import stats
from routers import auth_router
from routers import meta
from routers import profile_router
from routers import saved_vacancies_router
from routers import cv_analysis_router
from routers import document_router
from scraper import shutdown_browser
from db.database import init_db


async def _cache_cleanup_loop() -> None:
    """Background task: delete expired cache and metadata rows every hour."""
    while True:
        await asyncio.sleep(3600)
        try:
            from repositories.cache_repo import delete_expired_cache
            from repositories.metadata_repo import delete_expired_metadata
            from repositories.saved_vacancies_repo import delete_expired_saved_vacancies
            from repositories.cv_analysis_cache_repo import delete_expired_cv_analysis
            deleted = delete_expired_cache()
            deleted_meta = delete_expired_metadata()
            deleted_saved = delete_expired_saved_vacancies()
            deleted_cv = delete_expired_cv_analysis()
            if deleted:
                print(f"[Cache] Cleaned up {deleted} expired entries")
            if deleted_meta:
                print(f"[Metadata] Cleaned up {deleted_meta} expired entries")
            if deleted_saved:
                print(f"[SavedVacancies] Cleaned up {deleted_saved} expired entries")
            if deleted_cv:
                print(f"[CVAnalysisCache] Cleaned up {deleted_cv} expired entries")
        except Exception as exc:
            print(f"[Cache] Cleanup error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    # ── AI metadata status ──
    from services.ai_metadata_extractor import ai_metadata_enabled, _OPENAI_MODEL, _OPENAI_BASE_URL
    if ai_metadata_enabled():
        print(f"[AIMetadata] ENABLED — model={_OPENAI_MODEL} base_url={_OPENAI_BASE_URL}")
    else:
        print("[AIMetadata] DISABLED — OPENAI_API_KEY is missing or empty. "
              "Job metadata extraction will use regex fallback only.")

    cleanup_task = asyncio.create_task(_cache_cleanup_loop())
    yield
    cleanup_task.cancel()
    await shutdown_browser()


app = FastAPI(
    title="JobClawd API",
    version="2.0.0",
    lifespan=lifespan,
)

_raw_origins = os.getenv("ALLOWED_ORIGINS", os.getenv("FRONTEND_URL", "http://localhost:3000"))
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
app.include_router(profile_router.router, prefix="/api")
app.include_router(saved_vacancies_router.router, prefix="/api")
app.include_router(cv_analysis_router.router, prefix="/api")
app.include_router(document_router.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
