import json
import urllib.request
import gzip
from io import BytesIO

req = urllib.request.Request(
    "https://www.jobsearch.az/api-az/vacancies-az?search=developer",
    headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Accept": "application/json",
        "Accept-Encoding": "gzip"
    }
)
with urllib.request.urlopen(req) as response:
    content = response.read()
    if response.info().get('Content-Encoding') == 'gzip':
        content = gzip.GzipFile(fileobj=BytesIO(content)).read()
    
    data = json.loads(content)
    if "items" in data and len(data["items"]) > 0:
        print(json.dumps(data["items"][0], indent=2))
    else:
        print("No items found.")
