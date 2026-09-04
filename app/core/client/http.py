from typing import Any

import httpx


class HttpClient:
    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 10.0,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
        )

    async def get(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        return await self._client.get(
            url,
            params=params,
            headers=headers,
        )

    async def post(
        self,
        url: str,
        *,
        json: Any = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        return await self._client.post(
            url,
            json=json,
            params=params,
            headers=headers,
        )

    async def put(
        self,
        url: str,
        *,
        json: Any = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        return await self._client.put(
            url,
            json=json,
            headers=headers,
        )

    async def delete(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        return await self._client.delete(
            url,
            headers=headers,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "HttpClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
