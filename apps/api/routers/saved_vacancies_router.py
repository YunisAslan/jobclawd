"""Router: saved vacancies CRUD endpoints.

POST   /saved-vacancies        — save a vacancy
DELETE /saved-vacancies        — unsave a vacancy
GET    /saved-vacancies        — list saved vacancies
POST   /saved-vacancies/check  — batch check which URLs are saved
"""
from fastapi import APIRouter, Depends, HTTPException

from models.schemas import (
    SaveVacancyRequest,
    UnsaveVacancyRequest,
    SavedVacanciesResponse,
    BatchCheckSavedRequest,
    BatchCheckSavedResponse,
)
from services import saved_vacancies_service
from utils.auth_utils import get_current_email

router = APIRouter(tags=["saved-vacancies"])


@router.post("/saved-vacancies")
async def save_vacancy(
    request: SaveVacancyRequest,
    email: str = Depends(get_current_email),
):
    vacancy_id = saved_vacancies_service.save_vacancy(email, request.job_url, request.job_data)
    return {"success": True, "id": vacancy_id}


@router.delete("/saved-vacancies")
async def unsave_vacancy(
    request: UnsaveVacancyRequest,
    email: str = Depends(get_current_email),
):
    deleted = saved_vacancies_service.unsave_vacancy(email, request.job_url)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved vacancy not found.")
    return {"success": True}


@router.get("/saved-vacancies", response_model=SavedVacanciesResponse)
async def list_saved_vacancies(email: str = Depends(get_current_email)):
    return saved_vacancies_service.get_saved_vacancies(email)


@router.post("/saved-vacancies/check", response_model=BatchCheckSavedResponse)
async def check_saved(
    request: BatchCheckSavedRequest,
    email: str = Depends(get_current_email),
):
    saved_urls = saved_vacancies_service.check_saved_urls(email, request.job_urls)
    return {"saved_urls": saved_urls}
