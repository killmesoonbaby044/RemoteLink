"""FastAPI application factory / entry point.

Run with:  uvicorn main:app --reload   (from the project root)
"""

from __future__ import annotations

import socket
import webbrowser

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import STATIC_DIR
from app.routers import register_routers

app = FastAPI(title="SSH Terminal")
# print(getpass.getpass())
# print(getpass.getuser())
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
register_routers(app=app)


sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(("127.0.0.1", 0))
port = sock.getsockname()[1]
sock.close()


if __name__ == "__main__":
    webbrowser.open(f"http://127.0.0.1:{port}/docs")
    uvicorn.run(app, host="127.0.0.1", port=port)
