import type { MileageTrendPoint } from "../types";
import { formatDistance } from "../utils";

interface MileageTrendProps {
  points: MileageTrendPoint[];
}

export function MileageTrend({ points }: MileageTrendProps) {
  return (
    <section>
      <h2>Weekly Mileage Trend</h2>

      <div>
        {points.map((point) => (
          <article key={point.week_start}>
            <strong>{point.week_start}</strong>

            <div>
              <span>
                Planned: {formatDistance(point.planned_distance)}
              </span>

              <span>
                Actual: {formatDistance(point.actual_distance)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}