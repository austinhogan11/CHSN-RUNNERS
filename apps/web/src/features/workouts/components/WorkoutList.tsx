import { useState } from "react";

import { mutationErrorMessage } from "../api";
import type {
  Workout,
  WorkoutCreate,
  WorkoutStatus,
  WorkoutType,
  WorkoutUpdate,
} from "../types";
import {
  calculateAveragePaceSeconds,
  formatDistance,
  formatDuration,
  formatPace,
} from "../utils";
import { formatCalendarDate, formatLocalDate, getWeekDates } from "../../../utils/date";
import { AddSessionForm, WorkoutEditor } from "./WorkoutForms";

interface WorkoutListProps {
  weekStart: string;
  workouts: Workout[];
  onCreate: (workout: WorkoutCreate) => Promise<void>;
  onUpdate: (workoutId: string, changes: WorkoutUpdate) => Promise<void>;
  onDelete: (workoutId: string) => Promise<void>;
}

const statusLabels: Record<WorkoutStatus, string> = {
  planned: "Planned",
  completed: "Completed",
  skipped: "Skipped",
};

const typeLabels: Record<WorkoutType, string> = {
  run: "Run",
  rest: "Rest",
  strength: "Strength",
  cross_training: "Cross-training",
  other: "Other",
};

export function WorkoutList({
  weekStart,
  workouts,
  onCreate,
  onUpdate,
  onDelete,
}: WorkoutListProps) {
  const today = formatLocalDate(new Date());
  const workoutsByDate = new Map<string, Workout[]>();
  for (const workout of workouts) {
    const dayWorkouts = workoutsByDate.get(workout.date) ?? [];
    dayWorkouts.push(workout);
    workoutsByDate.set(workout.date, dayWorkouts);
  }

  return (
    <section className="workouts-section" aria-labelledby="workouts-heading">
      <div className="section-heading">
        <h2 id="workouts-heading">Workouts</h2>
        <span className="section-note">
          {workouts.length} {workouts.length === 1 ? "workout" : "workouts"} this week
        </span>
      </div>

      <ul className="workout-list">
        {getWeekDates(weekStart).map((day) => {
          const dayWorkouts = workoutsByDate.get(day) ?? [];
          const isToday = day === today;

          return (
            <li className={`workout-day${isToday ? " is-today" : ""}`} key={day}>
              <WorkoutDate day={day} isToday={isToday} />
              <div className="day-sessions">
                {dayWorkouts.length === 0 && (
                  <article className="session-row rest-row" aria-label={`Rest on ${day}`}>
                    <div className="workout-info">
                      <div className="workout-title">
                        <h3>Rest</h3>
                      </div>
                    </div>
                  </article>
                )}

                {dayWorkouts.map((workout) => (
                  <WorkoutSession
                    key={workout.id}
                    workout={workout}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}

                <AddSessionForm day={day} onCreate={onCreate} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface WorkoutSessionProps {
  workout: Workout;
  onUpdate: (workoutId: string, changes: WorkoutUpdate) => Promise<void>;
  onDelete: (workoutId: string) => Promise<void>;
}

function WorkoutSession({ workout, onUpdate, onDelete }: WorkoutSessionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const title = workout.title ?? typeLabels[workout.type];

  if (isEditing) {
    return (
      <article className="session-row editing-row" aria-label={`Edit ${title} on ${workout.date}`}>
        <WorkoutEditor
          workout={workout}
          onCancel={() => setIsEditing(false)}
          onSave={async (changes) => {
            await onUpdate(workout.id, changes);
            setIsEditing(false);
          }}
        />
      </article>
    );
  }

  async function handleDelete(): Promise<void> {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(workout.id);
    } catch (error) {
      setDeleteError(mutationErrorMessage(error));
      setIsDeleting(false);
    }
  }

  return (
    <article className="session-row" aria-label={`${title} on ${workout.date}`}>
      <div className="workout-info">
        <div className="workout-title">
          <h3>{title}</h3>
          {workout.title && <span className="workout-type">{typeLabels[workout.type]}</span>}
          <span className={`status status-${workout.status}`}>{statusLabels[workout.status]}</span>
        </div>
        {workout.description && <p>{workout.description}</p>}
        {workout.start_time && (
          <p className="session-start">Start {workout.start_time.slice(0, 5)}</p>
        )}
      </div>

      <dl className="workout-metrics">
        <div><dt>Planned</dt><dd>{formatDistance(workout.planned_distance)}</dd></div>
        <div><dt>Actual</dt><dd>{formatDistance(workout.distance)}</dd></div>
        <div><dt>Duration</dt><dd>{formatDuration(workout.duration_seconds)}</dd></div>
        <div>
          <dt>Avg. pace</dt>
          <dd>{formatPace(calculateAveragePaceSeconds(workout.duration_seconds, workout.distance))}</dd>
        </div>
      </dl>

      <div className="session-actions">
        {!confirmingDelete ? (
          <>
            <button className="text-button" type="button" onClick={() => setIsEditing(true)}>
              Edit
            </button>
            <button
              className="text-button danger-button"
              type="button"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          </>
        ) : (
          <div className="delete-confirmation" role="group" aria-label={`Delete ${title}`}>
            <span>Delete this session?</span>
            <button
              className="text-button danger-button"
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting..." : "Confirm delete"}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep session
            </button>
          </div>
        )}
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
      </div>
    </article>
  );
}

function WorkoutDate({ day, isToday }: { day: string; isToday: boolean }) {
  return (
    <div className="day-heading">
      <time className="workout-date" dateTime={day}>
        <span>{formatCalendarDate(day, { weekday: "short" })}</span>
        <strong>{formatCalendarDate(day, { month: "short", day: "numeric" })}</strong>
      </time>
      {isToday && <span className="today-label">Today</span>}
    </div>
  );
}
