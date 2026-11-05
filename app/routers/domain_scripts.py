from typing import Annotated

from fastapi import HTTPException, Query, UploadFile, File, APIRouter, Depends
from loguru import logger

from app.core.auth.auth_manager import validate_user
from app.core.database.blob_store import domain_store
from app.services.domain.ad_search import run_search
from app.services.domain.doc_parsing import parse_document
from app.services.domain.schema import ScriptQueryParams, ScriptAddUser
from app.services.domain.sync_AD_schema import ad_schema_search

router = APIRouter(
    prefix="/domain",
    tags=["Domain Scripts"],
    dependencies=[Depends(validate_user)],
)


@router.post("/scripts")
async def run_script_endpoint(
    request_params: Annotated[ScriptQueryParams, Query()],
) -> dict:

    result = await run_search(request_params)

    if "users" in request_params.script and request_params.folder == "root":
        result = [f'{item["Name"]}[{item["SamAccountName"]}]' for item in result]
    return {"result": result}


@router.post("/script/upload_user_file")
async def upload(file: UploadFile = File(...)):
    return parse_document(file.file)


@router.post("/script/add_user")
async def add_user(user: ScriptAddUser) -> dict:
    script_params = ScriptQueryParams(
        folder="domain", script="create_user", args=list(user.model_dump().values())
    )
    result = await run_search(script_params)
    return {"result": result}


@router.get("/script/get_users")
async def get_users(dn: Annotated[str, Query()]) -> dict:
    script_params = ScriptQueryParams(folder="domain", script="users_by_OU", args=[dn])
    result = await run_search(script_params)
    return {"users": result}


@router.get("/inventory/data")
async def get_domain_schema() -> dict:
    return await domain_store.get()


@router.post("/inventory/data")
async def sync_domain_schema() -> dict:
    params = ScriptQueryParams(folder="domain", script="get_schema")

    schema = await ad_schema_search(params)

    if not schema:
        logger.warning("Empty payload from AD schema SYNC")
        old_schema = await domain_store.get()  # <- see question below
        if not old_schema:
            raise HTTPException(
                status_code=404, detail="Empty payload from AD schema SYNC"
            )

    return await domain_store.replace(schema)
