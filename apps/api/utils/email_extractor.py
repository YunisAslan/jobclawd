import re

EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

# Platform emails that should be excluded (false positives)
EXCLUDED_DOMAINS = {
    "jobsearch.az",
    "example.com",
    "test.com",
}


def extract_emails(text: str) -> list[str]:
    """Extract email addresses from text, filtering out platform emails."""
    raw_emails = EMAIL_PATTERN.findall(text)
    filtered = []
    seen = set()
    for email in raw_emails:
        email_lower = email.lower()
        domain = email_lower.split("@")[1] if "@" in email_lower else ""
        if domain not in EXCLUDED_DOMAINS and email_lower not in seen:
            seen.add(email_lower)
            filtered.append(email)
    return filtered
