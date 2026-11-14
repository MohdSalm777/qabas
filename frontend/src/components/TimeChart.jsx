import { useRef, useState } from "react";

// A small single-series line chart drawn with SVG. No extra library needed.
// rows: [{ elapsed_s, igniter_on, [yKey]: number | null }, ...]

const W = 640;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 36, left: 52 };

function niceTicks(min, max, count = 4) {
  if (min === max) return [min];
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks;
}

function formatValue(value) {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function TimeChart({ rows, yKey, unit, label }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const points = rows.filter((r) => r[yKey] !== null && r[yKey] !== undefined);
  if (points.length < 2) {
    return <p className="message">No {label.toLowerCase()} data for this test.</p>;
  }

  const xMax = rows[rows.length - 1].elapsed_s;
  const values = points.map((r) => r[yKey]);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  const margin = (yMax - yMin) * 0.08 || 1;
  yMin = yMin >= 0 && yMin - margin < 0 ? 0 : yMin - margin;
  yMax = yMax + margin;

  const x = (t) => PAD.left + (t / xMax) * (W - PAD.left - PAD.right);
  const y = (v) => H - PAD.bottom - ((v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // Build the line, starting a new segment after every gap in the data.
  let path = "";
  let penDown = false;
  for (const r of rows) {
    const v = r[yKey];
    if (v === null || v === undefined) {
      penDown = false;
      continue;
    }
    path += `${penDown ? "L" : "M"}${x(r.elapsed_s).toFixed(1)},${y(v).toFixed(1)}`;
    penDown = true;
  }

  const igniterRows = rows.filter((r) => r.igniter_on === 1);
  const igniter =
    igniterRows.length > 0
      ? { start: igniterRows[0].elapsed_s, end: igniterRows[igniterRows.length - 1].elapsed_s }
      : null;

  function onMove(event) {
    const box = svgRef.current.getBoundingClientRect();
    const t = (((event.clientX - box.left) / box.width) * W - PAD.left) /
      (W - PAD.left - PAD.right) * xMax;
    let nearest = points[0];
    for (const p of points) {
      if (Math.abs(p.elapsed_s - t) < Math.abs(nearest.elapsed_s - t)) nearest = p;
    }
    setHover(nearest);
  }

  const tipLeft = hover ? (x(hover.elapsed_s) / W) * 100 : 0;

  return (
    <div className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label} over time`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {niceTicks(yMin, yMax).map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-tick" x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}

        {niceTicks(0, xMax, 5).map((tick) => (
          <text key={tick} className="chart-tick" x={x(tick)} y={H - PAD.bottom + 18} textAnchor="middle">
            {tick}
          </text>
        ))}
        <text className="chart-tick" x={W - PAD.right} y={H - 4} textAnchor="end">
          seconds since recording started
        </text>
        <text className="chart-tick" x={PAD.left} y={10} textAnchor="start">
          {unit}
        </text>

        {igniter && (
          <>
            <rect
              className="chart-igniter"
              x={x(igniter.start)}
              y={PAD.top}
              width={Math.max(x(igniter.end) - x(igniter.start), 2)}
              height={H - PAD.top - PAD.bottom}
            />
            <text className="chart-tick" x={x(igniter.end) + 6} y={PAD.top + 12}>
              igniter on
            </text>
          </>
        )}

        <path className="chart-line" d={path} />

        {hover && (
          <>
            <line
              className="chart-cross"
              x1={x(hover.elapsed_s)}
              x2={x(hover.elapsed_s)}
              y1={PAD.top}
              y2={H - PAD.bottom}
            />
            <circle className="chart-dot" cx={x(hover.elapsed_s)} cy={y(hover[yKey])} r="4.5" />
          </>
        )}
      </svg>

      {hover && (
        <div
          className="chart-tip"
          style={{ left: `${tipLeft}%`, transform: `translateX(${tipLeft > 60 ? "-110%" : "10%"})` }}
        >
          <strong>
            {formatValue(hover[yKey])} {unit}
          </strong>
          <span>at {hover.elapsed_s} s</span>
        </div>
      )}
    </div>
  );
}

export default TimeChart;