import { useEffect, useId, useRef, useState } from "react";

import { formatCalendarDate } from "../../../utils/date";

export interface TimeSeriesPoint {
  id: string;
  date: string;
  value: number;
}

interface TimeSeriesLineChartProps {
  points: TimeSeriesPoint[];
  ariaLabel: string;
  description: string;
  formatValue: (value: number) => string;
  formatAriaValue: (value: number) => string;
  xDomain?: { start: string; end: string };
  connectFromBaseline?: boolean;
  height?: number;
  className?: string;
}

const plot = { left: 44, right: 24, top: 20, bottom: 46 };
const tooltip = { width: 92, height: 46, gap: 9 };

export function TimeSeriesLineChart({
  points,
  ariaLabel,
  description,
  formatValue,
  formatAriaValue,
  xDomain,
  connectFromBaseline = false,
  height = 290,
  className = "",
}: TimeSeriesLineChartProps) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [focusedPoint, setFocusedPoint] = useState<number | null>(null);

  useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, entry.contentRect.width));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [points.length]);

  const labelInterval = width < 500 ? 3 : width < 700 ? 2 : 1;
  const maxValue = Math.max(0, ...points.map((point) => point.value));
  const tickStep = Math.max(1, Math.ceil(maxValue / 20) * 5);
  const ceiling = tickStep * 4;
  const baseline = height - plot.bottom;
  const domainStart = xDomain ? calendarDayNumber(xDomain.start) : null;
  const domainEnd = xDomain ? calendarDayNumber(xDomain.end) : null;
  const x = (point: TimeSeriesPoint, index: number) => {
    const ratio = domainStart !== null && domainEnd !== null && domainEnd > domainStart
      ? (calendarDayNumber(point.date) - domainStart) / (domainEnd - domainStart)
      : index / Math.max(1, points.length - 1);
    return plot.left + Math.min(1, Math.max(0, ratio)) * (width - plot.left - plot.right);
  };
  const y = (value: number) => baseline - (value / ceiling) * (baseline - plot.top);
  const line = points.map((point, index) => `${x(point, index)},${y(point.value)}`).join(" ");
  const renderedLine = connectFromBaseline ? `${plot.left},${baseline} ${line}` : line;
  const activePointIndex = hoveredPoint ?? focusedPoint;
  const activePoint = activePointIndex === null ? null : points[activePointIndex];
  const activeX = activePoint && activePointIndex !== null ? x(activePoint, activePointIndex) : 0;
  const activeY = activePoint ? y(activePoint.value) : 0;
  const tooltipX = activeX + tooltip.gap + tooltip.width > width - plot.right
    ? activeX - tooltip.width - tooltip.gap
    : activeX + tooltip.gap;
  const tooltipY = Math.max(plot.top + 4, activeY - tooltip.height - tooltip.gap);

  return (
    <div className="chart-container" ref={container}>
      <svg
        className={`time-series-chart ${className}`.trim()}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={ariaLabel}
        aria-describedby={`${id}-description`}
        data-domain-start={xDomain?.start}
        data-domain-end={xDomain?.end}
      >
        <desc id={`${id}-description`}>{description}</desc>
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
        <polygon points={`${connectFromBaseline ? plot.left : x(points[0], 0)},${baseline} ${line} ${x(points[points.length - 1], points.length - 1)},${baseline}`} fill={`url(#${id}-fill)`} />
        <polyline points={renderedLine} className="chart-line actual" />
        {points.map((point, index) => {
          const dateLabel = formatCalendarDate(point.date, { month: "short", day: "numeric" });
          return (
            <g
              key={point.id}
              className="chart-point"
              role="img"
              tabIndex={0}
              aria-label={`${dateLabel}: ${formatAriaValue(point.value)}`}
              onMouseEnter={() => setHoveredPoint(index)}
              onMouseLeave={() => setHoveredPoint(null)}
              onFocus={() => setFocusedPoint(index)}
              onBlur={() => setFocusedPoint(null)}
            >
              <circle cx={x(point, index)} cy={y(point.value)} r="10" className="chart-point-target" />
              <circle cx={x(point, index)} cy={y(point.value)} r="4" className="chart-dot actual" />
              {!xDomain && (index === points.length - 1 || (index % labelInterval === 0 && index < points.length - labelInterval)) && (
                <text x={x(point, index)} y={baseline + 27} textAnchor="middle" className={index === points.length - 1 ? "chart-label current" : "chart-label"}>
                  {Number(point.date.slice(5, 7))}/{Number(point.date.slice(8, 10))}
                </text>
              )}
            </g>
          );
        })}
        {xDomain && (
          <g aria-hidden="true">
            <text x={plot.left} y={baseline + 27} textAnchor="start" className="chart-label">
              {shortDate(xDomain.start)}
            </text>
            <text x={width - plot.right} y={baseline + 27} textAnchor="end" className="chart-label current">
              {shortDate(xDomain.end)}
            </text>
          </g>
        )}
        {activePoint && (
          <g
            className="chart-tooltip"
            role="tooltip"
            aria-label={`${formatCalendarDate(activePoint.date, { month: "short", day: "numeric" })}, ${formatValue(activePoint.value)}`}
          >
            <rect x={tooltipX} y={tooltipY} width={tooltip.width} height={tooltip.height} rx="6" />
            <text x={tooltipX + 10} y={tooltipY + 18} className="chart-tooltip-date">
              {formatCalendarDate(activePoint.date, { month: "short", day: "numeric" })}
            </text>
            <text x={tooltipX + 10} y={tooltipY + 36} className="chart-tooltip-value">
              {formatValue(activePoint.value)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function calendarDayNumber(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date) / 86_400_000;
}

function shortDate(day: string): string {
  return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
}
