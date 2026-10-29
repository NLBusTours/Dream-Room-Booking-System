"""Publish anonymous BAND busy-time JSON to one existing GitHub issue.

Editing the issue avoids 48 commits/day to the public website repository.
No BAND subscription URL, calendar titles, IDs or customer details are written.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

ISSUE_NUMBER = 11
MARKER_START = "<!-- DREAM_ROOM_AVAILABILITY_JSON_START"
MARKER_END = "DREAM_ROOM_AVAILABILITY_JSON_END -->"


def make_body(snapshot: dict) -> str:
    # Only the deliberately public, minimal snapshot keys are copied.
    data = {
        "version": snapshot["version"],
        "timezone": snapshot["timezone"],
        "generated_at": snapshot["generated_at"],
        "from_date": snapshot["from_date"],
        "through_date": snapshot["through_date"],
        "busy": snapshot["busy"],
    }
    return (
        "This issue contains automatically refreshed **anonymous** Dream Room occupied-time data.\n\n"
        "It includes no customer names, event descriptions, attendee information or private calendar tokens. "
        "A time marked open is only **available to request**, not a confirmed reservation.\n\n"
        f"{MARKER_START}\n{json.dumps(data, separators=(',', ':'), sort_keys=True)}\n{MARKER_END}"
    )


def publish() -> None:
    path = Path("availability.json")
    if not path.is_file():
        print("No snapshot found, leaving the public status as unverified")
        return
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not token or repo != "NLBusTours/Dream-Room-Booking-System":
        raise RuntimeError("Missing GitHub permissions or unexpected repository")
    snapshot = json.loads(path.read_text(encoding="utf-8"))
    body = json.dumps({"body": make_body(snapshot)}).encode("utf-8")
    req = Request(
        f"https://api.github.com/repos/{repo}/issues/{ISSUE_NUMBER}",
        data=body,
        method="PATCH",
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "DreamRoomAvailability/1.0",
        },
    )
    with urlopen(req, timeout=20) as resp:
        if resp.status != 200:
            raise RuntimeError("GitHub refused the snapshot publication")
    print("Anonymous availability snapshot refreshed in public status issue")


if __name__ == "__main__":
    publish()
