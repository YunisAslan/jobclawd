"""
Vacancy Intelligence Engine — extraction pipeline package.

Layers:
  1. Deterministic extraction (regex, keywords, rules)
  2. Confidence scoring per field
  3. AI decision gate (only call AI when confidence is low)
  4. Deduplication (fingerprint-based cross-platform)
  5. Pipeline orchestrator tying everything together
"""
