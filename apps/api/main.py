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
from routers import settings_router
from routers import profile_router
from scraper import shutdown_browser
from db.database import init_db


async def _cache_cleanup_loop() -> None:
    """Background task: delete expired search_cache rows every hour."""
    while True:
        await asyncio.sleep(3600)
        try:
            from repositories.cache_repo import delete_expired_cache
            deleted = delete_expired_cache()
            if deleted:
                print(f"[Cache] Cleaned up {deleted} expired entries")
        except Exception as exc:
            print(f"[Cache] Cleanup error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
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
app.include_router(settings_router.router, prefix="/api")
app.include_router(profile_router.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
