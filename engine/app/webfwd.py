import httpx

from . import config

_TIMEOUT = httpx.Timeout(45.0, connect=12.0)


class WebForwarder:
    def __init__(self) -> None:
        self._client: httpx.Client | None = None

    def _c(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(timeout=_TIMEOUT, headers={"User-Agent": "ambl-engine/1.0"})
        return self._client

    def call(
        self,
        method: str,
        path: str,
        bearer: str | None = None,
        body: dict | None = None,
        params: dict | None = None,
    ) -> tuple[int, dict | None]:
        headers = {"Content-Type": "application/json"}
        if bearer:
            headers["Authorization"] = "Bearer " + bearer
        try:
            resp = self._c().request(
                method,
                config.SITE_URL + path,
                headers=headers,
                json=body,
                params=params,
            )
            data = None
            if resp.content:
                try:
                    data = resp.json()
                except Exception:
                    try:
                        data = {"text": resp.text}
                    except Exception:
                        pass
            return resp.status_code, data
        except httpx.HTTPError as exc:
            return 502, {"error": f"engine cannot reach site: {exc}"}
        except Exception as exc:
            return 500, {"error": str(exc)}

    def check_key(self, bearer: str | None) -> bool:
        if not bearer:
            return False
        status, _ = self.call("GET", "/api/extension/library", bearer=bearer)
        return status == 200


forwarder = WebForwarder()


def get_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        return None
    value = authorization[len("bearer ") :].strip()
    return value or None