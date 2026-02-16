"""Tests for disk pressure guard (worker/src/disk.py)."""

import os
import shutil
from unittest.mock import patch, MagicMock

import pytest
from src.disk import get_disk_usage_pct, is_disk_pressure, cleanup_orphan_temp_dirs, cleanup_job_temp


class TestGetDiskUsagePct:
    """Test disk usage reading."""

    @patch("src.disk.shutil.disk_usage")
    def test_normal_reading(self, mock_usage):
        mock_usage.return_value = MagicMock(total=100_000_000, used=50_000_000)
        pct = get_disk_usage_pct()
        assert pct == 50.0

    @patch("src.disk.shutil.disk_usage")
    def test_exception_returns_zero(self, mock_usage):
        mock_usage.side_effect = OSError("no such volume")
        pct = get_disk_usage_pct()
        assert pct == 0.0


class TestIsDiskPressure:
    """Test disk pressure threshold logic."""

    @patch("src.disk.get_disk_usage_pct")
    def test_below_threshold(self, mock_pct):
        mock_pct.return_value = 70.0
        assert is_disk_pressure() is False

    @patch("src.disk.get_disk_usage_pct")
    def test_at_threshold(self, mock_pct):
        mock_pct.return_value = 80.0
        assert is_disk_pressure() is True

    @patch("src.disk.get_disk_usage_pct")
    def test_above_threshold(self, mock_pct):
        mock_pct.return_value = 95.0
        assert is_disk_pressure() is True


class TestCleanupOrphanTempDirs:
    """Test orphan temp directory cleanup."""

    def test_orphan_cleaned_locked_preserved(self, tmp_path, monkeypatch):
        monkeypatch.setattr("src.disk.config.TEMP_DIR", str(tmp_path))

        # Create temp dirs for two "jobs"
        orphan_dir = tmp_path / "orphan-job-123"
        orphan_dir.mkdir()
        (orphan_dir / "source.pdf").touch()

        locked_dir = tmp_path / "locked-job-456"
        locked_dir.mkdir()
        (locked_dir / "source.pdf").touch()

        cleanup_orphan_temp_dirs({"locked-job-456"})

        assert not orphan_dir.exists()
        assert locked_dir.exists()

    def test_missing_temp_dir_created(self, tmp_path, monkeypatch):
        new_dir = tmp_path / "nonexistent"
        monkeypatch.setattr("src.disk.config.TEMP_DIR", str(new_dir))
        cleanup_orphan_temp_dirs(set())
        assert new_dir.exists()


class TestCleanupJobTemp:
    """Test single job temp cleanup."""

    def test_existing_dir_removed(self, tmp_path, monkeypatch):
        monkeypatch.setattr("src.disk.config.TEMP_DIR", str(tmp_path))
        job_dir = tmp_path / "job-789"
        job_dir.mkdir()
        (job_dir / "file.txt").touch()

        cleanup_job_temp("job-789")
        assert not job_dir.exists()

    def test_nonexistent_dir_no_error(self, tmp_path, monkeypatch):
        monkeypatch.setattr("src.disk.config.TEMP_DIR", str(tmp_path))
        cleanup_job_temp("nonexistent-job")
