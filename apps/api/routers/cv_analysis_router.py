"""Router: CV match analysis, suggestions, editable draft, and export."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import (
    CachedAnalysisEntry,
    CachedAnalysisListResponse,
    CVAnalysisBundleResponse,
    CVDraftRequest,
    CVDraftResponse,
    CVExportRequest,
    CVMatchRequest,
    CVMatchResponse,
    CVMatchTextRequest,
    CVSuggestionRequest,
    CVSuggestionsResponse,
)
from repositories import cv_analysis_cache_repo
from repositories.credits_repo import use_credits
from services.cv_analysis_bundle_service import analyze_cv_bundle
from services.cv_analysis_shared import gather_job_context
from services.cv_document_service import build_cv_export, extract_cv_draft, infer_cv_filename
from services.cv_match_service import compute_cv_match, compute_cv_match_from_data
from services.cv_suggestions_service import generate_cv_suggestions
from services.api_keys_service import require_openai_key, get_key, NO_KEY_DETAIL
from utils.auth_utils import get_current_email

router = APIRouter(tags=["cv-analysis"])

_ERR_NO_CREDITS = "Not enough credits. Purchase more to continue."


@router.post("/cv-match", response_model=CVMatchResponse)
async def cv_match(
    request: CVMatchRequest,
    email: str = Depends(get_current_email),
    api_key: str = Depends(require_openai_key),
):
    if not use_credits(email, 2):
        raise HTTPException(status_code=402, detail=_ERR_NO_CREDITS)
    result = await compute_cv_match(request.job_url, request.cv_url, api_key)
    return result


@router.post("/cv-match/preview", response_model=CVMatchResponse)
async def cv_match_preview(
    request: CVMatchTextRequest,
    email: str = Depends(get_current_email),
    api_key: str = Depends(require_openai_key),
):
    job_context = await gather_job_context(request.job_url)
    if not job_context:
        raise HTTPException(status_code=400, detail="Could not fetch job details.")
    result = await compute_cv_match_from_data(job_context, request.cv_text, api_key, deterministic=True)
    return result


@router.delete("/cv-analysis-bundle")
async def cv_analysis_bundle_delete(
    job_url: str,
    cv_url: str,
    email: str = Depends(get_current_email),
):
    cv_analysis_cache_repo.delete_cv_analysis(email, cv_url, job_url)
    return {"ok": True}


@router.get("/cv-analysis-bundle/list", response_model=CachedAnalysisListResponse)
async def cv_analysis_bundle_list(
    job_url: str,
    email: str = Depends(get_current_email),
):
    rows = cv_analysis_cache_repo.get_cv_analyses_for_job(email, job_url)
    entries = [
        CachedAnalysisEntry(
            cv_url=row["cv_url"],
            cv_name=row["cv_name"],
            analysis=CVMatchResponse(**row["analysis"]),
        )
        for row in rows
    ]
    return CachedAnalysisListResponse(entries=entries)


@router.post("/cv-analysis-bundle", response_model=CVAnalysisBundleResponse)
async def cv_analysis_bundle(
    request: CVMatchRequest,
    email: str = Depends(get_current_email),
):
    if request.demo:
        from demo.demo_data import DEMO_CV_BUNDLE
        return DEMO_CV_BUNDLE

    # Cache hits are free and need no key; a fresh analysis requires the user's key.
    cached = cv_analysis_cache_repo.get_cv_analysis(email, request.cv_url, request.job_url)
    api_key = ""
    if not cached:
        api_key = get_key(email) or ""
        if not api_key:
            raise HTTPException(status_code=403, detail=NO_KEY_DETAIL)
        if not use_credits(email, 2):
            raise HTTPException(status_code=402, detail=_ERR_NO_CREDITS)

    return await analyze_cv_bundle(request.job_url, request.cv_url, api_key, email=email, cv_name=request.cv_name)


@router.post("/cv-suggestions", response_model=CVSuggestionsResponse)
async def cv_suggestions(
    request: CVSuggestionRequest,
    email: str = Depends(get_current_email),
):
    # Return cached suggestions for free unless the user explicitly forces a refresh
    if not request.force_regenerate:
        cached = cv_analysis_cache_repo.get_cv_analysis(email, request.cv_url, request.job_url)
        if cached and cached.get("suggestions") and cached["suggestions"].get("suggestions"):
            return cached["suggestions"]

    # Generating fresh suggestions requires the user's own OpenAI key.
    api_key = get_key(email) or ""
    if not api_key:
        raise HTTPException(status_code=403, detail=NO_KEY_DETAIL)

    if not use_credits(email, 3):
        raise HTTPException(status_code=402, detail=_ERR_NO_CREDITS)

    result = await generate_cv_suggestions(request.job_url, request.cv_url, api_key, analysis=request.analysis)

    # Persist suggestions into the cache entry so future loads are free
    existing = cv_analysis_cache_repo.get_cv_analysis(email, request.cv_url, request.job_url)
    if existing:
        cv_analysis_cache_repo.set_cv_analysis(
            email, request.cv_url, request.job_url,
            existing["analysis"], result, existing.get("cv_name", ""),
        )

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
