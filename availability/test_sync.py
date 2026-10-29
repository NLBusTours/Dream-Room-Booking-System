"""No external BAND credentials are needed for these parser tests."""
import json
import unittest
from datetime import datetime, timezone

from sync import make_snapshot, normalize_private_url
from publish_issue import make_body

NOW = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)
HEAD = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//DreamRoom Tests//EN\r\n"
TAIL = "END:VCALENDAR\r\n"


def calendar(*events):
    return (HEAD + "".join(events) + TAIL).encode()


def event(uid, start, end, extra=""):
    return (
        "BEGIN:VEVENT\r\n"
        f"UID:{uid}\r\n"
        f"DTSTART;TZID=America/St_Johns:{start}\r\n"
        f"DTEND;TZID=America/St_Johns:{end}\r\n"
        "SUMMARY:Private booking for Customer Name\r\n"
        "DESCRIPTION:private@example.com\r\n"
        f"{extra}"
        "END:VEVENT\r\n"
    )


class AvailabilityTests(unittest.TestCase):
    def test_webcal_normalization(self):
        self.assertEqual(
            normalize_private_url("webcal://api.band.us/ical?token=sample"),
            "https://api.band.us/ical?token=sample",
        )
        with self.assertRaises(ValueError):
            normalize_private_url("https://other.example/calendar?token=sample")

    def test_overlaps_and_privacy(self):
        sample = calendar(
            event("one", "20261107T100000", "20261107T130000"),
            event("two", "20261107T113000", "20261107T140000"),
        )
        result = make_snapshot(sample, NOW)
        self.assertEqual(result["busy"]["2026-11-07"], [[600, 840]])
        serialized = json.dumps(result)
        self.assertNotIn("Customer Name", serialized)
        self.assertNotIn("private@example.com", serialized)
        self.assertNotIn("UID:one", serialized)

    def test_all_day_and_transparent(self):
        sample = calendar(
            "BEGIN:VEVENT\r\nUID:day\r\nDTSTART;VALUE=DATE:20261121\r\n"
            "DTEND;VALUE=DATE:20261122\r\nSUMMARY:PRIVATE EVENT\r\nEND:VEVENT\r\n",
            event("free", "20261122T100000", "20261122T140000", "TRANSP:TRANSPARENT\r\n"),
            event("cancelled", "20261123T100000", "20261123T140000", "STATUS:CANCELLED\r\n"),
        )
        result = make_snapshot(sample, NOW)
        self.assertEqual(result["busy"]["2026-11-21"], [[0, 1440]])
        self.assertNotIn("2026-11-22", result["busy"])
        self.assertNotIn("2026-11-23", result["busy"])

    def test_recurring_event(self):
        recurring = event("weekly", "20261103T100000", "20261103T110000",
                          "RRULE:FREQ=WEEKLY;COUNT=3\r\n")
        result = make_snapshot(calendar(recurring), NOW)
        self.assertEqual(result["busy"]["2026-11-03"], [[600, 660]])
        self.assertEqual(result["busy"]["2026-11-10"], [[600, 660]])
        self.assertEqual(result["busy"]["2026-11-17"], [[600, 660]])

    def test_across_midnight(self):
        result = make_snapshot(calendar(event("late", "20261107T230000", "20261108T010000")), NOW)
        self.assertEqual(result["busy"]["2026-11-07"], [[1380, 1440]])
        self.assertEqual(result["busy"]["2026-11-08"], [[0, 60]])

    def test_anonymous_issue_body(self):
        sample = calendar(event("private-booking", "20261107T100000", "20261107T130000"))
        snapshot = make_snapshot(sample, NOW)
        body = make_body(snapshot)
        self.assertIn("DREAM_ROOM_AVAILABILITY_JSON_START", body)
        self.assertNotIn("private@example.com", body)
        self.assertNotIn("Customer Name", body)
        self.assertNotIn("private-booking", body)

    def test_zero_duration_blocks_full_day(self):
        sample = calendar(event("instant", "20261109T120000", "20261109T120000"))
        result = make_snapshot(sample, NOW)
        self.assertEqual(result["busy"]["2026-11-09"], [[0, 1440]])

    def test_reversed_time_blocks_two_days(self):
        sample = calendar(event("reversed", "20261110T230000", "20261110T010000"))
        result = make_snapshot(sample, NOW)
        self.assertEqual(result["busy"]["2026-11-10"], [[0, 1440]])
        self.assertEqual(result["busy"]["2026-11-11"], [[0, 1440]])

    def test_no_end_blocks_full_day(self):
        sample = calendar(
            "BEGIN:VEVENT\r\nUID:no-end\r\nDTSTART;TZID=America/St_Johns:20261112T100000\r\n"
            "SUMMARY:Private booking\r\nEND:VEVENT\r\n"
        )
        result = make_snapshot(sample, NOW)
        self.assertEqual(result["busy"]["2026-11-12"], [[0, 1440]])

    def test_empty_calendar_fails_closed(self):
        with self.assertRaises(ValueError):
            make_snapshot((HEAD + TAIL).encode(), NOW)


if __name__ == "__main__":
    unittest.main()
