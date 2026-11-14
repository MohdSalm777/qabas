import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getFindings, getTests } from "./services/api";
import TestCard from "./components/TestCard";
import TestDetail from "./components/TestDetail";
import FireLab from "./components/FireLab";
import Insights from "./components/Insights";
import AskQabas from "./components/AskQabas";

function App() {
  const [tests, setTests] = useState([]);
  const [findings, setFindings] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const [fuel, setFuel] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [search, setSearch] = useState("");
  const [openTestId, setOpenTestId] = useState(null);

  useEffect(() => {
    Promise.all([getTests(), getFindings()])
      .then(([testRows, findingRows]) => {
        setTests(testRows);
        setFindings(findingRows);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  // Filter options come from the data, so new datasets appear automatically.
  const fuels = useMemo(() => [...new Set(tests.map((t) => t.fuel))], [tests]);
  const outcomes = useMemo(() => [...new Set(tests.map((t) => t.outcome))], [tests]);

  const visibleTests = tests.filter((t) => {
    const text = `${t.test_id} ${t.fuel} ${t.outcome} ${t.flow_direction}`.toLowerCase();
    return (
      (fuel === "all" || t.fuel === fuel) &&
      (outcome === "all" || t.outcome === outcome) &&
      text.includes(search.trim().toLowerCase())
    );
  });

  function scrollTo(id) {
    document.getElementById(id).scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">NASA Space Apps 2026 · Flame in Freefall</p>
        <h1>QABAS</h1>
        <p className="tagline">Understanding fire beyond gravity</p>
        <p className="intro">
          Explore real NASA spacecraft fire experiments: what burned, what did not, and
          how the same material behaved on Earth.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={() => scrollTo("tests")}>
            Explore the tests
          </button>
          <button className="secondary" onClick={() => scrollTo("lab")}>
            Open the Fire Lab
          </button>
        </div>
      </header>

      <main>
        <section id="tests">
          <h2>SAFFIRE-II tests</h2>
          <p className="section-intro">
            Nine samples were ignited inside a Cygnus cargo spacecraft in 2016. Sample
            2-7 held two materials, so it appears as two rows.
          </p>

          <div className="filters">
            <label>
              Material
              <select value={fuel} onChange={(e) => setFuel(e.target.value)}>
                <option value="all">All materials</option>
                {fuels.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Outcome
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="all">All outcomes</option>
                {outcomes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Search
              <input
                type="search"
                placeholder="e.g. PMMA, opposed, 2-5"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>

          {status === "loading" && <p className="message">Loading tests…</p>}
          {status === "error" && (
            <p className="message">
              Could not reach the QABAS API. Check that the backend is running on port
              8000.
            </p>
          )}
          {status === "ready" && (
            <>
              <p className="count">
                Showing {visibleTests.length} of {tests.length} tests
              </p>
              {visibleTests.length === 0 ? (
                <p className="message">No tests match these filters.</p>
              ) : (
                <div className="grid">
                  {visibleTests.map((t) => (
                    <TestCard key={t.test_id} test={t} onOpen={setOpenTestId} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section id="lab">
          <h2>Fire Lab</h2>
          <p className="section-intro">
            Pick a material and a sample, then watch the real burn replayed second by
            second and compare it with the same sample on Earth.
          </p>
          {status === "ready" && <FireLab tests={tests} />}
        </section>

        <section id="insights">
          <h2>Fire safety insights</h2>
          <p className="section-intro">
            What the tests say when you put them side by side, and where the data stops.
          </p>
          {status === "ready" && <Insights tests={tests} />}
        </section>

        <section id="ask">
          <h2>Ask QABAS</h2>
          <p className="section-intro">
            Ask a question in plain language. The answer comes only from the records on
            this site, and each statement points to the record behind it.
          </p>
          <AskQabas onOpenTest={setOpenTestId} />
        </section>

        <section id="findings">
          <h2>Findings</h2>
          <p className="section-intro">
            Each finding is taken from the source text, with the conditions it applies
            to.
          </p>
          <div className="findings">
            {findings.map((f) => (
              <article className="finding" key={f.finding_id}>
                <p className="card-id">{f.finding_id}</p>
                <p className="finding-text">{f.finding}</p>
                {f.evidence_quote && (
                  <blockquote>“{f.evidence_quote}”</blockquote>
                )}
                <p className="hint">Conditions: {f.conditions}</p>
                <p className="hint">Source: {f.source_id}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer>
        Data: NASA Physical Sciences Informatics, record PSI-99 (SAFFIRE-II). Empty
        values are shown as “Not available”; nothing is estimated.
      </footer>

      {openTestId && (
        <TestDetail testId={openTestId} onClose={() => setOpenTestId(null)} />
      )}
    </div>
  );
}

export default App;