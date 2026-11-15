import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getFindings, getTests } from "./services/api";
import TestCard from "./components/TestCard";
import TestDetail from "./components/TestDetail";
import FireLab from "./components/FireLab";
import Insights from "./components/Insights";
import AskQabas from "./components/AskQabas";
import Investigations from "./components/Investigations";

function App() {
  const [tests, setTests] = useState([]);
  const [findings, setFindings] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const [fuel, setFuel] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [search, setSearch] = useState("");
  const [openTestId, setOpenTestId] = useState(null);

  // The intro plays once per browser tab; the data loads underneath meanwhile.
  // It is drawn for wide screens, so phones go straight to the site.
  const [showIntro, setShowIntro] = useState(() => {
    if (window.innerWidth < 760) return false;
    try {
      return sessionStorage.getItem("qabas-intro-seen") !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    function onMessage(event) {
      if (event.data && event.data.type === "qabas-start") {
        setShowIntro(false);
        try {
          sessionStorage.setItem("qabas-intro-seen", "1");
        } catch {
          // storage unavailable: the intro simply shows again next time
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    document.body.style.overflow = showIntro ? "hidden" : "";
  }, [showIntro]);

  useEffect(() => {
    getTests()
      .then((rows) => {
        setTests(rows);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // Findings load separately, so a problem in that file never hides the tests.
    getFindings()
      .then(setFindings)
      .catch(() => setFindings([]));
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
      <nav className="nav" aria-label="Sections">
        <span className="nav-brand">QABAS</span>
        <div className="nav-links">
          {[
            ["investigations", "Investigations"],
            ["tests", "Tests"],
            ["lab", "Fire Lab"],
            ["insights", "Insights"],
            ["ask", "Ask QABAS"],
            ["findings", "Findings"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)}>
              {label}
            </button>
          ))}
        </div>
      </nav>

      <header className="hero">
        <p className="eyebrow">NASA Space Apps 2026 · Flame in Freefall</p>
        <h1>QABAS</h1>
        <p className="tagline">Understanding fire beyond gravity</p>
        <p className="intro">
          NASA&apos;s spacecraft fire research in one place: every investigation ranked by
          the safety question it answers, and one of them, Saffire-II, explored down to
          the second.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={() => scrollTo("investigations")}>
            Explore investigations
          </button>
          <button className="secondary" onClick={() => scrollTo("lab")}>
            Open the Fire Lab
          </button>
        </div>
      </header>

      <main>
        <section id="investigations">
          <h2>Investigations</h2>
          <p className="section-intro">
            Seventeen NASA combustion investigations, grouped by fire safety pillar. Pick a
            need to rank them by relevance.
          </p>
          <Investigations onExplore={() => scrollTo("tests")} />
        </section>

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
          {findings.length === 0 && status !== "loading" && (
            <p className="message">Findings are not available right now.</p>
          )}
          <div className="findings">
            {findings.map((f) => (
              <article className="finding" key={f.finding_id}>
                <div className="finding-head">
                  <p className="card-id">{f.finding_id}</p>
                  {f.safety_pillar && <span className="badge badge-direct">{f.safety_pillar}</span>}
                </div>
                <p className="finding-text">{f.finding}</p>
                {f.evidence_quote && (
                  <blockquote>“{f.evidence_quote}”</blockquote>
                )}
                {(f.implication_for_crew || f.earth_application) && (
                  <dl className="finding-meaning">
                    {f.implication_for_crew && (
                      <div>
                        <dt>What it means for a crew</dt>
                        <dd>{f.implication_for_crew}</dd>
                      </div>
                    )}
                    {f.earth_application && (
                      <div>
                        <dt>Use on Earth</dt>
                        <dd>{f.earth_application}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <p className="hint">Conditions: {f.conditions}</p>
                <p className="hint">
                  Source: {f.source_id}
                  {f.page ? `, page ${f.page}` : ""}
                </p>
              </article>
            ))}
          </div>
          {findings.some((f) => f.implication_for_crew || f.earth_application) && (
            <p className="hint">
              The finding and the quote come from the NASA source. &quot;What it means for a
              crew&quot; and &quot;Use on Earth&quot; are the QABAS team&apos;s interpretation.
            </p>
          )}
        </section>
      </main>

      <footer>
        Data: NASA Physical Sciences Informatics, record PSI-99 (SAFFIRE-II). Empty
        values are shown as “Not available”; nothing is estimated.{" "}
        <button className="link" onClick={() => setShowIntro(true)}>
          Replay the intro
        </button>
      </footer>

      {showIntro && (
        <iframe
          className="intro-frame"
          src={`${import.meta.env.BASE_URL}intro.html`}
          title="QABAS introduction"
        />
      )}

      {openTestId && (
        <TestDetail testId={openTestId} onClose={() => setOpenTestId(null)} />
      )}
    </div>
  );
}

export default App;