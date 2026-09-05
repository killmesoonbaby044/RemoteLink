import uuid
from contextlib import asynccontextmanager
import getpass

from fastapi import FastAPI, HTTPException
from loguru import logger

from app.core.client.http import HttpClient
from app.settings import get_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    owner = getpass.getuser()
    instance_id = str(uuid.uuid4())
    client = HttpClient(get_config().auth_api)

    app.state.USER = owner
    app.state.INSTANCE_ID = instance_id
    app.state.http_client = client
    response = await client.post(
        "/register", json={"username": owner, "instance_id": instance_id}
    )
    if response.status_code != 201:
        logger.warning("app not registered")
    # raise HTTPException(status_code=500, detail="not registered")
    yield
