import { useEffect, useId, useRef, useState } from "react";

import type { MileageTrendPoint } from "../types";
import { formatDistance } from "../utils";
import { formatCalendarDate } from "../../../utils/date";

interface MileageTrendProps {
  points: MileageTrendPoint[];
  isLoading: boolean;
  error: string | null;
  isLatestWindow: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

const height = 290;
const plot = { left: 44, right: 24, top: 20, bottom: 46 };
const tooltip = { width: 92, height: 46, gap: 9 };

function formatChange(points: MileageTrendPoint[]): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (points.length < 2) return { text: "No comparison", tone: "neutral" };

  const previous = points[points.length - 2].actual_distance;
  const latest = points[points.length - 1].actual_distance;
  const delta = latest - previous;
  if (delta === 0) return { text: "No change", tone: "neutral" };

  const sign = delta > 0 ? "+" : "−";
  const absolute = `${sign}${Math.abs(delta).toFixed(2)} mi`;
  if (previous === 0) return { text: absolute, tone: delta > 0 ? "positive" : "negative" };

  const percentage = (delta / previous) * 100;
  const percentageSign = percentage > 0 ? "+" : "−";
  return {
    text: `${absolute} · ${percentageSign}${Math.abs(Math.round(percentage))}%`,
    tone: delta > 0 ? "positive" : "negative",
  };
}

export function MileageTrend({ points, isLoading, error, isLatestWindow, onPrevious, onNext }: MileageTrendProps) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [focusedPoint, setFocusedPoint] = useState<number | null>(null);
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
  const maxDistance = Math.max(0, ...points.map((point) => point.actual_distance));
  const tickStep = Math.max(1, Math.ceil(maxDistance / 20) * 5);
  const ceiling = tickStep * 4;
  const baseline = height - plot.bottom;
  const x = (index: number) => plot.left
    + (index / Math.max(1, points.length - 1)) * (width - plot.left - plot.right);
  const y = (distance: number) => baseline - (distance / ceiling) * (baseline - plot.top);
  const actual = points.map((point, index) => `${x(index)},${y(point.actual_distance)}`).join(" ");
  const comparison = formatChange(points);
  const activePointIndex = hoveredPoint ?? focusedPoint;
  const activePoint = activePointIndex === null ? null : points[activePointIndex];
  const activeX = activePointIndex === null ? 0 : x(activePointIndex);
  const activeY = activePoint ? y(activePoint.actual_distance) : 0;
  const tooltipX = activeX + tooltip.gap + tooltip.width > width - plot.right
    ? activeX - tooltip.width - tooltip.gap
    : activeX + tooltip.gap;
  const tooltipY = Math.max(plot.top + 4, activeY - tooltip.height - tooltip.gap);

  return (
    <section className="panel trend-panel" aria-labelledby={`${id}-heading`}>
      <div className="section-heading trend-heading">
        <h2 id={`${id}-heading`}>Weekly Mileage Trend</h2>
        <div className="trend-header-actions">
          {points.length >= 2 && <span className={`trend-comparison ${comparison.tone}`} aria-label="Week-over-week mileage change">{comparison.text}</span>}
          <div className="trend-navigation" aria-label="Mileage trend navigation">
            <button className="navigation-button" type="button" aria-label="Previous 12-week trend window" disabled={isLoading} onClick={onPrevious}>‹</button>
            <button className="navigation-button" type="button" aria-label="Next 12-week trend window" disabled={isLoading || isLatestWindow} onClick={onNext}>›</button>
          </div>
        </div>
      </div>

      <div className="trend-navigation-feedback" aria-live="polite">
        {isLoading && <span className="sr-only" role="status">Updating mileage trend</span>}
        {!isLoading && error && <span className="navigation-status error" role="alert">{error}</span>}
      </div>

      {points.length === 0 ? <p className="empty-state">No mileage history yet.</p> : (
        <div className="chart-container" ref={container}>
          <svg className="mileage-chart" viewBox={`0 0 ${width} ${height}`} role="group" aria-labelledby={`${id}-title ${id}-description`}>
            <title id={`${id}-title`}>Actual weekly mileage</title>
            <desc id={`${id}-description`}>
              {points.length} weeks, from {points[0].week_start} to {points[points.length - 1].week_start}.
              Empty weeks are shown at zero. The latest week in this window is on the right.
              Focus or hover a point for its exact mileage.
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
            <polyline points={actual} className="chart-line actual" />
            {points.map((point, index) => {
              const dateLabel = formatCalendarDate(point.week_start, { month: "short", day: "numeric" });
              return (
                <g
                  key={point.week_start}
                  className="chart-point"
                  role="img"
                  tabIndex={0}
                  aria-label={`${dateLabel}: ${point.actual_distance.toFixed(2)} miles`}
                  onMouseEnter={() => setHoveredPoint(index)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onFocus={() => setFocusedPoint(index)}
                  onBlur={() => setFocusedPoint(null)}
                >
                  <circle cx={x(index)} cy={y(point.actual_distance)} r="10" className="chart-point-target" />
                  <circle cx={x(index)} cy={y(point.actual_distance)} r="4" className="chart-dot actual" />
                  {(index === points.length - 1 || (index % labelInterval === 0 && index < points.length - labelInterval)) && <text x={x(index)} y={baseline + 27} textAnchor="middle" className={index === points.length - 1 ? "chart-label current" : "chart-label"}>
                    {Number(point.week_start.slice(5, 7))}/{Number(point.week_start.slice(8, 10))}
                  </text>}
                </g>
              );
            })}
            {activePoint && (
              <g className="chart-tooltip" role="tooltip" aria-label={`${formatCalendarDate(activePoint.week_start, { month: "short", day: "numeric" })}, ${formatDistance(activePoint.actual_distance)}`}>
                <rect x={tooltipX} y={tooltipY} width={tooltip.width} height={tooltip.height} rx="6" />
                <text x={tooltipX + 10} y={tooltipY + 18} className="chart-tooltip-date">{formatCalendarDate(activePoint.week_start, { month: "short", day: "numeric" })}</text>
                <text x={tooltipX + 10} y={tooltipY + 36} className="chart-tooltip-value">{formatDistance(activePoint.actual_distance)}</text>
              </g>
            )}
          </svg>
        </div>
      )}
    </section>
  );
}
