import re

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth.auth_manager import validate_user
from app.services.domain.script_runner import run_script
from app.services.domain.sync_AD_schema import job
from app.services.sessions.script_helpers import InvalidScriptError

# router = APIRouter(dependencies=[Depends(validate_user)])
router = APIRouter()


_ARG_BRACKET = re.compile(r"\[(.*)]")


@router.post("/domain/scripts")
async def run_script_endpoint(name: str) -> dict:
    if not name:
        raise HTTPException(status_code=400, detail="Script name is required")

    # Same "<path>|<arg>" packing convention as /ws/script.
    script_path, _, arg = name.partition("|")
    filename = f"{script_path}.ps1" if "ps" in script_path else f"{script_path}.cmd"

    if arg:
        match = _ARG_BRACKET.search(arg)
        if match:
            arg = match.group(1)

    try:
        result = await run_script(filename, arg or None)
    except InvalidScriptError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return result.to_dict()


@router.get("/domain/scripts/1")
async def get_script_1():
    a = await job()
    print(a)
    return a
