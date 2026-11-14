// One card per test row. Clicking it opens the detail window.

export function show(value, unit = "") {
  if (value === null || value === undefined || value === "") return "Not available";
  return unit ? `${value} ${unit}` : String(value);
}

export function outcomeClass(outcome) {
  if (!outcome) return "badge";
  return "badge badge-" + outcome.toLowerCase().replaceAll(" ", "-");
}

function TestCard({ test, onOpen }) {
  return (
    <button className="card" onClick={() => onOpen(test.test_id)}>
      <div className="card-top">
        <span className="card-id">{test.test_id}</span>
        <span className={outcomeClass(test.outcome)}>{show(test.outcome)}</span>
      </div>

      <h3 className="card-title">{test.fuel}</h3>

      <dl className="card-facts">
        <div>
          <dt>Thickness</dt>
          <dd>{show(test.thickness_mm, "mm")}</dd>
        </div>
        <div>
          <dt>Airflow</dt>
          <dd>
            {show(test.airflow_cm_s, "cm/s")} · {show(test.flow_direction)}
          </dd>
        </div>
        <div>
          <dt>Burn length</dt>
          <dd>
            {show(test.burn_length_cm, "cm")} of {show(test.sample_length_cm, "cm")}
          </dd>
        </div>
        <div>
          <dt>On Earth (1 g)</dt>
          <dd>{show(test.outcome_1g)}</dd>
        </div>
      </dl>

      <span className="card-more">View details</span>
    </button>
  );
}

export default TestCard;
