import { useEffect, useState } from "react";
import { getTest, getTimeseries } from "../services/api";
import { show, outcomeClass } from "./TestCard";
import TimeChart from "./TimeChart";

function Row({ label, value }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TestDetail({ testId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [series, setSeries] = useState(null);
  const [channel, setChannel] = useState("flame");

  useEffect(() => {
    setDetail(null);
    setSeries(null);
    setError("");
    setChannel("flame");
    getTest(testId)
      .then((data) => {
        setDetail(data);
        if (!data.has_timeseries || !data.sensor_summary) return;
        const sampleKey = data.sensor_summary.x_peak_sample_channel;
        const plumeKey = data.sensor_summary.x_peak_plume_channel;
        return getTimeseries(testId, [
          "elapsed_s",
          "igniter_on",
          "flame_position_cm",
          "co2_pct",
          sampleKey,
          plumeKey,
        ]).then((ts) => setSeries(ts.rows));
      })
      .catch(() => setError("Could not load this test."));
  }, [testId]);

  // Close with the Escape key.
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const test = detail?.test;
  const sensors = detail?.sensor_summary;
  const source = detail?.source;
  const notes = test?.notes ? test.notes.split(" | ") : [];
  const conflicts = notes.filter((note) => note.startsWith("CONFLICT"));
  const otherNotes = notes.filter((note) => !note.startsWith("CONFLICT"));

  // The four curves the user can switch between.
  const channels = sensors
    ? {
        flame: {
          tab: "Flame position",
          key: "flame_position_cm",
          unit: "cm",
          caption:
            "Farthest glowing edge from the igniter, measured by QABAS from the camera frames (one per second). While the igniter is on, this includes the glowing igniter coil.",
        },
        sample: {
          tab: "Sample temperature",
          key: sensors.x_peak_sample_channel,
          unit: "°C",
          caption: `Thermocouple ${sensors.x_peak_sample_channel}: the one of six on the sample that read the highest.`,
        },
        plume: {
          tab: "Plume temperature",
          key: sensors.x_peak_plume_channel,
          unit: "°C",
          caption: `Thermocouple ${sensors.x_peak_plume_channel}: the one of six in the plume that read the highest.`,
        },
        co2: {
          tab: "CO₂",
          key: "co2_pct",
          unit: "%",
          caption: "Carbon dioxide measured in the test section.",
        },
      }
    : null;
  const active = channels ? channels[channel] : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Test ${testId}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {error && <p className="message">{error}</p>}
        {!detail && !error && <p className="message">Loading…</p>}

        {test && (
          <>
            <p className="card-id">{test.test_id}</p>
            <h2 className="modal-title">{test.fuel}</h2>
            <span className={outcomeClass(test.outcome)}>{show(test.outcome)}</span>
            <p className="hint">
              Outcome label assigned by QABAS from the reported burn length. It is not
              wording from the NASA source.
            </p>

            <h3>Test conditions</h3>
            <dl className="rows">
              <Row label="Thickness" value={show(test.thickness_mm, "mm")} />
              <Row
                label="Sample size"
                value={`${show(test.sample_length_cm, "cm")} × ${show(test.sample_width_cm, "cm")}`}
              />
              <Row label="Oxygen" value={show(test.o2_pct, "%")} />
              <Row label="Pressure" value={show(test.pressure_kpa, "kPa")} />
              <Row
                label="Airflow"
                value={`${show(test.airflow_cm_s, "cm/s")} · ${show(test.flow_direction)}`}
              />
              <Row
                label="Igniter"
                value={`${show(test.ignition_power_w, "W")} for ${show(test.ignition_time_s, "s")}`}
              />
            </dl>

            <h3>Microgravity vs Earth</h3>
            <table className="compare">
              <thead>
                <tr>
                  <th></th>
                  <th>Microgravity</th>
                  <th>Earth (1 g)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Result</th>
                  <td>{show(test.outcome)}</td>
                  <td>{show(test.outcome_1g)}</td>
                </tr>
                <tr>
                  <th>Burn length</th>
                  <td>{show(test.burn_length_cm, "cm")}</td>
                  <td>{show(test.x_burn_length_1g_cm, "cm")}</td>
                </tr>
                <tr>
                  <th>Spread rate</th>
                  <td>{show(test.spread_mm_s, "mm/s")}</td>
                  <td>{show(test.spread_1g_mm_s, "mm/s")}</td>
                </tr>
                <tr>
                  <th>Burn time</th>
                  <td>{show(test.burn_time_s, "s")}</td>
                  <td>Not available</td>
                </tr>
              </tbody>
            </table>

            {sensors && (
              <>
                <h3>Sensor peaks</h3>
                <dl className="rows">
                  <Row
                    label="Peak sample temperature"
                    value={show(sensors.peak_sample_temp_c, "°C")}
                  />
                  <Row
                    label="Peak plume temperature"
                    value={show(sensors.peak_plume_temp_c, "°C")}
                  />
                  <Row
                    label="Peak radiometer"
                    value={show(sensors.peak_radiometer_mw_cm2, "mW/cm²")}
                  />
                  <Row
                    label="CO₂ start → peak"
                    value={`${show(sensors.co2_start_pct, "%")} → ${show(sensors.co2_peak_pct, "%")}`}
                  />
                  <Row
                    label="O₂ start → minimum"
                    value={`${show(sensors.o2_start_pct, "%")} → ${show(sensors.o2_min_pct, "%")}`}
                  />
                </dl>
              </>
            )}

            {channels && detail.has_timeseries && (
              <>
                <h3>Second by second</h3>
                <div className="tabs" role="tablist">
                  {Object.entries(channels).map(([id, c]) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={channel === id}
                      className={channel === id ? "tab tab-active" : "tab"}
                      onClick={() => setChannel(id)}
                    >
                      {c.tab}
                    </button>
                  ))}
                </div>
                {series ? (
                  <TimeChart rows={series} yKey={active.key} unit={active.unit} label={active.tab} />
                ) : (
                  <p className="message">Loading sensor data…</p>
                )}
                <p className="hint">{active.caption}</p>
              </>
            )}

            {conflicts.length > 0 && (
              <>
                <h3>Where sources disagree</h3>
                <ul className="notes conflicts">
                  {conflicts.map((note) => (
                    <li key={note}>{note.replace("CONFLICT ", "")}</li>
                  ))}
                </ul>
              </>
            )}

            {test.raw_value && (
              <>
                <h3>As written in the source</h3>
                <p className="raw">{test.raw_value}</p>
              </>
            )}

            {otherNotes.length > 0 && (
              <details>
                <summary>Extraction notes ({otherNotes.length})</summary>
                <ul className="notes">
                  {otherNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </details>
            )}

            <h3>Source</h3>
            <p className="source">
              {source ? source.title : test.source_id}
              {source?.file_name && <span> · {source.file_name}</span>}
              <br />
              NASA PSI record {source?.psi_record_id || "PSI-99"} ·{" "}
              <a href="https://doi.org/10.60555/2chp-m469" target="_blank" rel="noreferrer">
                doi.org/10.60555/2chp-m469
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default TestDetail;