"""QABAS backend - serves the SAFFIRE-II extraction (PSI-99) as JSON.

Folder layout expected next to this file:

    data/
        investigations.csv
        tests.csv
        findings.csv
        sources.csv
        environments.csv
        sensor_summary.csv
        timeseries/
            timeseries_SAFFIRE-II-2-1.csv
            ...
            timeseries_SAFFIRE-II-2-9.csv

Run:  uvicorn main:app --reload
"""

import json
import math
import os
import re
import urllib.request
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DATA_DIR = Path(__file__).parent / "data"
TS_DIR = DATA_DIR / "timeseries"

app = FastAPI(title="QABAS API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------- helpers ----------

def load_table(name: str) -> pd.DataFrame:
    """Read data/<name>.csv. Empty cells stay empty (None in JSON), never 0."""
    path = DATA_DIR / f"{name}.csv"
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Missing data file: {path.name}")
    return pd.read_csv(path)


def to_records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> list of dicts, with NaN turned into None so JSON is valid."""
    return df.astype(object).where(pd.notna(df), None).to_dict(orient="records")


def timeseries_path(test_id: str) -> Path:
    # Sample 2-7 was one burn: the Nomex row shares the PMMA row's sensor file.
    if test_id == "SAFFIRE-II-2-7-Nomex":
        test_id = "SAFFIRE-II-2-7-PMMA"
    return TS_DIR / f"timeseries_{test_id}.csv"


# ---------- basic routes ----------

@app.get("/")
def root():
    return {"message": "QABAS API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- data routes ----------

@app.get("/api/investigations")
def get_investigations():
    return to_records(load_table("investigations"))


@app.get("/api/tests")
def get_tests(
    fuel: str | None = Query(None, description="e.g. PMMA, Silicone, Nomex"),
    outcome: str | None = Query(None, description="e.g. no spread, partial burn"),
    investigation: str | None = Query(None, description="e.g. SAFFIRE-II"),
):
    df = load_table("tests")
    if fuel:
        df = df[df["fuel"].str.contains(fuel, case=False, na=False)]
    if outcome:
        df = df[df["outcome"].str.lower() == outcome.lower()]
    if investigation:
        df = df[df["investigation_id"].str.lower() == investigation.lower()]
    return to_records(df)


@app.get("/api/tests/{test_id}")
def get_test(test_id: str):
    tests = load_table("tests")
    row = tests[tests["test_id"] == test_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Test not found")
    test = to_records(row)[0]

    sensors = load_table("sensor_summary")
    s_row = sensors[sensors["test_id"] == test_id]
    sources = load_table("sources")
    src_row = sources[sources["source_id"] == test["source_id"]]

    return {
        "test": test,
        "sensor_summary": to_records(s_row)[0] if not s_row.empty else None,
        "source": to_records(src_row)[0] if not src_row.empty else None,
        "has_timeseries": timeseries_path(test_id).exists(),
    }


@app.get("/api/tests/{test_id}/timeseries")
def get_timeseries(
    test_id: str,
    columns: str | None = Query(
        None, description="Comma-separated column names. Default: the main channels."
    ),
    step: int = Query(1, ge=1, le=60, description="Keep every Nth second"),
):
    path = timeseries_path(test_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="No timeseries for this test")
    df = pd.read_csv(path)

    if columns:
        wanted = [c.strip() for c in columns.split(",") if c.strip()]
        unknown = [c for c in wanted if c not in df.columns]
        if unknown:
            raise HTTPException(status_code=400, detail=f"Unknown columns: {unknown}")
    else:
        wanted = [c for c in df.columns if not c.startswith("x_") and c != "test_id"]
    if "elapsed_s" not in wanted:
        wanted = ["elapsed_s"] + wanted

    df = df[wanted].iloc[::step]
    return {
        "test_id": test_id,
        "file": path.name,
        "columns": wanted,
        "rows": to_records(df),
    }


@app.get("/api/findings")
def get_findings(investigation: str | None = None):
    df = load_table("findings")
    if investigation:
        df = df[df["investigation_id"].str.lower() == investigation.lower()]
    return to_records(df)


@app.get("/api/findings/{finding_id}")
def get_finding(finding_id: str):
    df = load_table("findings")
    row = df[df["finding_id"] == finding_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Finding not found")
    return to_records(row)[0]


@app.get("/api/sources")
def get_sources():
    return to_records(load_table("sources"))


@app.get("/api/environments")
def get_environments():
    return to_records(load_table("environments"))


# ---------- Ask QABAS (AI assistant) ----------
# The assistant may only use the records below, which are built from the CSV files.
# Set GEMINI_API_KEY on the server to switch on written answers. Without a key the
# endpoint still works and returns the closest records.

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

SYSTEM_PROMPT = """You are Ask QABAS, an assistant for a NASA Space Apps project about
spacecraft fire safety. Answer ONLY from the RECORDS given to you.

Rules:
- Every factual sentence must end with the id of the record it comes from in square
  brackets, for example [SAFFIRE-II-2-5]. Use the ids exactly as written.
- Never give a number, material, or result that is not in the RECORDS.
- If the RECORDS do not answer the question, say exactly: "The QABAS dataset does not
  contain enough information to answer that." Then say in one sentence what the dataset
  does cover.
- The dataset is SAFFIRE-II only: microgravity tests at about 21.5-22.1 % oxygen and about
  102.6 kPa. Do not extend results to the Moon, Mars, or other atmospheres; say the data
  does not cover them.
- Outcome labels (no spread, partial burn, burned full length, no ignition) are QABAS
  labels, not NASA wording. Say so if the user asks about outcomes.
- Be brief: at most 6 sentences, plain language. Reply in the language of the question.
"""


def _text(value, unit=""):
    if value is None:
        return "not available"
    return f"{value} {unit}".strip()


def build_records() -> list[dict]:
    """Turn the CSV rows into short text records the assistant can quote."""
    records = []

    sensors = {row["test_id"]: row for row in to_records(load_table("sensor_summary"))}
    tests = to_records(load_table("tests"))
    for t in tests:
        s = sensors.get(t["test_id"], {})
        conflicts = [n for n in (t["notes"] or "").split(" | ") if n.startswith("CONFLICT")]
        text = (
            f"Fuel {t['fuel']}; thickness {_text(t['thickness_mm'], 'mm')}; sample "
            f"{_text(t['sample_length_cm'], 'cm')} long, {_text(t['sample_width_cm'], 'cm')} wide; "
            f"oxygen {_text(t['o2_pct'], '%')}; pressure {_text(t['pressure_kpa'], 'kPa')}; "
            f"airflow {_text(t['airflow_cm_s'], 'cm/s')}, {t['flow_direction']}; igniter "
            f"{_text(t['ignition_power_w'], 'W')} for {_text(t['ignition_time_s'], 's')}. "
            f"Microgravity result: {_text(t['outcome'])} (QABAS label); burn length "
            f"{_text(t['burn_length_cm'], 'cm')}; burn time {_text(t['burn_time_s'], 's')}; "
            f"spread rate {_text(t['spread_mm_s'], 'mm/s')}. "
            f"Earth 1 g result for the same sample: {_text(t['outcome_1g'])}; spread rate "
            f"{_text(t['spread_1g_mm_s'], 'mm/s')}. "
            f"Source cells as written: {_text(t['raw_value'])}. "
            f"Sensors: peak sample temperature {_text(s.get('peak_sample_temp_c'), 'C')}; peak plume "
            f"temperature {_text(s.get('peak_plume_temp_c'), 'C')}; peak radiometer "
            f"{_text(s.get('peak_radiometer_mw_cm2'), 'mW/cm2')}; CO2 from "
            f"{_text(s.get('co2_start_pct'), '%')} to peak {_text(s.get('co2_peak_pct'), '%')}; "
            f"O2 from {_text(s.get('o2_start_pct'), '%')} to minimum {_text(s.get('o2_min_pct'), '%')}. "
            + (f"Source disagreements: {'; '.join(conflicts)}." if conflicts else "")
        )
        records.append({"id": t["test_id"], "kind": "test", "title": f"{t['fuel']} test", "text": text})

    for f in to_records(load_table("findings")):
        text = f"{f['finding']} Conditions: {f['conditions']}. Source quote: \"{f['evidence_quote']}\""
        records.append({"id": f["finding_id"], "kind": "finding", "title": "Finding", "text": text})

    for inv in to_records(load_table("investigations")):
        text = (
            f"Objective: {inv['objective']} Platform: {inv['platform']}. Year {inv['year']}. "
            f"Materials: {inv['fuels_sample']}. Oxygen {inv['o2_min_pct']} to {inv['o2_max_pct']} %; "
            f"pressure {inv['pressure_min_kpa']} to {inv['pressure_max_kpa']} kPa. "
            f"Variables changed: {inv['variables_changed']}. Sensors: {inv['sensors']}. "
            f"{inv['n_tests']} test rows from 9 ignitions."
        )
        records.append({"id": inv["investigation_id"], "kind": "investigation", "title": "Investigation", "text": text})

    earth = sum(1 for t in tests if t["outcome_1g"] is not None)
    records.append({
        "id": "QABAS-COVERAGE",
        "kind": "coverage",
        "title": "What the dataset covers",
        "text": (
            f"The QABAS dataset holds {len(tests)} microgravity test rows and {earth} Earth 1 g "
            "comparison results, all from SAFFIRE-II. It holds no tests at Moon gravity (0.17 g) "
            "or Mars gravity (0.38 g), and no tests at other oxygen levels or pressures, so it "
            "cannot predict fire behaviour in a lunar or Martian habitat or in NASA's proposed "
            "exploration atmosphere (34 % oxygen at 56.5 kPa)."
        ),
    })
    return records


STOPWORDS = set(
    "a an and are as at be by did do does for from get got how i in is it of on or "
    "that the this to was were what when where which who why with".split()
)


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOPWORDS]


def closest_records(question: str, records: list[dict], limit: int = 3) -> list[dict]:
    """Simple keyword search: rarer words count more."""
    docs = [set(_tokens(r["id"] + " " + r["title"] + " " + r["text"])) for r in records]
    scores = []
    for words in docs:
        score = 0.0
        for token in set(_tokens(question)):
            if token in words:
                seen = sum(1 for d in docs if token in d)
                score += math.log(1 + len(docs) / seen)
        scores.append(score)
    ranked = sorted(zip(scores, range(len(records))), reverse=True)
    return [records[i] for score, i in ranked[:limit] if score > 0]


def ask_gemini(question: str, records: list[dict]) -> str:
    context = "\n".join(f"[{r['id']}] ({r['kind']}) {r['text']}" for r in records)
    body = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": f"RECORDS:\n{context}\n\nQUESTION: {question}"}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1500},
    }
    request = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        data = json.loads(response.read())
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


class Question(BaseModel):
    question: str


@app.post("/api/ask")
def ask(body: Question):
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")
    if len(question) > 500:
        raise HTTPException(status_code=400, detail="Question is too long (500 characters max)")

    records = build_records()
    by_id = {r["id"]: r for r in records}

    if GEMINI_API_KEY:
        try:
            answer = ask_gemini(question, records)
            cited = [i for i in dict.fromkeys(re.findall(r"\[([A-Za-z0-9\-]+)\]", answer)) if i in by_id]
            return {
                "mode": "ai",
                "answer": answer,
                "sources": [{"id": i, "kind": by_id[i]["kind"], "title": by_id[i]["title"]} for i in cited],
            }
        except Exception:
            pass  # fall back to the closest records below

    matches = closest_records(question, records)
    return {
        "mode": "records",
        "answer": (
            "Written AI answers are not switched on, so here are the closest records in the dataset."
            if matches
            else "No record in the QABAS dataset matches that question."
        ),
        "sources": [
            {"id": r["id"], "kind": r["kind"], "title": r["title"], "text": r["text"]} for r in matches
        ],
    }
