"""Start exactly one ASGI process per allocated GPU."""
import asyncio
import hmac
import json
import os
import time
from collections import deque
from contextlib import asynccontextmanager
from uuid import UUID

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

from model import LengthLimit, MODELS, Translator


def error(code, status):
    return JSONResponse({"error": {"code": code}}, status_code=status)


def create_app(load=Translator, *, secret=None, deadline=15, rate=60):
    token = secret if secret is not None else os.environ.get("SAHVA_MT_TOKEN", "")
    if len(token) < 32 or not token.isascii():
        raise RuntimeError("Configure a private ASCII bearer token of at least 32 characters")
    accepted = deque()
    active = None
    engine = None

    @asynccontextmanager
    async def lifespan(_):
        nonlocal engine
        engine = await asyncio.to_thread(load)
        yield
        engine = None

    async def handle(request):
        nonlocal active
        if not hmac.compare_digest(request.headers.get("authorization", "").encode(), ("Bearer " + token).encode()):
            return error("UNAUTHORIZED", 401)
        path = request.url.path
        if path == "/live":
            return JSONResponse({"live": True})
        if engine is None:
            return error("NOT_READY", 503)
        if path == "/ready":
            return JSONResponse({"ready": True})
        if path == "/v1/capabilities":
            return JSONResponse({"stage": "mt", "streaming": False, "ready": True, "directions": [
                dict(sourceLanguage=source, targetLanguage=target, model=name, revision=revision)
                for source, (name, revision) in MODELS.items() for target in MODELS if target != source
            ]})
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            return error("CONTENT_TYPE", 415)
        body = bytearray()
        try:
            async with asyncio.timeout(3):
                async for chunk in request.stream():
                    if len(body) + len(chunk) > 8192:
                        return error("BODY_LENGTH", 413)
                    body.extend(chunk)
            data = json.loads(body)
            request_id, source, target, text = (data[k] for k in ("requestId", "sourceLanguage", "targetLanguage", "text"))
            UUID(request_id)
            if source not in MODELS or target not in MODELS or source == target:
                return error("UNSUPPORTED_DIRECTION", 422)
            if not isinstance(text, str) or not text.strip() or len(text) > 1000:
                return error("TEXT_LENGTH", 422)
        except TimeoutError:
            return error("READ_TIMEOUT", 408)
        except (KeyError, TypeError, AttributeError, ValueError, RecursionError):
            return error("INVALID_REQUEST", 400)

        if active is not None and not active.done():
            return error("BUSY", 429)
        now = time.monotonic()
        while accepted and now - accepted[0] >= 60:
            accepted.popleft()
        if len(accepted) >= rate:
            return error("RATE_LIMIT", 429)
        accepted.append(now)
        job = active = asyncio.create_task(asyncio.to_thread(engine.translate, source, target, text))
        # A client timeout cannot cancel a CUDA kernel. Keep the slot until completion.
        # A stuck kernel triggers the container restart policy, including fresh warmup.
        watchdog = asyncio.get_running_loop().call_later(deadline + 30, os._exit, 70)
        def settled(task):
            watchdog.cancel()
            if not task.cancelled():
                task.exception()
        job.add_done_callback(settled)
        try:
            result = await asyncio.wait_for(asyncio.shield(job), timeout=deadline)
        except TimeoutError:
            return error("INFERENCE_TIMEOUT", 504)
        except LengthLimit:
            return error("TOKEN_LIMIT", 422)
        except Exception:
            return error("INFERENCE_FAILED", 503)
        return JSONResponse(dict(requestId=request_id, sourceLanguage=source, targetLanguage=target, **result))

    return Starlette(lifespan=lifespan, routes=[
        Route(path, handle, methods=["POST" if path.endswith("/translate") else "GET"])
        for path in ("/live", "/ready", "/v1/capabilities", "/v1/mt/translate")
    ])
