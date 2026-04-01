"""Saved Vacancies Service — save/unsave/list/check business logic."""

from repositories import saved_vacancies_repo


def save_vacancy(user_email: str, job_url: str, job_data: dict) -> int:
    return saved_vacancies_repo.save_vacancy(user_email, job_url, job_data)


def unsave_vacancy(user_email: str, job_url: str) -> bool:
    return saved_vacancies_repo.unsave_vacancy(user_email, job_url)


def get_saved_vacancies(user_email: str) -> dict:
    vacancies = saved_vacancies_repo.get_saved_vacancies(user_email)
    return {"vacancies": vacancies, "total": len(vacancies)}


def check_saved_urls(user_email: str, job_urls: list[str]) -> list[str]:
    return saved_vacancies_repo.check_saved_urls(user_email, job_urls)
