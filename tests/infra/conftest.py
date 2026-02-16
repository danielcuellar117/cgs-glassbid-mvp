"""Infra test conftest -- shared fixtures."""

import json
import os
import sys

WORKER_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "worker")
if WORKER_DIR not in sys.path:
    sys.path.insert(0, WORKER_DIR)

os.environ.setdefault("TEMP_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "tmp-test"))
os.environ.setdefault("DISK_PRESSURE_THRESHOLD_PCT", "80")
os.environ.setdefault("DATABASE_URL", "postgresql://glassbid:glassbid_secret@localhost:5433/glassbid_test")
os.environ.setdefault("MINIO_ENDPOINT", "localhost")
os.environ.setdefault("MINIO_PORT", "9010")
os.environ.setdefault("MINIO_ACCESS_KEY", "testadmin")
os.environ.setdefault("MINIO_SECRET_KEY", "testadmin_secret")
os.environ.setdefault("MINIO_USE_SSL", "false")

import pytest

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")
GOLDEN_SSOT_PATH = os.path.join(FIXTURES_DIR, "golden-ssot.json")


@pytest.fixture(autouse=True)
def _pin_utc(monkeypatch):
    monkeypatch.setenv("TZ", "UTC")


@pytest.fixture
def golden_ssot() -> dict:
    with open(GOLDEN_SSOT_PATH) as f:
        return json.load(f)


@pytest.fixture
def tmp_output_dir(tmp_path):
    out = tmp_path / "output"
    out.mkdir()
    return str(out)
