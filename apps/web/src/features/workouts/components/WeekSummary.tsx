import type { WeekSummary as WeekSummaryData } from "../types";
import { formatDistance } from "../utils";
import { formatWeekRange } from "../../../utils/date";

interface WeekSummaryProps {
  summary: WeekSummaryData;
  isCurrentWeek: boolean;
  isLoading: boolean;
  error: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onCurrent: () => void;
}

export function WeekSummary({ summary, isCurrentWeek, isLoading, error, onPrevious, onNext, onCurrent }: WeekSummaryProps) {
  return (
    <section className="panel week-summary" aria-labelledby="week-heading">
      <div className="week-summary-heading">
        <div className="week-title-controls">
          <button className="navigation-button" type="button" aria-label="Previous week" disabled={isLoading} onClick={onPrevious}>‹</button>
          <h2 id="week-heading">{isCurrentWeek ? "This Week" : "Week Summary"}</h2>
          <button className="navigation-button" type="button" aria-label="Next week" disabled={isLoading} onClick={onNext}>›</button>
        </div>
        <p className="section-note"><time dateTime={summary.week_start}>{formatWeekRange(summary.week_start)}</time></p>
        <div className="week-navigation-feedback" aria-live="polite">
          {!isCurrentWeek && <button className="current-week-button" type="button" disabled={isLoading} onClick={onCurrent}>Current week</button>}
          {isLoading && <span className="sr-only" role="status">Updating week</span>}
          {!isLoading && error && <span className="navigation-status error" role="alert">{error}</span>}
        </div>
      </div>
      <dl className="week-totals">
        <div>
          <dt>Planned mileage</dt>
          <dd>{formatDistance(summary.planned_distance)}</dd>
        </div>
        <div>
          <dt>Actual mileage</dt>
          <dd className="accent-text">{formatDistance(summary.actual_distance)}</dd>
        </div>
      </dl>
    </section>
  );
}
