from fastapi import APIRouter
from models.schemas import MetaFiltersResponse, FilterOption, CountryOption, CityOption
from db.database import get_db

router = APIRouter(tags=["Meta"])

@router.get("/meta/filters", response_model=MetaFiltersResponse)
def get_filters():
    with get_db() as conn:
        filters_rows = conn.execute("SELECT category, value, label FROM filter_options").fetchall()
        countries_rows = conn.execute("SELECT code, name, flag, currency FROM countries").fetchall()
        cities_rows = conn.execute("SELECT value, country_code, name FROM cities").fetchall()

    sources = []
    work_modes = []
    experience_levels = []
    job_types = []
    date_posted = []
    sort_options = []

    for r in filters_rows:
        opt = FilterOption(value=r["value"], label=r["label"])
        cat = r["category"]
        if cat == "source":
            sources.append(opt)
        elif cat == "work_mode":
            work_modes.append(opt)
        elif cat == "experience":
            experience_levels.append(opt)
        elif cat == "job_type":
            job_types.append(opt)
        elif cat == "date_posted":
            date_posted.append(opt)
        elif cat == "sort":
            sort_options.append(opt)

    countries = []
    for cr in countries_rows:
        code = cr["code"]
        c_cities = [
            CityOption(value=city["value"], label=city["name"])
            for city in cities_rows
            if city["country_code"] == code
        ]
        countries.append(CountryOption(
            value=cr["code"],
            label=cr["name"],
            flag=cr["flag"],
            currency=cr["currency"],
            cities=c_cities
        ))

    return MetaFiltersResponse(
        sources=sources,
        work_modes=work_modes,
        experience_levels=experience_levels,
        job_types=job_types,
        date_posted=date_posted,
        sort_options=sort_options,
        countries=countries
    )
