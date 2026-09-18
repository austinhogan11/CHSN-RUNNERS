import type { WeekSummary as WeekSummaryData } from "../types";
import { formatDistance } from "../utils";

interface WeekSummaryProps {
  summary: WeekSummaryData;
}

export function WeekSummary({ summary }: WeekSummaryProps) {
  return (
    <section>
      <h2>This Week</h2>

      <div>
        <div>
          <span>Planned</span>
          <strong>{formatDistance(summary.planned_distance)}</strong>
        </div>

        <div>
          <span>Actual</span>
          <strong>{formatDistance(summary.actual_distance)}</strong>
        </div>
      </div>
    </section>
  );
}