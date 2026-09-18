import type { WeekSummary as WeekSummaryData } from "../types";
import { formatDistance } from "../utils";
import { formatCalendarDate } from "../../../utils/date";

interface WeekSummaryProps {
  summary: WeekSummaryData;
}

export function WeekSummary({ summary }: WeekSummaryProps) {
  return (
    <section className="panel week-summary" aria-labelledby="week-heading">
      <div>
        <p className="eyebrow">Your weekly snapshot</p>
        <h2 id="week-heading">This Week</h2>
        <p className="section-note">Week of <time dateTime={summary.week_start}>{formatCalendarDate(summary.week_start, { month: "short", day: "numeric", year: "numeric" })}</time></p>
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
