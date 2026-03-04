import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models.schemas import SearchRequest, JobSource, LocationFilter
from routers.jobs import search_jobs
from db.database import get_db

async def main():
    req = SearchRequest(
        query="frontend",
        location=LocationFilter(type="city", values=["az-baku"]),
        workModes=["onsite"]
    )
    res = await search_jobs(req)
    for j in res.jobs:
        print(f"[{j.source}] {j.title}")
        print(f"   => loc: {j.location_str}")
        print(f"   => desc: {j.url}")

if __name__ == "__main__":
    asyncio.run(main())
