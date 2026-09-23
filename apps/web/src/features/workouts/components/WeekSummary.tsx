import type { WeekSummary as WeekSummaryData } from "../types";
import { formatDistance } from "../utils";
import { formatWeekRange } from "../../../utils/date";

interface WeekSummaryProps {
  summary: WeekSummaryData;
  isCurrentWeek: boolean;
}

export function WeekSummary({ summary, isCurrentWeek }: WeekSummaryProps) {
  return (
    <section className="panel week-summary" aria-labelledby="week-heading">
      <div>
        <h2 id="week-heading">{isCurrentWeek ? "This Week" : "Week Summary"}</h2>
        <p className="section-note"><time dateTime={summary.week_start}>{formatWeekRange(summary.week_start)}</time></p>
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
