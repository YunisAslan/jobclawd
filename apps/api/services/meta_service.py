from db.database import get_db
from models.schemas import MetaFiltersResponse, FilterOption, CountryOption, CityOption


CATEGORY_MAP = {
    "source": "sources",
    "work_mode": "work_modes",
    "experience": "experience_levels",
    "job_type": "job_types",
    "date_posted": "date_posted",
    "sort": "sort_options",
}

# Display order for the Source filter dropdown (jobsearch last)
SOURCE_ORDER = [
    "linkedin",
    "indeed",
    "glassdoor",
    "wellfound",
    "ziprecruiter",
    "remoteok",
    "simplify",
    "dice",
    "jobgether",
    "remoteco",
    "weworkremotely",
    "jobsearch",
]


def get_all_filters() -> MetaFiltersResponse:
    with get_db() as conn:
        filters_rows = conn.execute("SELECT category, value, label FROM filter_options").fetchall()
        countries_rows = conn.execute("SELECT code, name, flag, currency FROM countries").fetchall()
        cities_rows = conn.execute("SELECT value, country_code, name FROM cities").fetchall()

    buckets: dict[str, list[FilterOption]] = {key: [] for key in CATEGORY_MAP.values()}

    for r in filters_rows:
        bucket_name = CATEGORY_MAP.get(r["category"])
        if bucket_name:
            buckets[bucket_name].append(FilterOption(value=r["value"], label=r["label"]))

    cities_by_country: dict[str, list[CityOption]] = {}
    for city in cities_rows:
        cities_by_country.setdefault(city["country_code"], []).append(
            CityOption(value=city["value"], label=city["name"])
        )

    countries = [
        CountryOption(
            value=cr["code"],
            label=cr["name"],
            flag=cr["flag"],
            currency=cr["currency"],
            cities=cities_by_country.get(cr["code"], []),
        )
        for cr in countries_rows
    ]

    # Enforce explicit display order for sources (jobsearch last)
    sources_index = {v: i for i, v in enumerate(SOURCE_ORDER)}
    buckets["sources"].sort(key=lambda o: sources_index.get(o.value, len(SOURCE_ORDER)))

    return MetaFiltersResponse(
        sources=buckets["sources"],
        work_modes=buckets["work_modes"],
        experience_levels=buckets["experience_levels"],
        job_types=buckets["job_types"],
        date_posted=buckets["date_posted"],
        sort_options=buckets["sort_options"],
        countries=countries,
    )
