"""Tests for routing stage (worker/src/pipeline/route.py)."""

import pytest
from unittest.mock import patch, MagicMock

from src.pipeline.route import run_routing, RELEVANT_CLASSIFICATIONS


class TestRelevantClassifications:
    """Verify the set of relevant classifications."""

    def test_expected_classifications(self):
        assert "SCHEDULE" in RELEVANT_CLASSIFICATIONS
        assert "DETAIL" in RELEVANT_CLASSIFICATIONS
        assert "NOTES" in RELEVANT_CLASSIFICATIONS
        assert "ELEVATION" in RELEVANT_CLASSIFICATIONS

    def test_irrelevant_not_included(self):
        assert "COVER_SHEET" not in RELEVANT_CLASSIFICATIONS
        assert "FLOOR_PLAN" not in RELEVANT_CLASSIFICATIONS


class TestRunRouting:
    """Test the run_routing pipeline function."""

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_empty_page_index(self, mock_status, mock_cursor):
        """With no pages, routing completes with 0 relevant pages."""
        job = {"id": "j1", "ssot": {"pageIndex": []}}

        run_routing(job)

        mock_status.assert_any_call("j1", "ROUTING", clear_lock=False)
        # Second call should be ROUTED with 0 relevant pages
        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"]
        assert len(routed_call) == 1
        assert routed_call[0][1]["stage_progress"]["relevant_pages"] == 0

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_no_page_index_key(self, mock_status, mock_cursor):
        """When ssot has no pageIndex key, should route with 0 pages."""
        job = {"id": "j1", "ssot": {}}

        run_routing(job)

        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"]
        assert len(routed_call) == 1

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_schedule_page_is_relevant(self, mock_status, mock_cursor):
        """A SCHEDULE-classified page should be marked as relevant."""
        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "ssot": {
                "pageIndex": [
                    {"pageNum": 0, "classification": "SCHEDULE", "relevantTo": []},
                ],
            },
        }

        run_routing(job)

        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"][0]
        ssot = routed_call[1]["ssot"]
        assert ssot["routing"]["relevantPages"] == [0]
        assert ssot["routing"]["totalPages"] == 1

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_detail_page_is_relevant(self, mock_status, mock_cursor):
        """A DETAIL-classified page should be marked as relevant."""
        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "ssot": {
                "pageIndex": [
                    {"pageNum": 0, "classification": "DETAIL", "relevantTo": []},
                ],
            },
        }

        run_routing(job)

        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"][0]
        assert 0 in routed_call[1]["ssot"]["routing"]["relevantPages"]

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_irrelevant_page_excluded(self, mock_status, mock_cursor):
        """A COVER_SHEET page with no keywords should not be relevant."""
        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "ssot": {
                "pageIndex": [
                    {"pageNum": 0, "classification": "COVER_SHEET", "relevantTo": []},
                ],
            },
        }

        run_routing(job)

        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"][0]
        assert routed_call[1]["ssot"]["routing"]["relevantPages"] == []

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_floor_plan_with_keywords_is_relevant(self, mock_status, mock_cursor):
        """A FLOOR_PLAN with relevantTo keywords should be marked relevant."""
        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "ssot": {
                "pageIndex": [
                    {"pageNum": 0, "classification": "FLOOR_PLAN", "relevantTo": ["shower"]},
                ],
            },
        }

        run_routing(job)

        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"][0]
        assert 0 in routed_call[1]["ssot"]["routing"]["relevantPages"]

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_floor_plan_without_keywords_not_relevant(self, mock_status, mock_cursor):
        """A FLOOR_PLAN with no keywords should not be relevant."""
        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "ssot": {
                "pageIndex": [
                    {"pageNum": 0, "classification": "FLOOR_PLAN", "relevantTo": []},
                ],
            },
        }

        run_routing(job)

        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"][0]
        assert routed_call[1]["ssot"]["routing"]["relevantPages"] == []

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_mixed_pages_routing(self, mock_status, mock_cursor):
        """Multi-page routing: only relevant pages included."""
        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "ssot": {
                "pageIndex": [
                    {"pageNum": 0, "classification": "COVER_SHEET", "relevantTo": []},
                    {"pageNum": 1, "classification": "SCHEDULE", "relevantTo": []},
                    {"pageNum": 2, "classification": "NOTES", "relevantTo": []},
                    {"pageNum": 3, "classification": "MECHANICAL", "relevantTo": []},
                    {"pageNum": 4, "classification": "DETAIL", "relevantTo": []},
                ],
            },
        }

        run_routing(job)

        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"][0]
        relevant = routed_call[1]["ssot"]["routing"]["relevantPages"]
        assert 1 in relevant  # SCHEDULE
        assert 2 in relevant  # NOTES
        assert 4 in relevant  # DETAIL
        assert 0 not in relevant  # COVER_SHEET
        assert 3 not in relevant  # MECHANICAL

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_ssot_string_parsed(self, mock_status, mock_cursor):
        """SSOT provided as JSON string should be parsed correctly."""
        import json

        mock_cm = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cm, mock_cm))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        ssot = {"pageIndex": [{"pageNum": 0, "classification": "SCHEDULE", "relevantTo": []}]}
        job = {"id": "j1", "ssot": json.dumps(ssot)}

        run_routing(job)

        calls = mock_status.call_args_list
        routed_call = [c for c in calls if c[0][1] == "ROUTED"][0]
        assert 0 in routed_call[1]["ssot"]["routing"]["relevantPages"]

    @patch("src.pipeline.route.get_cursor")
    @patch("src.pipeline.route.update_job_status")
    def test_render_requests_created(self, mock_status, mock_cursor):
        """Render requests should be created for relevant pages."""
        mock_cur = MagicMock()
        mock_conn = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=(mock_cur, mock_conn))
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        job = {
            "id": "j1",
            "ssot": {
                "pageIndex": [
                    {"pageNum": 0, "classification": "SCHEDULE", "relevantTo": []},
                    {"pageNum": 1, "classification": "DETAIL", "relevantTo": []},
                ],
            },
        }

        run_routing(job)

        # Two render requests created (one per relevant page)
        assert mock_cur.execute.call_count == 2
        mock_conn.commit.assert_called_once()
