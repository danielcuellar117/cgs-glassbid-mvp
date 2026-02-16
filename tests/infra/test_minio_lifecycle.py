"""Infra tests for MinIO lifecycle / cleanup logic."""

from unittest.mock import patch, MagicMock, call

import pytest


class TestCleanupExpiredStorageObjects:
    """Test cleanup_expired_storage_objects removes expected keys."""

    @patch("src.cleanup.get_client")
    @patch("src.cleanup.get_cursor")
    def test_deletes_expired_objects(self, mock_cursor_ctx, mock_get_client):
        from src.cleanup import cleanup_expired_storage_objects

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_cur = MagicMock()
        mock_conn = MagicMock()
        mock_cursor_ctx.return_value.__enter__ = MagicMock(return_value=(mock_cur, mock_conn))
        mock_cursor_ctx.return_value.__exit__ = MagicMock(return_value=False)

        expired_objects = [
            {"id": "so-1", "bucket": "raw-uploads", "key": "proj/job/source.pdf", "job_id": "j1"},
            {"id": "so-2", "bucket": "page-cache", "key": "j1/page-5.png", "job_id": "j1"},
        ]
        mock_cur.fetchall.return_value = expired_objects

        count = cleanup_expired_storage_objects()

        assert count == 2
        assert mock_client.remove_object.call_count == 2
        mock_client.remove_object.assert_any_call("raw-uploads", "proj/job/source.pdf")
        mock_client.remove_object.assert_any_call("page-cache", "j1/page-5.png")
        mock_conn.commit.assert_called_once()

    @patch("src.cleanup.get_client")
    @patch("src.cleanup.get_cursor")
    def test_handles_minio_remove_error_gracefully(self, mock_cursor_ctx, mock_get_client):
        from src.cleanup import cleanup_expired_storage_objects

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_client.remove_object.side_effect = Exception("S3 error")

        mock_cur = MagicMock()
        mock_conn = MagicMock()
        mock_cursor_ctx.return_value.__enter__ = MagicMock(return_value=(mock_cur, mock_conn))
        mock_cursor_ctx.return_value.__exit__ = MagicMock(return_value=False)

        mock_cur.fetchall.return_value = [
            {"id": "so-1", "bucket": "outputs", "key": "bid.pdf", "job_id": "j1"},
        ]

        count = cleanup_expired_storage_objects()
        # Still counts as cleaned (DB delete still runs)
        assert count == 1

    @patch("src.cleanup.get_client")
    @patch("src.cleanup.get_cursor")
    def test_no_expired_objects(self, mock_cursor_ctx, mock_get_client):
        from src.cleanup import cleanup_expired_storage_objects

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_cur = MagicMock()
        mock_conn = MagicMock()
        mock_cursor_ctx.return_value.__enter__ = MagicMock(return_value=(mock_cur, mock_conn))
        mock_cursor_ctx.return_value.__exit__ = MagicMock(return_value=False)

        mock_cur.fetchall.return_value = []

        count = cleanup_expired_storage_objects()
        assert count == 0
        mock_client.remove_object.assert_not_called()


class TestEmergencyPageCacheCleanup:
    """Test emergency page-cache cleanup."""

    @patch("src.cleanup.get_client")
    @patch("src.cleanup.get_cursor")
    def test_removes_oldest_page_cache_objects(self, mock_cursor_ctx, mock_get_client):
        from src.cleanup import emergency_page_cache_cleanup

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_cur = MagicMock()
        mock_conn = MagicMock()
        mock_cursor_ctx.return_value.__enter__ = MagicMock(return_value=(mock_cur, mock_conn))
        mock_cursor_ctx.return_value.__exit__ = MagicMock(return_value=False)

        mock_cur.fetchall.return_value = [
            {"id": "so-1", "bucket": "page-cache", "key": "old-thumb.png"},
        ]

        count = emergency_page_cache_cleanup()
        assert count == 1
        mock_client.remove_object.assert_called_once_with("page-cache", "old-thumb.png")
