import type { Workout, WorkoutStatus } from "../types";
import { formatDistance, formatPace } from "../utils";
import { formatCalendarDate, formatLocalDate } from "../../../utils/date";

interface WorkoutListProps {
  workouts: Workout[];
}

const statusLabels: Record<WorkoutStatus, string> = {
  planned: "Planned",
  completed: "Completed",
  skipped: "Skipped",
};

export function WorkoutList({ workouts }: WorkoutListProps) {
  const today = formatLocalDate(new Date());

  return (
    <section className="workouts-section" aria-labelledby="workouts-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">One run at a time</p>
          <h2 id="workouts-heading">Workouts</h2>
        </div>
        <span className="section-note">{workouts.length} {workouts.length === 1 ? "workout" : "workouts"} this week</span>
      </div>

      {workouts.length === 0 ? (
        <div className="panel empty-state">
          <p>No workouts planned this week</p>
          <p className="section-note">Your weekly mileage will appear above as you build your training history.</p>
        </div>
      ) : (
        <ul className="workout-list">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <article className={`workout-row${workout.date === today ? " is-today" : ""}`} aria-label={`${workout.title} on ${workout.date}`}>
                <time className="workout-date" dateTime={workout.date}>
                  <span>{formatCalendarDate(workout.date, { weekday: "short" })}</span>
                  <strong>{formatCalendarDate(workout.date, { month: "short", day: "numeric" })}</strong>
                </time>
                <div className="workout-info">
                  <div className="workout-title">
                    <h3>{workout.title}</h3>
                    <span className={`status status-${workout.status}`}>{statusLabels[workout.status]}</span>
                    {workout.date === today && <span className="today-label">Today</span>}
                  </div>
                  {workout.description && <p>{workout.description}</p>}
                </div>
                <dl className="workout-metrics">
                  <div><dt>Planned</dt><dd>{formatDistance(workout.planned_distance)}</dd></div>
                  <div><dt>Actual</dt><dd>{formatDistance(workout.distance)}</dd></div>
                  <div><dt>Avg. pace</dt><dd>{formatPace(workout.avg_pace_seconds)}</dd></div>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
