import re
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Depends

from app.core.auth.auth_manager import validate_user
from app.services.domain.ad_search import run_search
from app.services.domain.schema import ScriptQueryParams
from app.services.domain.sync_AD_schema import ad_schema_search

from app.services.sessions.script_helpers import InvalidScriptError

router = APIRouter(dependencies=[Depends(validate_user)])


_ARG_BRACKET = re.compile(r"\[(.*)]")


@router.post("/domain/scripts")
async def run_script_endpoint(
    request_params: Annotated[ScriptQueryParams, Query()],
) -> dict:

    try:
        result = await run_search(request_params or None)
    except InvalidScriptError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if "search_users" in request_params.script:
        result = [f'{item["Name"]}[{item["SamAccountName"]}]' for item in result]
    return {"result": result}


@router.get("/domain/scripts/get_schema")
async def get_schema():
    schema = await ad_schema_search()
    return schema
