import os
import json
import calendar
from datetime import datetime, timedelta
from collections import defaultdict
from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)
DATA_DIR = os.environ.get("DATA_DIR", "/code/data")
os.makedirs(DATA_DIR, exist_ok=True)


def _slug(name: str) -> str:
    name = (name or "").strip().lower().replace(" ", "-")
    safe = [c for c in name if c.isalnum() or c in ("-", "_")]
    return "".join(safe) or "session"


def _session_path(name: str) -> str:
    return os.path.join(DATA_DIR, f"{_slug(name)}.json")


def get_period_start(dt: datetime, anchor_month: int, anchor_day: int) -> datetime:
    """
    Get the start of the period for a given date based on anchor month/day.
    Handles edge cases like Feb 29 on non-leap years.
    """
    def safe_create_date(year: int, month: int, day: int) -> datetime:
        try:
            return datetime(year, month, day)
        except ValueError:
            # Handle invalid dates like Feb 29 on non-leap years
            # Use the last valid day of the month instead
            max_day = calendar.monthrange(year, month)[1]
            return datetime(year, month, min(day, max_day))
    
    if (dt.month < anchor_month) or (dt.month == anchor_month and dt.day < anchor_day):
        return safe_create_date(dt.year - 1, anchor_month, anchor_day)
    else:
        return safe_create_date(dt.year, anchor_month, anchor_day)


def calculate_totals(
    ranges: list[tuple[str, str]],
    anchor_month: int,
    anchor_day: int,
    min_days: int,
    want_heatmap: bool = False,
):
    yearly_totals: dict[int, int] = defaultdict(int)
    errors: list[str] = []
    heatmap_days: dict[str, set[str]] = defaultdict(set) if want_heatmap else {}

    for i, (start_str, end_str) in enumerate(ranges, 1):
        try:
            start_dt = datetime.strptime(start_str, "%Y-%m-%d")
            end_dt = datetime.strptime(end_str, "%Y-%m-%d")
        except Exception:
            errors.append(f"Range {i}: Invalid date format (use YYYY-MM-DD)")
            continue

        if end_dt < start_dt:
            errors.append(f"Range {i}: End date before start date")
            continue

        current_period_start = get_period_start(start_dt, anchor_month, anchor_day)
        while current_period_start <= end_dt:
            # Calculate next period start, handling edge cases like Feb 29
            try:
                current_period_end = current_period_start.replace(year=current_period_start.year + 1)
            except ValueError:
                # Handle Feb 29 -> next year (non-leap)
                max_day = calendar.monthrange(current_period_start.year + 1, current_period_start.month)[1]
                current_period_end = datetime(
                    current_period_start.year + 1,
                    current_period_start.month,
                    min(current_period_start.day, max_day)
                )
            effective_end = current_period_end - timedelta(days=1)

            overlap_start = max(start_dt, current_period_start)
            overlap_end = min(end_dt, effective_end)

            if overlap_start <= overlap_end:
                days = (overlap_end - overlap_start).days + 1
                yearly_totals[current_period_start.year] += days
                if want_heatmap:
                    label = f"{current_period_start.year}-{current_period_start.year + 1}"
                    cur = overlap_start
                    while cur <= overlap_end:
                        heatmap_days[label].add(cur.strftime("%Y-%m-%d"))
                        cur += timedelta(days=1)

            current_period_start = current_period_end

    passes: dict[str, bool] = {}
    for y in yearly_totals.keys():
        label = f"{y}-{y+1}"
        passes[label] = yearly_totals[y] >= min_days

    overall_pass = all(passes.values()) if passes else False
    return yearly_totals, errors, passes, overall_pass, {k: sorted(v) for k, v in heatmap_days.items()} if want_heatmap else {}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {
        "service": "date-calculator-api",
        "message": "Backend is running",
        "endpoints": ["/health", "/calculate", "/sessions"],
    }


@app.post("/calculate")
def calculate():
    data = request.get_json(silent=True) or {}
    ranges = data.get("ranges", [])
    
    # Validate and parse input parameters
    try:
        anchor_month = int(data.get("anchorMonth", 9))
        anchor_day = int(data.get("anchorDay", 17))
        min_days = int(data.get("minDays", 183))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid parameter values"}), 400
    
    # Validate anchor date
    if not (1 <= anchor_month <= 12):
        return jsonify({"error": "anchor_month must be between 1 and 12"}), 400
    if not (1 <= anchor_day <= 31):
        return jsonify({"error": "anchor_day must be between 1 and 31"}), 400
    
    # Validate the anchor date is valid for the month
    try:
        # Test if this date can exist
        datetime(2024, anchor_month, anchor_day)
    except ValueError:
        return jsonify({"error": f"Invalid anchor date: month {anchor_month} doesn't have {anchor_day} days"}), 400
    
    merge_overlaps = bool(data.get("mergeOverlaps", False))
    want_heatmap = bool(data.get("heatmap", False))

    norm: list[tuple[str, str]] = []
    for item in ranges:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            continue
        norm.append((str(item[0]), str(item[1])))

    seen = set()
    norm_dedup: list[tuple[str, str]] = []
    for pair in norm:
        if pair in seen:
            continue
        seen.add(pair)
        norm_dedup.append(pair)

    merge_errors: list[str] = []
    merged_norm = norm_dedup
    if merge_overlaps:
        try:
            parsed: list[tuple[datetime, datetime]] = []
            for i, (s, e) in enumerate(norm_dedup, 1):
                try:
                    sd = datetime.strptime(s, "%Y-%m-%d")
                    ed = datetime.strptime(e, "%Y-%m-%d")
                except Exception:
                    merge_errors.append(f"Range {i}: Invalid date format (merge stage)")
                    continue
                if ed < sd:
                    merge_errors.append(f"Range {i}: End date before start date (merge stage)")
                    continue
                parsed.append((sd, ed))

            parsed.sort(key=lambda p: p[0])
            merged: list[tuple[datetime, datetime]] = []
            for sd, ed in parsed:
                if not merged:
                    merged.append((sd, ed))
                    continue
                ms, me = merged[-1]
                if sd <= me + timedelta(days=1):
                    new_end = ed if ed > me else me
                    merged[-1] = (ms, new_end)
                else:
                    merged.append((sd, ed))

            merged_norm = [(m[0].strftime("%Y-%m-%d"), m[1].strftime("%Y-%m-%d")) for m in merged]
        except Exception:
            merged_norm = norm_dedup

    totals, errors, passes, overall, heatmap = calculate_totals(
        merged_norm, anchor_month, anchor_day, min_days, want_heatmap
    )
    return jsonify(
        {
            "totals": {f"{y}-{y+1}": totals[y] for y in sorted(totals.keys())},
            "errors": (merge_errors + errors),
            "passes": passes,
            "overall_pass": overall,
            "threshold": min_days,
            "anchor": {"month": anchor_month, "day": anchor_day},
            "merge_overlaps": merge_overlaps,
            "heatmap": heatmap,
        }
    )


@app.get("/sessions")
def list_sessions():
    items = []
    for fname in os.listdir(DATA_DIR):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(DATA_DIR, fname)
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            mtime = 0
        items.append({"name": fname[:-5], "updated": int(mtime)})
    items.sort(key=lambda x: x["updated"], reverse=True)
    return jsonify({"sessions": items})


@app.get("/sessions/<name>")
def get_session(name: str):
    path = _session_path(name)
    if not os.path.exists(path):
        return jsonify({"error": "not_found"}), 404
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return jsonify({"error": "read_failed"}), 500
    return jsonify(data)


@app.post("/sessions")
def save_session():
    body = request.get_json(silent=True) or {}
    name = body.get("name")
    if not name:
        return jsonify({"error": "name_required"}), 400
    payload = {"ranges": body.get("ranges", []), "settings": body.get("settings", {})}
    path = _session_path(name)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except Exception:
        return jsonify({"error": "write_failed"}), 500
    return jsonify({"ok": True, "name": _slug(name)})


@app.delete("/sessions/<name>")
def delete_session(name: str):
    path = _session_path(name)
    if not os.path.exists(path):
        return jsonify({"ok": True})
    try:
        os.remove(path)
    except Exception:
        return jsonify({"error": "delete_failed"}), 500
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)


