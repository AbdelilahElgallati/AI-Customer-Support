"""Retry individual model requests, without rerunning a pipeline or its tools."""

import asyncio
import logging
import random
import re
import time

from pydantic_ai.exceptions import (
    ModelAPIError,
    ModelConnectionError,
    ModelQuotaExceededError,
    ModelRateLimitError,
    ModelServerError,
    ModelUnavailableError,
)
from pydantic_ai.messages import ModelMessage, ModelResponse
from pydantic_ai.models import Model, ModelRequestParameters
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.settings import ModelSettings

logger = logging.getLogger(__name__)


def exception_chain(error: BaseException) -> str:
    """Keep the transport cause visible instead of just 'Connection error'."""
    parts = []
    seen = set()
    while error is not None and id(error) not in seen:
        seen.add(id(error))
        status = getattr(error, "status_code", None)
        if status is None:
            status = getattr(getattr(error, "response", None), "status_code", None)
        detail = f"HTTP {status}" if status is not None else str(error)
        if status == 429 and isinstance(error, ModelAPIError):
            body = error.body
            if isinstance(body, dict):
                body = body.get("error", body)
                if isinstance(body, dict):
                    body = body.get("message", "")
            if body:
                detail += ": " + str(body).replace("\n", " ")[:1000]
        parts.append(f"{type(error).__name__}: {detail}")
        error = error.__cause__ or error.__context__
    return " -> ".join(parts)


def retry_delay(error: ModelAPIError, attempt: int) -> float | None:
    """None means waiting cannot fix this request (for example 401 or 413)."""
    if isinstance(error, ModelQuotaExceededError):
        return None
    status = getattr(error, "status_code", None)
    if status is not None and status not in {408, 429, 500, 502, 503, 504}:
        return None
    if not isinstance(error, (ModelConnectionError, ModelRateLimitError,
                              ModelServerError, ModelUnavailableError)) and status is None:
        return None
    if error.retry_after is not None:
        return max(0.0, error.retry_after)
    # Groq sometimes puts the reset time in the response body instead of a header.
    if status == 429 or isinstance(error, ModelRateLimitError):
        match = re.search(r"try again in\s+((?:\d+(?:\.\d+)?(?:ms|s|m|h))+)",
                          str(error.body), re.IGNORECASE)
        if match:
            units = {"ms": 0.001, "s": 1, "m": 60, "h": 3600}
            return sum(float(value) * units[unit.lower()]
                       for value, unit in re.findall(r"([\d.]+)(ms|s|m|h)", match.group(1), re.IGNORECASE))
    return min(2 ** (attempt - 1), 16)


class RetryingModel(WrapperModel):
    """One bounded retry owner for the non-streaming requests used by this app."""

    def __init__(self, wrapped: Model | str, *, max_attempts: int = 5,
                 retry_budget: float = 120, max_wait: float = 60,
                 min_interval: float = 0):
        super().__init__(wrapped)
        if min_interval < 0:
            raise ValueError("min_interval must be non-negative")
        self.max_attempts = max_attempts
        self.retry_budget = retry_budget
        self.max_wait = max_wait
        self.min_interval = min_interval
        self._next_request_at = 0.0

    async def _pace(self) -> None:
        # Reserve before awaiting so concurrent callers also receive distinct slots.
        now = time.monotonic()
        slot = max(now, self._next_request_at)
        self._next_request_at = slot + self.min_interval
        if slot > now:
            await asyncio.sleep(slot - now)

    async def request(self, messages: list[ModelMessage], model_settings: ModelSettings | None,
                      model_request_parameters: ModelRequestParameters) -> ModelResponse:
        # Disable SDK retries so five attempts do not become five times three.
        request_settings = {"timeout": 30.0, **(model_settings or {}), "max_retries": 0}
        await self._pace()
        started = time.monotonic()
        for attempt in range(1, self.max_attempts + 1):
            try:
                response = await self.wrapped.request(messages, request_settings, model_request_parameters)
                self._next_request_at = max(self._next_request_at,
                                            time.monotonic() + self.min_interval)
                return response
            except ModelAPIError as error:
                delay = retry_delay(error, attempt)
                if delay is not None:
                    delay += random.uniform(0.1, 0.4)
                if (delay is None or attempt == self.max_attempts or delay > self.max_wait
                        or time.monotonic() - started + delay > self.retry_budget):
                    logger.error("Model request stopped: model=%s attempt=%s messages=%s cause=%s",
                                 self.model_name, attempt, len(messages), exception_chain(error))
                    raise
                logger.warning("Retrying model=%s attempt=%s/%s in=%.2fs messages=%s cause=%s",
                               self.model_name, attempt, self.max_attempts, delay,
                               len(messages), exception_chain(error))
                await asyncio.sleep(delay)
        raise AssertionError("Unreachable")
