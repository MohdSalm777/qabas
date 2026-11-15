import { outcomeClass } from "./TestCard";

// Ranking and Moon/Mars coverage, computed from tests.csv only.
// Nothing here is predicted: it is a re-ordering of what NASA reported.

const SEVERITY = ["no ignition", "no spread", "partial burn", "burned full length"];

const shortId = (id) => id.replace("SAFFIRE-II-", "");

function rankMaterials(tests) {
  const groups = {};
  for (const t of tests) {
    if (!groups[t.fuel]) groups[t.fuel] = [];
    groups[t.fuel].push(t);
  }
  return Object.entries(groups)
    .map(([fuel, rows]) => {
      const fractions = rows.map((t) =>
        t.burn_length_cm !== null && t.sample_length_cm ? t.burn_length_cm / t.sample_length_cm : 0
      );
      const worst = rows.reduce(
        (a, t) => (SEVERITY.indexOf(t.outcome) > SEVERITY.indexOf(a) ? t.outcome : a),
        SEVERITY[0]
      );
      return {
        fuel,
        rows,
        worst,
        fractions,
        mean: fractions.reduce((a, b) => a + b, 0) / fractions.length,
      };
    })
    .sort(
      (a, b) =>
        SEVERITY.indexOf(b.worst) - SEVERITY.indexOf(a.worst) || b.mean - a.mean
    );
}

function Insights({ tests }) {
  if (tests.length === 0) return null;

  const ranking = rankMaterials(tests);

  // Samples NASA reports as burning completely on Earth but not in microgravity.
  const gap = tests.filter(
    (t) => t.outcome_1g === "Complete" && t.outcome !== "burned full length"
  );

  const o2 = tests.map((t) => t.o2_pct).filter((v) => v !== null);
  const pressure = tests.map((t) => t.pressure_kpa).filter((v) => v !== null);
  const earthCount = tests.filter((t) => t.outcome_1g !== null).length;

  const gravity = [
    { name: "Microgravity", g: "about 0 g", count: tests.length, note: "SAFFIRE-II rows" },
    { name: "Moon", g: "0.17 g", count: 0, note: "no tests in this dataset" },
    { name: "Mars", g: "0.38 g", count: 0, note: "no tests in this dataset" },
    { name: "Earth", g: "1 g", count: earthCount, note: "comparison results" },
  ];

  return (
    <>
      <h3 className="sub">Materials ranked by how far they burned in microgravity</h3>
      <ol className="ranking">
        {ranking.map((m, index) => (
          <li className="rank" key={m.fuel}>
            <span className="rank-number">{index + 1}</span>
            <div className="rank-body">
              <div className="rank-head">
                <strong>{m.fuel}</strong>
                <span className={outcomeClass(m.worst)}>{m.worst}</span>
              </div>
              {m.rows.map((t, i) => (
                <div className="rank-bar" key={t.test_id}>
                  <span className="rank-id">{shortId(t.test_id)}</span>
                  <span className="rank-track">
                    <span className="rank-fill" style={{ width: `${m.fractions[i] * 100}%` }} />
                  </span>
                  <span className="rank-value">
                    {t.burn_length_cm} of {t.sample_length_cm} cm
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="hint">
        Order: worst reported outcome first, then the average share of the sample that burned.
        This is a QABAS ordering of {tests.length} test rows, not a NASA flammability rating.
        Samples differ in thickness and igniter power, so it is not a like-for-like comparison.
      </p>

      <h3 className="sub">Gravity changed the result</h3>
      <div className="callout">
        <p>
          {gap.length} of {tests.length} samples are reported as burning completely on Earth but
          not along their full length in microgravity:
        </p>
        <ul>
          {gap.map((t) => (
            <li key={t.test_id}>
              <strong>
                {shortId(t.test_id)} · {t.fuel}
              </strong>{" "}
              · Earth: {t.outcome_1g} · microgravity: {t.outcome} ({t.burn_length_cm} of{" "}
              {t.sample_length_cm} cm)
            </li>
          ))}
        </ul>
        <p className="hint">
          The source does not give the oxygen or pressure of the 1 g tests, so this compares
          reported outcomes only.
        </p>
      </div>

      <h3 className="sub">What this means for the Moon and Mars</h3>
      <div className="coverage">
        {gravity.map((level) => (
          <div className={level.count === 0 ? "cover cover-empty" : "cover"} key={level.name}>
            <p className="lab-label">
              {level.name} · {level.g}
            </p>
            <p className="cover-count">{level.count}</p>
            <p className="hint">{level.note}</p>
          </div>
        ))}
      </div>
      <ul className="limits">
        <li>
          <strong>Gravity:</strong> NASA states there is currently no partial-gravity
          combustion data in its PSI database, and expects it from the LUCI and FM2
          experiments. It also notes that microgravity and normal-gravity results could bound
          what occurs in between: QABAS shows both ends for every sample above. Treat that as
          a guide, not a rule.{" "}
          <a href="https://ntrs.nasa.gov/citations/20240015307" target="_blank" rel="noreferrer">
            NASA reports
          </a>{" "}
          that lunar gravity widens the flammability limits of some materials compared with
          Earth, so the Moon is not simply a midpoint.
        </li>
        <li>
          <strong>Atmosphere:</strong> every test here ran at {Math.min(...o2)} to{" "}
          {Math.max(...o2)} % oxygen and {Math.min(...pressure)} to {Math.max(...pressure)} kPa.
          NASA expects the Moon Base and pressurized rovers to use 30 % oxygen or more at
          10.2 psi (about 70 kPa) or less, so none of these tests matches that atmosphere.
        </li>
        <li>
          <strong>Use it for:</strong> which cabin materials spread flame in a normal-air
          spacecraft with 20 cm/s ventilation. <strong>Do not use it for:</strong> predicting
          behaviour in a lunar or Martian habitat.
        </li>
      </ul>
    </>
  );
}

export default Insights;