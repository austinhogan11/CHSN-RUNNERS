import type { Workout, WorkoutStatus } from "../types";
import { formatDistance, formatPace } from "../utils";
import { formatCalendarDate, formatLocalDate, getWeekDates } from "../../../utils/date";

interface WorkoutListProps {
  weekStart: string;
  workouts: Workout[];
}

const statusLabels: Record<WorkoutStatus, string> = {
  planned: "Planned",
  completed: "Completed",
  skipped: "Skipped",
};

export function WorkoutList({ weekStart, workouts }: WorkoutListProps) {
  const today = formatLocalDate(new Date());
  const workoutsByDate = new Map<string, Workout[]>();
  for (const workout of workouts) {
    const dayWorkouts = workoutsByDate.get(workout.date) ?? [];
    dayWorkouts.push(workout);
    workoutsByDate.set(workout.date, dayWorkouts);
  }
  const days = getWeekDates(weekStart);

  return (
    <section className="workouts-section" aria-labelledby="workouts-heading">
      <div className="section-heading">
        <h2 id="workouts-heading">Workouts</h2>
        <span className="section-note">{workouts.length} {workouts.length === 1 ? "workout" : "workouts"} this week</span>
      </div>

      <ul className="workout-list">
        {days.flatMap((day) => {
          const dayWorkouts = workoutsByDate.get(day);

          if (!dayWorkouts) {
            return (
              <li key={day}>
                <article className={`workout-row rest-row${day === today ? " is-today" : ""}`} aria-label={`Rest on ${day}`}>
                  <WorkoutDate day={day} />
                  <div className="workout-info">
                    <div className="workout-title">
                      <h3>Rest</h3>
                      {day === today && <span className="today-label">Today</span>}
                    </div>
                  </div>
                </article>
              </li>
            );
          }

          return dayWorkouts.map((workout) => (
            <li key={workout.id}>
              <article className={`workout-row${workout.date === today ? " is-today" : ""}`} aria-label={`${workout.title} on ${workout.date}`}>
                <WorkoutDate day={workout.date} />
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
          ));
        })}
      </ul>
    </section>
  );
}

function WorkoutDate({ day }: { day: string }) {
  return (
    <time className="workout-date" dateTime={day}>
      <span>{formatCalendarDate(day, { weekday: "short" })}</span>
      <strong>{formatCalendarDate(day, { month: "short", day: "numeric" })}</strong>
    </time>
  );
}
