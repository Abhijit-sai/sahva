FROM ghcr.io/astral-sh/uv:0.9.26@sha256:9a23023be68b2ed09750ae636228e903a54a05ea56ed03a934d00fe9fbeded4b AS resolver
FROM python:3.11.14-slim-bookworm@sha256:83f339c1be6340ae1096010fdccf6552ac932d8f410d45d206014916bdf37e48
WORKDIR /srv
COPY requirements.lock /tmp/requirements.lock
RUN --mount=from=resolver,source=/uv,target=/bin/uv --mount=type=cache,target=/root/.cache/uv \
    UV_CONCURRENT_DOWNLOADS=2 UV_CONCURRENT_INSTALLS=1 UV_LINK_MODE=copy uv pip install --system --require-hashes -r /tmp/requirements.lock
RUN python -c "from IndicTransToolkit.processor import IndicProcessor; import torch, transformers; IndicProcessor(inference=True)"
COPY model.py worker.py ./
ENV HF_HOME=/models HF_HUB_OFFLINE=1 HF_MODULES_CACHE=/tmp/hf-modules PYTHONDONTWRITEBYTECODE=1 TOKENIZERS_PARALLELISM=false
USER 65532:65532
CMD ["python","-m","uvicorn","worker:create_app","--factory","--host","0.0.0.0","--port","8080","--workers","1","--no-access-log","--limit-concurrency","16","--timeout-keep-alive","3"]
