"""Router: CV match analysis, suggestions, editable draft, and export."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import (
    CVAnalysisBundleResponse,
    CVDraftRequest,
    CVDraftResponse,
    CVExportRequest,
    CVMatchRequest,
    CVMatchResponse,
    CVSuggestionRequest,
    CVSuggestionsResponse,
)
from services.cv_analysis_bundle_service import analyze_cv_bundle
from services.cv_document_service import build_cv_export, extract_cv_draft, infer_cv_filename
from services.cv_match_service import compute_cv_match
from services.cv_suggestions_service import generate_cv_suggestions
from utils.auth_utils import get_current_email

router = APIRouter(tags=["cv-analysis"])


@router.post("/cv-match", response_model=CVMatchResponse)
async def cv_match(
    request: CVMatchRequest,
    email: str = Depends(get_current_email),
):
    result = await compute_cv_match(request.job_url, request.cv_url)
    return result


@router.post("/cv-analysis-bundle", response_model=CVAnalysisBundleResponse)
async def cv_analysis_bundle(
    request: CVMatchRequest,
    email: str = Depends(get_current_email),
):
    return await analyze_cv_bundle(request.job_url, request.cv_url)


@router.post("/cv-suggestions", response_model=CVSuggestionsResponse)
async def cv_suggestions(
    request: CVSuggestionRequest,
    email: str = Depends(get_current_email),
):
    result = await generate_cv_suggestions(request.job_url, request.cv_url)
    return result


@router.post("/cv-draft", response_model=CVDraftResponse)
async def cv_draft(
    request: CVDraftRequest,
    email: str = Depends(get_current_email),
):
    text = extract_cv_draft(request.cv_url)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from CV.")
    return {
        "text": text,
        "file_name": infer_cv_filename(request.cv_url),
    }


@router.post("/cv-export")
async def cv_export(
    request: CVExportRequest,
    email: str = Depends(get_current_email),
):
    content = (request.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="CV content is empty.")

    stream, filename, media_type = build_cv_export(
        content,
        request.file_name or infer_cv_filename(request.cv_url),
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    return StreamingResponse(
        stream,
        media_type=media_type,
        headers=headers,
    )
