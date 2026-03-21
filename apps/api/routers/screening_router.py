"""
Router: HTTP handlers for screening answer memory.
Thin layer — delegates to screening_repo.
"""
from fastapi import APIRouter, Depends, HTTPException

from models.schemas import ScreeningAnswersResponse, ScreeningAnswerUpsert, ScreeningAnswer
from repositories import screening_repo
from utils.auth_utils import get_current_email

router = APIRouter()


@router.get("/screening-answers", response_model=ScreeningAnswersResponse)
async def list_answers(email: str = Depends(get_current_email)):
    rows = screening_repo.get_answers(email)
    return ScreeningAnswersResponse(
        answers=[ScreeningAnswer(**r) for r in rows]
    )


@router.post("/screening-answers", response_model=ScreeningAnswer)
async def upsert_answer(
    body: ScreeningAnswerUpsert,
    email: str = Depends(get_current_email),
):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    row = screening_repo.upsert_answer(email, body.question.strip(), body.answer.strip())
    return ScreeningAnswer(**row)


@router.delete("/screening-answers/{answer_id}")
async def delete_answer(
    answer_id: int,
    email: str = Depends(get_current_email),
):
    deleted = screening_repo.delete_answer(email, answer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Answer not found.")
    return {"success": True}
