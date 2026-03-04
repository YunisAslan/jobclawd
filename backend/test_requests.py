import requests
resp = requests.get("https://www.jobsearch.az/api-az/vacancies-az?search=developer", headers={"User-Agent": "Mozilla/5.0"})
data = resp.json()
if data.get("items"):
    import json
    print(json.dumps(data["items"][0], indent=2))
