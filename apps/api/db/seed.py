import urllib.request
import json


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode("utf-8"))


def seed_data(conn):
    """
    Seed filter options and global country/city data.
    conn must be a PgConn (or any object with .execute() / .executemany()).
    Idempotent — safe to call on every startup.
    """
    filters = [
        ("source", "linkedin", "LinkedIn"),
        ("source", "indeed", "Indeed"),
        ("source", "glassdoor", "Glassdoor"),
        ("source", "wellfound", "Wellfound"),
        ("source", "ziprecruiter", "ZipRecruiter"),
        ("source", "remoteok", "RemoteOK"),
        ("source", "simplify", "Simplify"),
        ("source", "dice", "Dice"),
        ("source", "jobgether", "Jobgether"),
        ("source", "remoteco", "Remote.co"),
        ("source", "weworkremotely", "We Work Remotely"),
        ("source", "jobsearch", "Jobsearch"),
        ("work_mode", "remote", "Remote"),
        ("work_mode", "hybrid", "Hybrid"),
        ("work_mode", "onsite", "On-site"),
        ("experience", "intern", "Internship / Intern"),
        ("experience", "junior", "Junior"),
        ("experience", "mid", "Mid-Level"),
        ("experience", "senior", "Senior"),
        ("experience", "lead", "Lead / Manager"),
        ("date_posted", "1d", "Past 24 hours"),
        ("date_posted", "3d", "Past 3 days"),
        ("date_posted", "7d", "Past week"),
        ("date_posted", "1m", "Past month"),
        ("date_posted", "all", "All time"),
        ("sort", "job-title-ascending", "Job title (A-Z)"),
        ("sort", "job-title-descending", "Job title (Z-A)"),
        ("sort", "latest", "Latest"),
        ("job_type", "full-time", "Full-time"),
        ("job_type", "contract", "Contract"),
        ("job_type", "part-time", "Part-time"),
    ]

    conn.executemany(
        "INSERT INTO filter_options (category, value, label) VALUES (%s, %s, %s) "
        "ON CONFLICT (category, value) DO NOTHING",
        filters,
    )
    # Keep labels up-to-date
    conn.execute(
        "UPDATE filter_options SET label = 'Internship / Intern' "
        "WHERE category = 'experience' AND value = 'intern'"
    )
    conn.execute(
        "UPDATE filter_options SET label = 'Mid-Level' "
        "WHERE category = 'experience' AND value = 'mid'"
    )

    # Only fetch from external API once (when countries table is empty)
    c_row = conn.execute("SELECT COUNT(*) AS c FROM countries").fetchone()
    if c_row and c_row["c"] > 0:
        return

    print("Fetching global countries and cities from public API...")
    try:
        currencies = fetch_json("https://countriesnow.space/api/v0.1/countries/currency")["data"]
        flags = fetch_json("https://countriesnow.space/api/v0.1/countries/flag/unicode")["data"]
        countries_cities = fetch_json("https://countriesnow.space/api/v0.1/countries")["data"]

        currency_map = {
            item["name"].lower(): item["currency"]
            for item in currencies
            if "name" in item and "currency" in item
        }
        flag_map = {
            item["name"].lower(): (item.get("iso2", ""), item.get("unicodeFlag", ""))
            for item in flags
            if "name" in item
        }

        country_rows = []
        city_rows = []

        for item in countries_cities:
            cname = item["country"]
            clower = cname.lower()
            iso2, unicode_flag = flag_map.get(clower, (item.get("iso2", ""), ""))
            currency = currency_map.get(clower, "USD")

            if not iso2:
                words = cname.split()
                iso2 = "".join([w[0] for w in words][:2]).upper() if words else "XX"

            country_rows.append((iso2, cname, unicode_flag, currency))

            for city_name in item.get("cities", []):
                safe_val = "".join(
                    [c for c in f"{iso2}-{city_name}".lower().replace(" ", "-") if c.isalnum() or c == "-"]
                ).strip("-")
                city_rows.append((safe_val, iso2, city_name))

        if country_rows:
            conn.executemany(
                "INSERT INTO countries (code, name, flag, currency) VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (code) DO NOTHING",
                country_rows,
            )
        if city_rows:
            conn.executemany(
                "INSERT INTO cities (value, country_code, name) VALUES (%s, %s, %s) "
                "ON CONFLICT (value, country_code) DO NOTHING",
                city_rows,
            )

        print(f"Seeded {len(country_rows)} countries and {len(city_rows)} cities.")
        conn.commit()
    except Exception as e:
        print(f"Failed to fetch locations from public API: {e}")
