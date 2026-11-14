import { useEffect, useMemo, useRef, useState } from "react";
import { getTest, getTimeseries } from "../services/api";
import { show } from "./TestCard";

// Fire Lab: replays a real SAFFIRE-II burn second by second.
// It does not predict anything. Every frame comes from the recorded data.

const W = 720;
const H = 170;
const CM_MIN = -2;
const CM_MAX = 30;
const STRIP_Y = 96;
const STRIP_H = 16;

const cmToX = (cm) => 30 + ((cm - CM_MIN) / (CM_MAX - CM_MIN)) * (W - 60);

// Some source cells hold words, not numbers (for example "Acceleratory").
function fromRaw(test, column) {
  const match = (test.raw_value || "").match(new RegExp(`${column}=([^;]+)`));
  return match ? match[1].trim() : null;
}

function spreadText(test, column) {
  if (test[column] !== null && test[column] !== undefined) return `${test[column]} mm/s`;
  const raw = fromRaw(test, column);
  if (!raw || /^(n\/a|note)/i.test(raw)) return "Not available";
  return `"${raw}" (as written in the source)`;
}

function sampleLabel(test) {
  const thickness = test.thickness_mm === null ? "thickness not available" : `${test.thickness_mm} mm`;
  const number = test.test_id.replace("SAFFIRE-II-", "");
  return `${number} · ${thickness} · ${test.flow_direction}`;
}

function FireLab({ tests }) {
  const fuels = useMemo(() => [...new Set(tests.map((t) => t.fuel))], [tests]);
  const [fuel, setFuel] = useState("");
  const [testId, setTestId] = useState("");
  const [data, setData] = useState(null); // { rows, tempKey }
  const [time, setTime] = useState(0); // position in rows (can be fractional)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(20);
  const timer = useRef(null);

  // Start on the most visual test once the list arrives.
  useEffect(() => {
    if (tests.length === 0 || testId) return;
    const first = tests.find((t) => t.test_id === "SAFFIRE-II-2-5") || tests[0];
    setFuel(first.fuel);
    setTestId(first.test_id);
  }, [tests, testId]);

  const options = tests.filter((t) => t.fuel === fuel);
  const test = tests.find((t) => t.test_id === testId);

  // Load the recorded curves for the chosen test.
  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    setData(null);
    setPlaying(false);
    getTest(testId)
      .then((detail) => {
        const tempKey = detail.sensor_summary.x_peak_sample_channel;
        return getTimeseries(testId, [
          "elapsed_s",
          "igniter_on",
          "flame_position_cm",
          "x_flame_trailing_edge_cm",
          "co2_pct",
          tempKey,
        ]).then((ts) => {
          if (!cancelled) setData({ rows: ts.rows, tempKey });
        });
      })
      .catch(() => {
        if (!cancelled) setData({ rows: [], tempKey: null });
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  // Playback window: from 5 s before ignition to 20 s after the last glow.
  const range = useMemo(() => {
    if (!data || data.rows.length === 0) return null;
    const rows = data.rows;
    const ignition = Math.max(rows.findIndex((r) => r.igniter_on === 1), 0);
    let lastGlow = ignition;
    rows.forEach((r, i) => {
      if (r.flame_position_cm !== null || r.igniter_on === 1) lastGlow = i;
    });
    return {
      ignition,
      start: Math.max(ignition - 5, 0),
      end: Math.min(lastGlow + 20, rows.length - 1),
    };
  }, [data]);

  useEffect(() => {
    if (range) setTime(range.start);
  }, [range]);

  useEffect(() => {
    if (!playing || !range) return undefined;
    timer.current = setInterval(() => {
      setTime((t) => {
        const next = t + speed / 10;
        if (next >= range.end) {
          setPlaying(false);
          return range.end;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(timer.current);
  }, [playing, speed, range]);

  function chooseFuel(value) {
    setFuel(value);
    const first = tests.find((t) => t.fuel === value);
    if (first) setTestId(first.test_id);
  }

  function togglePlay() {
    if (!range) return;
    if (!playing && time >= range.end) setTime(range.start);
    setPlaying(!playing);
  }

  if (!test) return null;

  const row = data && range ? data.rows[Math.floor(time)] : null;
  const spreads = test.outcome !== "no spread" && test.outcome !== "no ignition";

  // Burned length so far: farthest glow reached, never more than the reported burn length.
  let burned = 0;
  if (row && spreads && test.burn_length_cm !== null) {
    for (let i = range.ignition; i <= Math.floor(time); i += 1) {
      const p = data.rows[i].flame_position_cm;
      if (p !== null && p > burned) burned = p;
    }
    burned = Math.min(burned, test.burn_length_cm);
  }

  const lead = row ? row.flame_position_cm : null;
  const trail = row && row.x_flame_trailing_edge_cm !== null ? row.x_flame_trailing_edge_cm : lead;
  const isSplit = test.test_id.includes("2-7");
  const stripLength = isSplit ? 29 : test.sample_length_cm;
  const opposed = test.flow_direction === "Opposed";

  return (
    <div className="lab">
      <div className="lab-controls">
        <label>
          Material
          <select value={fuel} onChange={(e) => chooseFuel(e.target.value)}>
            {fuels.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <div className="lab-samples">
          <span className="lab-label">Sample tested by NASA</span>
          <div className="tabs">
            {options.map((t) => (
              <button
                key={t.test_id}
                className={t.test_id === testId ? "tab tab-active" : "tab"}
                onClick={() => setTestId(t.test_id)}
              >
                {sampleLabel(t)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lab-stage">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Replay of test ${test.test_id}`}>
          <defs>
            <radialGradient id="flameGlow">
              <stop offset="0%" stopColor="#fff3c4" />
              <stop offset="35%" stopColor="#ffb347" />
              <stop offset="75%" stopColor="#ff6a1a" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ff6a1a" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* airflow direction */}
          <text className="chart-tick" x={W / 2} y={22} textAnchor="middle">
            {opposed ? "← airflow" : "airflow →"} {test.airflow_cm_s} cm/s
          </text>

          {/* the sample strip */}
          <rect className="lab-strip" x={cmToX(0)} y={STRIP_Y} width={cmToX(stripLength) - cmToX(0)} height={STRIP_H} rx="3" />
          {isSplit && (
            <>
              <line className="lab-divider" x1={cmToX(5)} x2={cmToX(5)} y1={STRIP_Y - 6} y2={STRIP_Y + STRIP_H + 6} />
              <text className="chart-tick" x={cmToX(2.5)} y={STRIP_Y + STRIP_H + 20} textAnchor="middle">PMMA</text>
              <text className="chart-tick" x={cmToX(17)} y={STRIP_Y + STRIP_H + 20} textAnchor="middle">Nomex</text>
            </>
          )}

          {/* burned part */}
          {burned > 0 && (
            <rect className="lab-burned" x={cmToX(0)} y={STRIP_Y} width={cmToX(burned) - cmToX(0)} height={STRIP_H} rx="3" />
          )}

          {/* igniter */}
          <rect
            className={row && row.igniter_on === 1 ? "lab-igniter lab-igniter-on" : "lab-igniter"}
            x={cmToX(0) - 5}
            y={STRIP_Y - 8}
            width="5"
            height={STRIP_H + 16}
            rx="2"
          />
          <text className="chart-tick" x={cmToX(0) - 2} y={STRIP_Y - 14} textAnchor="middle">igniter</text>

          {/* glow recorded by the camera */}
          {lead !== null && (
            <ellipse
              cx={(cmToX(lead) + cmToX(trail)) / 2}
              cy={STRIP_Y - 2}
              rx={Math.max((cmToX(lead) - cmToX(trail)) / 2 + 6, 10)}
              ry={Math.min(14 + (lead - trail) * 2.2, 40)}
              fill="url(#flameGlow)"
            />
          )}

          {/* ruler */}
          {[0, 5, 10, 15, 20, 25, 30].map((cm) => (
            <g key={cm}>
              <line className="chart-grid" x1={cmToX(cm)} x2={cmToX(cm)} y1={H - 26} y2={H - 20} />
              <text className="chart-tick" x={cmToX(cm)} y={H - 6} textAnchor="middle">
                {cm}
              </text>
            </g>
          ))}
          <text className="chart-tick" x={cmToX(30) + 12} y={H - 6}>cm</text>
        </svg>

        {!data && <p className="hint">Loading recorded data…</p>}
        {data && data.rows.length > 0 && !data.rows.some((r) => r.flame_position_cm !== null) && (
          <p className="hint">
            No scaled camera images exist for this test, so the glow cannot be placed on the
            sample. The sensor readings below are still real.
          </p>
        )}
      </div>

      {row && (
        <>
          <div className="lab-player">
            <button className="primary" onClick={togglePlay}>
              {playing ? "Pause" : time >= range.end ? "Replay" : "Play"}
            </button>
            <input
              type="range"
              aria-label="Time"
              min={range.start}
              max={range.end}
              step="1"
              value={Math.floor(time)}
              onChange={(e) => {
                setPlaying(false);
                setTime(Number(e.target.value));
              }}
            />
            <label className="lab-speed">
              Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={5}>5×</option>
                <option value={20}>20×</option>
                <option value={60}>60×</option>
              </select>
            </label>
          </div>

          <dl className="lab-readouts">
            <div>
              <dt>Time since ignition</dt>
              <dd>{row.elapsed_s - data.rows[range.ignition].elapsed_s} s</dd>
            </div>
            <div>
              <dt>Glow front</dt>
              <dd>{lead === null ? "none visible" : `${lead.toFixed(1)} cm`}</dd>
            </div>
            <div>
              <dt>Sample temperature</dt>
              <dd>{row[data.tempKey] === null ? "Not available" : `${row[data.tempKey].toFixed(0)} °C`}</dd>
            </div>
            <div>
              <dt>CO₂</dt>
              <dd>{row.co2_pct === null ? "Not available" : `${row.co2_pct.toFixed(3)} %`}</dd>
            </div>
          </dl>
        </>
      )}

      <div className="lab-results">
        <div className="lab-result">
          <p className="lab-label">In microgravity (reported by NASA)</p>
          <p className="lab-outcome">{show(test.outcome)}</p>
          <p className="hint">
            Burn length {show(test.burn_length_cm, "cm")} · Spread {spreadText(test, "spread_mm_s")}
          </p>
        </div>
        <div className="lab-result">
          <p className="lab-label">Same sample on Earth, 1 g (reported by NASA)</p>
          <p className="lab-outcome">{show(test.outcome_1g)}</p>
          <p className="hint">Spread {spreadText(test, "spread_1g_mm_s")}</p>
        </div>
      </div>

      <p className="lab-note">
        This is a replay of test {test.test_id}, not a simulation. The glow position was measured by
        QABAS from NASA camera frames; temperature and CO₂ are NASA sensor readings. Oxygen and
        pressure cannot be changed because every SAFFIRE-II test ran in the same atmosphere
        (about 21.5 to 22.1 % O₂, about 102.6 kPa).
      </p>
    </div>
  );
}

export default FireLab;