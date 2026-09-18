import type { Workout } from "../types";
import { formatDistance, formatPace } from "../utils";

interface WorkoutListProps {
  workouts: Workout[];
}

export function WorkoutList({ workouts }: WorkoutListProps) {
  return (
    <section>
      <h2>Workouts</h2>

      <div>
        {workouts.map((workout) => (
          <article key={workout.id}>
            <div>
              <strong>{workout.title}</strong>
              <span>{workout.date}</span>
            </div>

            {workout.description && <p>{workout.description}</p>}

            <div>
              <span>
                Planned: {formatDistance(workout.planned_distance)}
              </span>

              <span>
                Actual: {formatDistance(workout.distance)}
              </span>

              <span>
                Pace: {formatPace(workout.avg_pace_seconds)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}