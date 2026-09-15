FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock README.md ./

RUN uv sync \
    --frozen \
    --no-dev \
    --no-install-project

COPY src ./src

RUN uv sync \
    --frozen \
    --no-dev

USER appuser

EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "runner_api.main:app", "--host", "0.0.0.0", "--port", "8000"]