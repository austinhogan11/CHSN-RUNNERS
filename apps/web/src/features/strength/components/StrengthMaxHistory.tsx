import { useState } from "react";

import { TimeSeriesLineChart } from "../../training/components/TimeSeriesLineChart";
import { formatLocalDate } from "../../../utils/date";
import type { StrengthMax } from "../types";

type HistoryRange = "ytd" | "1y" | "all";

interface StrengthMaxHistoryProps {
  exerciseKey: string;
  exerciseLabel: string;
  current: StrengthMax | undefined;
  history: StrengthMax[];
}

const ranges: Array<{ value: HistoryRange; label: string; ariaLabel: string }> = [
  { value: "ytd", label: "YTD", ariaLabel: "Year to date" },
  { value: "1y", label: "1Y", ariaLabel: "Trailing year" },
  { value: "all", label: "All", ariaLabel: "All history" },
];

export function StrengthMaxHistory({
  exerciseKey,
  exerciseLabel,
  current,
  history,
}: StrengthMaxHistoryProps) {
  const [range, setRange] = useState<HistoryRange>("ytd");
  const today = formatLocalDate(new Date());
  const points = filterMaxHistory(history, range, today);
  const domain = maxHistoryDomain(points, range, today);

  return (
    <section className="panel strength-max-history" aria-labelledby="strength-max-history-heading">
      <div className="strength-max-history-heading">
        <div>
          <h4 id="strength-max-history-heading">{exerciseLabel}</h4>
          <strong>{current ? `${formatPounds(current.value)} lb` : "No max set"}</strong>
        </div>
        <div className="strength-history-ranges" aria-label="Max history range">
          {ranges.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-label={option.ariaLabel}
              aria-pressed={range === option.value}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <p className="strength-history-empty">No max history in this range.</p>
      ) : (
        <TimeSeriesLineChart
          points={points.map((point) => ({
            id: point.id,
            date: point.effective_date,
            value: point.value,
          }))}
          ariaLabel={`${exerciseLabel} max history`}
          description={`${points.length} recorded ${exerciseKey} max ${points.length === 1 ? "entry" : "entries"}, sorted by effective date. Focus or hover a point for its exact value.`}
          formatValue={(value) => `${formatPounds(value)} lb`}
          formatAriaValue={(value) => `${formatPounds(value)} pounds`}
          xDomain={domain}
          connectFromBaseline={history.filter((record) => record.effective_date <= today).length === 1}
          height={210}
          className="strength-max-chart"
        />
      )}
    </section>
  );
}

function filterMaxHistory(
  history: StrengthMax[],
  range: HistoryRange,
  today: string,
): StrengthMax[] {
  const start = range === "ytd"
    ? calendarYearStart(today)
    : range === "1y"
      ? previousCalendarYear(today)
      : null;

  return history
    .filter((record) => (
      record.effective_date <= today
      && (range === "all" || record.effective_date >= (start ?? record.effective_date))
    ))
    .toSorted((left, right) => (
      left.effective_date.localeCompare(right.effective_date)
      || left.created_at.localeCompare(right.created_at)
    ));
}

function maxHistoryDomain(
  points: StrengthMax[],
  range: HistoryRange,
  today: string,
): { start: string; end: string } {
  if (range === "ytd") return { start: calendarYearStart(today), end: today };
  if (range === "1y") return { start: previousCalendarYear(today), end: today };

  const earliest = points[0]?.effective_date;
  const start = !earliest || points.length === 1 || earliest >= today
    ? calendarYearStart(earliest ?? today)
    : earliest;
  return { start, end: today };
}

function calendarYearStart(day: string): string {
  return `${day.slice(0, 4)}-01-01`;
}

function previousCalendarYear(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const lastDay = new Date(year - 1, month, 0).getDate();
  return formatLocalDate(new Date(year - 1, month - 1, Math.min(date, lastDay)));
}

function formatPounds(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
