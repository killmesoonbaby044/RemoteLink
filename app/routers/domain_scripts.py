from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File
from loguru import logger

from app.core.auth.auth_manager import validate_user
from app.core.database.blob_store import domain_store
from app.services.domain.ad_search import run_search
from app.services.domain.doc_parsing import parse_document
from app.services.domain.schema import ScriptQueryParams, ScriptAddUser
from app.services.domain.sync_AD_schema import ad_schema_search

router = APIRouter(prefix="/domain", dependencies=[Depends(validate_user)])


@router.post("/scripts")
async def run_script_endpoint(
    request_params: Annotated[ScriptQueryParams, Query()],
) -> dict:

    result = await run_search(request_params)

    if "search_users" in request_params.script:
        result = [f'{item["Name"]}[{item["SamAccountName"]}]' for item in result]
    return {"result": result}


@router.post("/script/add_user")
async def run_script_endpoint(
    user: ScriptAddUser,
) -> dict:
    print(user)
    return {"result": user}


@router.post("/script/upload_user_file")
async def upload(file: UploadFile = File(...)):
    print("file")
    return parse_document(file.file)


@router.get("/inventory")
async def get_domain() -> dict:
    return await domain_store.get()


@router.post("/inventory")
async def sync_domain() -> dict:
    schema = await ad_schema_search()

    if not schema:
        logger.warning("Empty payload from AD schema SYNC")
        old_schema = await domain_store.get()  # <- see question below
        if not old_schema:
            raise HTTPException(
                status_code=404, detail="Empty payload from AD schema SYNC"
            )

    return await domain_store.replace(schema)
