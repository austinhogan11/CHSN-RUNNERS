import { useId } from "react";

import { TimeSeriesLineChart } from "../../training/components/TimeSeriesLineChart";
import type { MileageTrendPoint } from "../types";
import { formatDistance } from "../utils";

interface MileageTrendProps {
  points: MileageTrendPoint[];
  isLoading: boolean;
  error: string | null;
  isLatestWindow: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

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
  const comparison = formatChange(points);

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
        <TimeSeriesLineChart
          points={points.map((point) => ({
            id: point.week_start,
            date: point.week_start,
            value: point.actual_distance,
          }))}
          ariaLabel="Actual weekly mileage"
          description={`${points.length} weeks, from ${points[0].week_start} to ${points[points.length - 1].week_start}. Empty weeks are shown at zero. The latest week in this window is on the right. Focus or hover a point for its exact mileage.`}
          formatValue={formatDistance}
          formatAriaValue={(value) => `${value.toFixed(2)} miles`}
          className="mileage-chart"
        />
      )}
    </section>
  );
}
