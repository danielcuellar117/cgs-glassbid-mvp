"""Integration tests for database claim logic (worker/src/db.py).

These tests require a real PostgreSQL instance.
Mark with `integration` marker -- skipped during unit test runs.
"""

import os
import uuid
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest

pytestmark = pytest.mark.integration


def _get_test_connection():
    """Get a psycopg2 connection to the test database."""
    import psycopg2
    import psycopg2.extras
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql://glassbid:glassbid_secret@localhost:5433/glassbid_test",
    )
    conn = psycopg2.connect(url)
    return conn


def _seed_job(conn, status="UPLOADED", locked_at=None, locked_by=None, next_run_at=None):
    """Insert a test job and return its ID."""
    job_id = str(uuid.uuid4())
    project_id = str(uuid.uuid4())

    with conn.cursor() as cur:
        # Ensure project exists
        cur.execute(
            "INSERT INTO projects (id, name, client_name, updated_at) VALUES (%s, %s, %s, NOW()) ON CONFLICT DO NOTHING",
            (project_id, "Test Project", "Test Client"),
        )
        cur.execute(
            """INSERT INTO jobs (id, project_id, status, ssot, locked_at, locked_by, next_run_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
            (job_id, project_id, status, json.dumps({}), locked_at, locked_by, next_run_at),
        )
    conn.commit()
    return job_id


def _cleanup_test_data(conn):
    """Clean up test data."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM render_requests")
        cur.execute("DELETE FROM measurement_tasks")
        cur.execute("DELETE FROM storage_objects")
        cur.execute("DELETE FROM audit_log")
        cur.execute("DELETE FROM jobs")
        cur.execute("DELETE FROM pricing_rules")
        cur.execute("DELETE FROM pricebook_versions")
        cur.execute("DELETE FROM projects")
        cur.execute("DELETE FROM worker_heartbeats")
    conn.commit()


class TestClaimMainJob:
    """Test claim_main_job with real PostgreSQL."""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """Set up and tear down test data."""
        try:
            self.conn = _get_test_connection()
            _cleanup_test_data(self.conn)
            yield
            _cleanup_test_data(self.conn)
            self.conn.close()
        except Exception:
            pytest.skip("Test PostgreSQL not available")

    def test_claims_oldest_eligible_job(self):
        from src.db import claim_main_job

        _seed_job(self.conn, status="UPLOADED")

        job = claim_main_job("test-worker")
        assert job is not None
        assert job["status"] == "UPLOADED"

    def test_no_jobs_returns_none(self):
        from src.db import claim_main_job

        job = claim_main_job("test-worker")
        assert job is None

    def test_skips_locked_jobs(self):
        from src.db import claim_main_job

        _seed_job(self.conn, status="UPLOADED", locked_at=datetime.now(timezone.utc), locked_by="other-worker")

        job = claim_main_job("test-worker")
        assert job is None

    def test_stale_lock_reclaimable(self):
        from src.db import claim_main_job

        stale_time = datetime.now(timezone.utc) - timedelta(minutes=15)
        _seed_job(self.conn, status="UPLOADED", locked_at=stale_time, locked_by="dead-worker")

        job = claim_main_job("test-worker")
        assert job is not None

    def test_respects_next_run_at(self):
        from src.db import claim_main_job

        future = datetime.now(timezone.utc) + timedelta(minutes=5)
        _seed_job(self.conn, status="UPLOADED", next_run_at=future)

        job = claim_main_job("test-worker")
        assert job is None


class TestClaimRenderRequest:
    """Test claim_render_request with real PostgreSQL."""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        try:
            self.conn = _get_test_connection()
            _cleanup_test_data(self.conn)
            yield
            _cleanup_test_data(self.conn)
            self.conn.close()
        except Exception:
            pytest.skip("Test PostgreSQL not available")

    def test_claims_pending_request(self):
        from src.db import claim_render_request

        job_id = _seed_job(self.conn, status="INDEXING")
        rr_id = str(uuid.uuid4())
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status) VALUES (%s, %s, %s, %s, %s, %s)",
                (rr_id, job_id, 5, "THUMB", 72, "PENDING"),
            )
        self.conn.commit()

        rr = claim_render_request("test-worker")
        assert rr is not None
        assert rr["page_num"] == 5

    def test_no_pending_returns_none(self):
        from src.db import claim_render_request

        rr = claim_render_request("test-worker")
        assert rr is None

    def test_measure_prioritized_over_thumb(self):
        from src.db import claim_render_request

        job_id = _seed_job(self.conn, status="INDEXING")
        thumb_id = str(uuid.uuid4())
        measure_id = str(uuid.uuid4())
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW() - INTERVAL '5 minutes')",
                (thumb_id, job_id, 1, "THUMB", 72, "PENDING"),
            )
            cur.execute(
                "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW())",
                (measure_id, job_id, 2, "MEASURE", 200, "PENDING"),
            )
        self.conn.commit()

        rr = claim_render_request("test-worker")
        assert rr is not None
        assert rr["id"] == measure_id
        assert rr["kind"] == "MEASURE"


class TestExpireStaleThumbRequests:
    """Test expire_stale_thumb_requests with real PostgreSQL."""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        try:
            self.conn = _get_test_connection()
            _cleanup_test_data(self.conn)
            yield
            _cleanup_test_data(self.conn)
            self.conn.close()
        except Exception:
            pytest.skip("Test PostgreSQL not available")

    def test_deletes_old_pending_thumbs(self):
        from src.db import expire_stale_thumb_requests

        job_id = _seed_job(self.conn, status="INDEXING")
        old_id = str(uuid.uuid4())
        fresh_id = str(uuid.uuid4())
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW() - INTERVAL '30 minutes')",
                (old_id, job_id, 1, "THUMB", 72, "PENDING"),
            )
            cur.execute(
                "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW())",
                (fresh_id, job_id, 2, "THUMB", 72, "PENDING"),
            )
        self.conn.commit()

        deleted = expire_stale_thumb_requests(max_age_minutes=15)
        assert deleted == 1

        with self.conn.cursor() as cur:
            cur.execute("SELECT id FROM render_requests WHERE status = 'PENDING'")
            remaining = [r[0] for r in cur.fetchall()]
        assert fresh_id in remaining
        assert old_id not in remaining

    def test_does_not_delete_measure_requests(self):
        from src.db import expire_stale_thumb_requests

        job_id = _seed_job(self.conn, status="INDEXING")
        measure_id = str(uuid.uuid4())
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW() - INTERVAL '30 minutes')",
                (measure_id, job_id, 1, "MEASURE", 200, "PENDING"),
            )
        self.conn.commit()

        deleted = expire_stale_thumb_requests(max_age_minutes=15)
        assert deleted == 0

    def test_does_not_delete_done_thumbs(self):
        from src.db import expire_stale_thumb_requests

        job_id = _seed_job(self.conn, status="INDEXING")
        done_id = str(uuid.uuid4())
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW() - INTERVAL '30 minutes')",
                (done_id, job_id, 1, "THUMB", 72, "DONE"),
            )
        self.conn.commit()

        deleted = expire_stale_thumb_requests(max_age_minutes=15)
        assert deleted == 0


class TestCapPendingThumbsPerJob:
    """Test cap_pending_thumbs_per_job with real PostgreSQL."""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        try:
            self.conn = _get_test_connection()
            _cleanup_test_data(self.conn)
            yield
            _cleanup_test_data(self.conn)
            self.conn.close()
        except Exception:
            pytest.skip("Test PostgreSQL not available")

    def test_caps_excess_pending_thumbs(self):
        from src.db import cap_pending_thumbs_per_job

        job_id = _seed_job(self.conn, status="INDEXING")
        ids = []
        with self.conn.cursor() as cur:
            for i in range(5):
                rr_id = str(uuid.uuid4())
                ids.append(rr_id)
                cur.execute(
                    "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW() + %s * INTERVAL '1 second')",
                    (rr_id, job_id, i + 1, "THUMB", 72, "PENDING", i),
                )
        self.conn.commit()

        deleted = cap_pending_thumbs_per_job(max_pending=3)
        assert deleted == 2

        with self.conn.cursor() as cur:
            cur.execute("SELECT id FROM render_requests WHERE status = 'PENDING' ORDER BY created_at DESC")
            remaining = [r[0] for r in cur.fetchall()]
        assert len(remaining) == 3
        # The 2 oldest should have been deleted
        assert ids[0] not in remaining
        assert ids[1] not in remaining

    def test_no_deletion_when_under_cap(self):
        from src.db import cap_pending_thumbs_per_job

        job_id = _seed_job(self.conn, status="INDEXING")
        with self.conn.cursor() as cur:
            for i in range(3):
                cur.execute(
                    "INSERT INTO render_requests (id, job_id, page_num, kind, dpi, status) VALUES (%s, %s, %s, %s, %s, %s)",
                    (str(uuid.uuid4()), job_id, i + 1, "THUMB", 72, "PENDING"),
                )
        self.conn.commit()

        deleted = cap_pending_thumbs_per_job(max_pending=20)
        assert deleted == 0
