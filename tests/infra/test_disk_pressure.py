"""Infra tests for disk pressure guard behavior."""

from unittest.mock import patch, MagicMock

import pytest
from src.disk import get_disk_usage_pct, is_disk_pressure


class TestDiskPressureThresholds:
    """Test disk pressure guard at various thresholds."""

    @patch("src.disk.shutil.disk_usage")
    def test_70_percent_no_pressure(self, mock_usage):
        mock_usage.return_value = MagicMock(total=1000, used=700)
        assert is_disk_pressure() is False

    @patch("src.disk.shutil.disk_usage")
    def test_79_percent_no_pressure(self, mock_usage):
        mock_usage.return_value = MagicMock(total=1000, used=790)
        assert is_disk_pressure() is False

    @patch("src.disk.shutil.disk_usage")
    def test_80_percent_triggers_pressure(self, mock_usage):
        mock_usage.return_value = MagicMock(total=1000, used=800)
        assert is_disk_pressure() is True

    @patch("src.disk.shutil.disk_usage")
    def test_95_percent_triggers_pressure(self, mock_usage):
        mock_usage.return_value = MagicMock(total=1000, used=950)
        assert is_disk_pressure() is True

    @patch("src.disk.shutil.disk_usage")
    def test_100_percent(self, mock_usage):
        mock_usage.return_value = MagicMock(total=1000, used=1000)
        assert is_disk_pressure() is True

    @patch("src.disk.shutil.disk_usage")
    def test_error_returns_no_pressure(self, mock_usage):
        mock_usage.side_effect = OSError("volume not found")
        # get_disk_usage_pct returns 0.0 on error, which is < 80
        assert is_disk_pressure() is False


class TestDiskUsageCustomThreshold:
    """Test with custom threshold via monkeypatch."""

    @patch("src.disk.shutil.disk_usage")
    def test_custom_threshold_50(self, mock_usage, monkeypatch):
        monkeypatch.setattr("src.disk.config.DISK_PRESSURE_THRESHOLD_PCT", 50)
        mock_usage.return_value = MagicMock(total=1000, used=500)
        assert is_disk_pressure() is True

    @patch("src.disk.shutil.disk_usage")
    def test_custom_threshold_90(self, mock_usage, monkeypatch):
        monkeypatch.setattr("src.disk.config.DISK_PRESSURE_THRESHOLD_PCT", 90)
        mock_usage.return_value = MagicMock(total=1000, used=850)
        assert is_disk_pressure() is False
