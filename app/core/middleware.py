import json
from urllib.parse import quote

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse

DEFAULT_REASON = "Please sign in again."


class AuthRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        if response.status_code in (401, 403) and self._is_navigation(request):
            reason = await self._extract_detail(response)
            return RedirectResponse(
                url=f"/login?error={quote(reason)}", status_code=302
            )

        return response

    @staticmethod
    def _is_navigation(request):
        # Real page loads/form GETs send Accept: text/html...
        # fetch() calls default to Accept: */* unless you set it yourself.
        return "text/html" in request.headers.get("accept", "")

    @staticmethod
    async def _extract_detail(response) -> str:
        # call_next's response is a streaming wrapper -- there is no
        # ready-made `.body`, so the only way to read it is to drain
        # body_iterator. This is safe here because we always replace the
        # response with a RedirectResponse right after (401/403 branch
        # only) -- we never need to forward the original body onward.
        body = b""
        async for chunk in response.body_iterator:
            body += chunk if isinstance(chunk, bytes) else chunk.encode()

        try:
            payload = json.loads(body)
            detail = payload.get("detail")
            if detail:
                return detail
        except Exception:
            pass

        return DEFAULT_REASON
