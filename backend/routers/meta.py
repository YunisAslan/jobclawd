from fastapi import APIRouter
from models.schemas import MetaFiltersResponse
from services.meta_service import get_all_filters

router = APIRouter(tags=["Meta"])


@router.get("/meta/filters", response_model=MetaFiltersResponse)
def get_filters():
    return get_all_filters()
