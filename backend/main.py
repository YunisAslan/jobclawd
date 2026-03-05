from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import jobs
from routers import applications
from routers import stats
from routers import auth_router
from routers import meta
from routers import settings_router
from scraper import shutdown_browser
from db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    await shutdown_browser()


app = FastAPI(
    title="JobClawd API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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

@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
