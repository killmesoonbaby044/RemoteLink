"""FastAPI application factory / entry point.

Run with:  uvicorn main:app --reload   (from the project root)
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import STATIC_DIR
from app.routers import register_routers

app = FastAPI(title="SSH Terminal")
# print(getpass.getpass())
# print(getpass.getuser())
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
register_routers(app=app)
