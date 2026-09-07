from __future__ import annotations

import webbrowser

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import STATIC_DIR
from app.core.exception_handlers import exception_handlers
from app.core.lifespan import lifespan
from app.core.middleware import AuthRedirectMiddleware
from app.core.port_app_resolve import get_app_port
from app.routers import register_routers

app = FastAPI(
    title="RemoteLink\OPS Terminal",
    lifespan=lifespan,
    exception_handlers=exception_handlers,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(AuthRedirectMiddleware)  # type: ignore[arg-type]

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
register_routers(app=app)

if __name__ == "__main__":
    port = get_app_port()
    webbrowser.open(f"http://127.0.0.1:{port}/docs")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
