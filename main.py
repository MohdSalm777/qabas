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

from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(__file__).parent / "data"
TS_DIR = DATA_DIR / "timeseries"

app = FastAPI(title="QABAS API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["GET"],
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