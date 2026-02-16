FROM python:3.12-slim AS base
WORKDIR /worker

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY templates/ ./templates/

# Create temp directory
RUN mkdir -p /data/worker-tmp

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/worker

CMD ["python", "-m", "src.main"]
