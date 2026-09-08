from __future__ import annotations

import sys
import webbrowser

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import STATIC_DIR
from app.core.exception_handlers import exception_handlers
from app.core.lifespan import lifespan
from app.core.middleware import AuthRedirectMiddleware
from app.ip_app_resolve import get_app_ip, is_port_free
from app.routers import register_routers

app = FastAPI(
    title="RemoteLink — OPS Terminal",
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
    ip = get_app_ip()
    if not is_port_free(ip):
        print("App already running for this user.")
        sys.exit(1)
    webbrowser.open(f"http://{ip}/")
    uvicorn.run("main:app", host=ip, port=80)
    # uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
