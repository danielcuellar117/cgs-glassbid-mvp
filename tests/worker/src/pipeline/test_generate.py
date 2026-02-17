"""Tests for generation stage (worker/src/pipeline/generate.py)."""

import os
import json
import pytest
from unittest.mock import patch, MagicMock, mock_open

from src.pipeline.generate import run_generation, _compute_sha256


class TestComputeSha256:
    """Test the SHA256 hash computation helper."""

    def test_computes_hash(self, tmp_path):
        """Compute SHA256 of a known file."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("hello world")

        result = _compute_sha256(str(test_file))

        assert isinstance(result, str)
        assert len(result) == 64  # SHA256 hex digest is 64 chars
        # Known SHA256 of "hello world"
        assert result == "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"

    def test_empty_file(self, tmp_path):
        """Empty file has a valid hash."""
        test_file = tmp_path / "empty.txt"
        test_file.write_text("")

        result = _compute_sha256(str(test_file))

        assert isinstance(result, str)
        assert len(result) == 64


class TestRunGeneration:
    """Test the run_generation pipeline function."""

    @patch("src.pipeline.generate.upload_file")
    @patch("src.pipeline.generate.get_cursor")
    @patch("src.pipeline.generate.update_job_status")
    @patch("src.pipeline.generate.generate_bid_pdf")
    @patch("src.pipeline.generate.validate_ssot_for_generation")
    def test_validation_failure_blocks_generation(
        self, mock_validate, mock_gen_bid, mock_status, mock_cursor, mock_upload
    ):
        """If validation returns blocking errors, generation should FAIL."""
        error = MagicMock()
        error.code = "NO_ITEMS"
        error.to_dict.return_value = {"code": "NO_ITEMS", "message": "No items"}
        mock_validate.return_value = [error]

        job = {"id": "j1", "project_id": "p1", "ssot": {"items": [], "pricing": {"total": 0}}}

        run_generation(job)

        mock_gen_bid.assert_not_called()
        calls = mock_status.call_args_list
        failed_call = [c for c in calls if c[0][1] == "FAILED"]
        assert len(failed_call) == 1

    @patch("src.pipeline.generate.upload_file")
    @patch("src.pipeline.generate.get_cursor")
    @patch("src.pipeline.generate.update_job_status")
    @patch("src.pipeline.generate.generate_bid_pdf")
    @patch("src.pipeline.generate.validate_ssot_for_generation")
    def test_warnings_dont_block_generation(
        self, mock_validate, mock_gen_bid, mock_status, mock_cursor, mock_upload
    ):
        """Validation warnings (code contains WARNING) should not block."""
        warning = MagicMock()
        warning.code = "LOW_CONFIDENCE_WARNING"
        warning.to_dict.return_value = {"code": "LOW_CONFIDENCE_WARNING"}
        mock_validate.return_value = [warning]

        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "project_id": "p1",
            "ssot": {"items": [{"itemId": "i1"}], "pricing": {"total": 100}, "outputs": []},
        }

        with patch("src.pipeline.generate.os.makedirs"):
            with patch("src.pipeline.generate.os.path.getsize", return_value=5000):
                with patch("src.pipeline.generate._compute_sha256", return_value="a" * 64):
                    run_generation(job)

        mock_gen_bid.assert_called_once()

    @patch("src.pipeline.generate.upload_file")
    @patch("src.pipeline.generate.get_cursor")
    @patch("src.pipeline.generate.update_job_status")
    @patch("src.pipeline.generate.generate_bid_pdf")
    @patch("src.pipeline.generate.validate_ssot_for_generation")
    def test_successful_generation_transitions_to_done(
        self, mock_validate, mock_gen_bid, mock_status, mock_cursor, mock_upload
    ):
        """Successful generation should transition job to DONE."""
        mock_validate.return_value = []

        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "project_id": "p1",
            "ssot": {"items": [{"itemId": "i1"}], "pricing": {"total": 100}, "outputs": []},
        }

        with patch("src.pipeline.generate.os.makedirs"):
            with patch("src.pipeline.generate.os.path.getsize", return_value=5000):
                with patch("src.pipeline.generate._compute_sha256", return_value="a" * 64):
                    run_generation(job)

        calls = mock_status.call_args_list
        done_call = [c for c in calls if c[0][1] == "DONE"]
        assert len(done_call) == 1

    @patch("src.pipeline.generate.upload_file")
    @patch("src.pipeline.generate.get_cursor")
    @patch("src.pipeline.generate.update_job_status")
    @patch("src.pipeline.generate.generate_bid_pdf")
    @patch("src.pipeline.generate.validate_ssot_for_generation")
    def test_bid_pdf_output_in_ssot(
        self, mock_validate, mock_gen_bid, mock_status, mock_cursor, mock_upload
    ):
        """Generated BID_PDF should be recorded in SSOT outputs."""
        mock_validate.return_value = []

        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "project_id": "p1",
            "ssot": {"items": [{"itemId": "i1"}], "pricing": {"total": 100}, "outputs": []},
        }

        with patch("src.pipeline.generate.os.makedirs"):
            with patch("src.pipeline.generate.os.path.getsize", return_value=5000):
                with patch("src.pipeline.generate._compute_sha256", return_value="b" * 64):
                    run_generation(job)

        calls = mock_status.call_args_list
        done_call = [c for c in calls if c[0][1] == "DONE"][0]
        ssot = done_call[1]["ssot"]
        outputs = ssot.get("outputs", [])
        bid_outputs = [o for o in outputs if o.get("type") == "BID_PDF"]
        assert len(bid_outputs) == 1
        assert bid_outputs[0]["version"] == 1
        assert bid_outputs[0]["sha256"] == "b" * 64

    @patch("src.pipeline.generate.upload_file")
    @patch("src.pipeline.generate.get_cursor")
    @patch("src.pipeline.generate.update_job_status")
    @patch("src.pipeline.generate.generate_bid_pdf")
    @patch("src.pipeline.generate.validate_ssot_for_generation")
    def test_version_increments_on_existing_output(
        self, mock_validate, mock_gen_bid, mock_status, mock_cursor, mock_upload
    ):
        """Bid version should increment if previous BID_PDF exists."""
        mock_validate.return_value = []

        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "project_id": "p1",
            "ssot": {
                "items": [{"itemId": "i1"}],
                "pricing": {"total": 100},
                "outputs": [{"type": "BID_PDF", "version": 1, "key": "old"}],
            },
        }

        with patch("src.pipeline.generate.os.makedirs"):
            with patch("src.pipeline.generate.os.path.getsize", return_value=5000):
                with patch("src.pipeline.generate._compute_sha256", return_value="c" * 64):
                    run_generation(job)

        calls = mock_status.call_args_list
        done_call = [c for c in calls if c[0][1] == "DONE"][0]
        outputs = done_call[1]["ssot"]["outputs"]
        bid_outputs = [o for o in outputs if o.get("type") == "BID_PDF"]
        assert bid_outputs[0]["version"] == 2

    @patch("src.pipeline.generate.upload_file")
    @patch("src.pipeline.generate.get_cursor")
    @patch("src.pipeline.generate.update_job_status")
    @patch("src.pipeline.generate.generate_bid_pdf")
    @patch("src.pipeline.generate.validate_ssot_for_generation")
    def test_ssot_string_parsed(
        self, mock_validate, mock_gen_bid, mock_status, mock_cursor, mock_upload
    ):
        """SSOT provided as JSON string should be parsed."""
        mock_validate.return_value = []

        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        ssot = {"items": [{"itemId": "i1"}], "pricing": {"total": 100}, "outputs": []}
        job = {"id": "j1", "project_id": "p1", "ssot": json.dumps(ssot)}

        with patch("src.pipeline.generate.os.makedirs"):
            with patch("src.pipeline.generate.os.path.getsize", return_value=5000):
                with patch("src.pipeline.generate._compute_sha256", return_value="d" * 64):
                    run_generation(job)

        mock_gen_bid.assert_called_once()

    @patch("src.pipeline.generate.upload_file")
    @patch("src.pipeline.generate.get_cursor")
    @patch("src.pipeline.generate.update_job_status")
    @patch("src.pipeline.generate.generate_bid_pdf")
    @patch("src.pipeline.generate.validate_ssot_for_generation")
    def test_bid_pdf_failure_raises(
        self, mock_validate, mock_gen_bid, mock_status, mock_cursor, mock_upload
    ):
        """If bid PDF generation fails, the error should propagate."""
        mock_validate.return_value = []
        mock_gen_bid.side_effect = RuntimeError("ReportLab error")

        job = {
            "id": "j1",
            "project_id": "p1",
            "ssot": {"items": [{"itemId": "i1"}], "pricing": {"total": 100}, "outputs": []},
        }

        with patch("src.pipeline.generate.os.makedirs"):
            with pytest.raises(RuntimeError, match="ReportLab error"):
                run_generation(job)
