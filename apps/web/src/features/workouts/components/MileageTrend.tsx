import { useEffect, useId, useRef, useState } from "react";

import type { MileageTrendPoint } from "../types";
import { formatDistance } from "../utils";

interface MileageTrendProps {
  points: MileageTrendPoint[];
}

const height = 290;
const plot = { left: 44, right: 24, top: 20, bottom: 46 };

export function MileageTrend({ points }: MileageTrendProps) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const hasPoints = points.length > 0;

  useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, entry.contentRect.width));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [hasPoints]);

  const labelInterval = width < 500 ? 3 : width < 700 ? 2 : 1;
  const maxDistance = Math.max(0, ...points.flatMap((point) => [
    point.planned_distance,
    point.actual_distance,
  ]));
  const tickStep = Math.max(1, Math.ceil(maxDistance / 20) * 5);
  const ceiling = tickStep * 4;
  const baseline = height - plot.bottom;
  const x = (index: number) => plot.left
    + (index / Math.max(1, points.length - 1)) * (width - plot.left - plot.right);
  const y = (distance: number) => baseline - (distance / ceiling) * (baseline - plot.top);
  const planned = points.map((point, index) => `${x(index)},${y(point.planned_distance)}`).join(" ");
  const actual = points.map((point, index) => `${x(index)},${y(point.actual_distance)}`).join(" ");

  return (
    <section className="panel trend-panel" aria-labelledby={`${id}-heading`}>
      <div className="section-heading">
        <h2 id={`${id}-heading`}>Weekly Mileage Trend</h2>
        <span className="section-note">Last {points.length} weeks · miles</span>
      </div>

      <div className="chart-legend" aria-label="Chart legend">
        <span><i className="legend-line planned" aria-hidden="true" />Planned</span>
        <span><i className="legend-line actual" aria-hidden="true" />Actual</span>
      </div>

      {points.length === 0 ? <p className="empty-state">No mileage history yet.</p> : (
        <>
          <div className="chart-container" ref={container}>
            <svg className="mileage-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
              <title id={`${id}-title`}>Planned and actual weekly mileage</title>
              <desc id={`${id}-description`}>
                {points.length} weeks, from {points[0].week_start} to {points[points.length - 1].week_start}.
                Empty weeks are shown at zero. The current week is on the right.
                Exact values are available in View weekly data below.
              </desc>
              <defs>
                <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((tick) => (
                <g key={tick} className="chart-grid">
                  <line x1={plot.left} y1={y(tick * tickStep)} x2={width - plot.right} y2={y(tick * tickStep)} />
                  <text x={plot.left - 14} y={y(tick * tickStep) + 4} textAnchor="end">{tick * tickStep}</text>
                </g>
              ))}
              <polygon points={`${x(0)},${baseline} ${actual} ${x(points.length - 1)},${baseline}`} fill={`url(#${id}-fill)`} />
              <polyline points={planned} className="chart-line planned" />
              <polyline points={actual} className="chart-line actual" />
              {points.map((point, index) => (
                <g key={point.week_start}>
                  <title>{`Week of ${point.week_start}: planned ${formatDistance(point.planned_distance)}, actual ${formatDistance(point.actual_distance)}`}</title>
                  <circle cx={x(index)} cy={y(point.planned_distance)} r="4" className="chart-dot planned" />
                  <circle cx={x(index)} cy={y(point.actual_distance)} r="4" className="chart-dot actual" />
                  {(index === points.length - 1 || (index % labelInterval === 0 && index < points.length - labelInterval)) && <text x={x(index)} y={baseline + 27} textAnchor="middle" className={index === points.length - 1 ? "chart-label current" : "chart-label"}>
                    {Number(point.week_start.slice(5, 7))}/{Number(point.week_start.slice(8, 10))}
                  </text>}
                </g>
              ))}
            </svg>
          </div>
          <div className="chart-footer">
            <span>Week starting Monday</span>
          </div>
          <details className="chart-data">
            <summary>View weekly data</summary>
            <table>
              <caption className="sr-only">Weekly mileage in miles</caption>
              <thead><tr><th scope="col">Week starting</th><th scope="col">Planned</th><th scope="col">Actual</th></tr></thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.week_start}>
                    <th scope="row"><time dateTime={point.week_start}>{point.week_start}</time></th>
                    <td>{formatDistance(point.planned_distance)}</td>
                    <td>{formatDistance(point.actual_distance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
