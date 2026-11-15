// All calls to the QABAS backend live here.
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function get(path) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${path}`);
  }
  return response.json();
}

export function getTests() {
  return get("/api/tests");
}

export function getTest(testId) {
  return get(`/api/tests/${encodeURIComponent(testId)}`);
}

export function getTimeseries(testId, columns, step = 1) {
  const params = new URLSearchParams({ step: String(step) });
  if (columns && columns.length > 0) params.set("columns", columns.join(","));
  return get(`/api/tests/${encodeURIComponent(testId)}/timeseries?${params}`);
}

export function getFindings() {
  return get("/api/findings");
}

export function getInvestigations() {
  return get("/api/investigations");
}

export function getSources() {
  return get("/api/sources");
}

export async function askQabas(question) {
  const response = await fetch(`${API_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

export function getCatalogue() {
  return get("/api/catalogue");
}