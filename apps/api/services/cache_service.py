"""
Cache key generation for search results.
Produces a deterministic SHA-256 hash from any set of search filters
so that identical filters always map to the same cache entry,
regardless of field order or array ordering.
"""
import hashlib
import json


def make_cache_key(filters: dict) -> str:
    """
    Return a 64-char hex SHA-256 digest that uniquely identifies a filter set.

    Normalisation rules applied before hashing:
    - All dict keys are sorted alphabetically (recursive).
    - All list values are sorted so ["az","tr"] == ["tr","az"].
    - None values, empty strings, and empty lists are stripped.
    - All string values are lowercased and stripped of whitespace.
    """

    def normalize(obj):
        if obj is None:
            return None
        if isinstance(obj, str):
            return obj.strip().lower() or None
        if isinstance(obj, list):
            normed = [normalize(x) for x in obj if x is not None]
            normed = [x for x in normed if x is not None and x != ""]
            return sorted(normed, key=lambda x: json.dumps(x, sort_keys=True)) or None
        if isinstance(obj, dict):
            result = {}
            for k, v in sorted(obj.items()):
                nv = normalize(v)
                if nv is not None and nv != [] and nv != "":
                    result[k] = nv
            return result or None
        return obj

    canonical = normalize(filters)
    serialized = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
