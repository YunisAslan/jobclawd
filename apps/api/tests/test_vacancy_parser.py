import json
import unittest
from pathlib import Path

from services.extraction.canonical import build_canonical_vacancy_signals
from services.extraction.deterministic import extract_deterministic


FIXTURES_PATH = Path(__file__).parent / "fixtures" / "vacancy_parser_cases.json"


class VacancyParserRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.cases = json.loads(FIXTURES_PATH.read_text())

    def test_regression_corpus(self) -> None:
        for case in self.cases:
            with self.subTest(case=case["name"]):
                report = extract_deterministic(
                    title=case.get("title", ""),
                    description=case.get("description", ""),
                    location_str=case.get("location_str"),
                    source=case.get("source_family", "fixture"),
                    card_data=case.get("card_data"),
                    structured_fields=case.get("structured_fields"),
                )
                flat = report.to_flat_dict()
                for key, expected in case["expected"].items():
                    if expected is None:
                        self.assertFalse(flat.get(key), f"{case['name']} unexpectedly set {key}={flat.get(key)!r}")
                    else:
                        self.assertEqual(flat.get(key), expected, f"{case['name']} expected {key}={expected!r} but got {flat.get(key)!r}")

    def test_canonical_structure_groups_sections_and_signals(self) -> None:
        canonical = build_canonical_vacancy_signals(
            title="Backend Engineer",
            description=(
                "About the job\nWe build infrastructure.\n"
                "Responsibilities\nLead the platform migration.\n"
                "Qualifications\n3+ years of backend experience.\n"
                "Benefits\nRemote-first setup."
            ),
            location_str="Toronto, Canada",
            source="greenhouse",
            card_data={
                "labels": ["Remote", "Full-time", "Mid-level"],
                "workplace_type": "Remote",
                "employment_type": "Full-time",
                "seniority_level": "Mid-level",
            },
            structured_fields={
                "job_type": "Full-time",
                "work_mode": "Remote",
                "seniority": "Mid-level",
            },
        )

        self.assertEqual(canonical.primary_location, "Toronto, Canada")
        self.assertIn("Remote", canonical.workplace_type_raw)
        self.assertIn("Full-time", canonical.employment_type_raw)
        self.assertIn("Mid-level", canonical.seniority_raw)
        self.assertIn("3+ years of backend experience.", canonical.requirements_text)
        self.assertIn("Lead the platform migration.", canonical.responsibilities_text)
        self.assertIn("Remote-first setup.", canonical.benefits_text)


if __name__ == "__main__":
    unittest.main()
