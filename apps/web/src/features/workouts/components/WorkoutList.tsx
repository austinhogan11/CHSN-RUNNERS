import { useState } from "react";

import { mutationErrorMessage } from "../api";
import type { Workout, WorkoutCreate, WorkoutType, WorkoutUpdate } from "../types";
import {
  calculateAveragePaceSeconds,
  formatDistance,
  formatDuration,
  formatPace,
  parseDurationInput,
} from "../utils";
import { formatCalendarDate, formatLocalDate, getWeekDates } from "../../../utils/date";
import { AddSessionForm } from "./WorkoutForms";
import { InlineInputField, InlineSelectField } from "./InlineWorkoutFields";

interface WorkoutListProps {
  weekStart: string;
  workouts: Workout[];
  onCreate: (workout: WorkoutCreate) => Promise<void>;
  onUpdate: (workoutId: string, changes: WorkoutUpdate) => Promise<void>;
  onDelete: (workoutId: string) => Promise<void>;
}

const typeLabels: Record<WorkoutType, string> = {
  run: "Run",
  rest: "Rest",
  strength: "Strength",
  cross_training: "Cross-training",
  other: "Other",
};

const typeOptions = Object.entries(typeLabels).map(([value, label]) => ({
  value: value as WorkoutType,
  label,
}));

export function WorkoutList({ weekStart, workouts, onCreate, onUpdate, onDelete }: WorkoutListProps) {
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

      <div className="workout-table-header">
        <span>Date</span>
        <span>Type</span>
        <span>Title</span>
        <span>Description</span>
        <span>Start</span>
        <span>Duration</span>
        <span>Pace</span>
        <span>Planned</span>
        <span>Actual</span>
        <span className="workout-delete-heading">Delete</span>
      </div>
      <ul className="workout-list">
        {getWeekDates(weekStart).map((day) => {
          const dayWorkouts = workoutsByDate.get(day) ?? [];
          const isToday = day === today;
          return (
            <li className={`workout-day${isToday ? " is-today" : ""}`} key={day}>
              <WorkoutDate day={day} isToday={isToday} />
              <div className={`day-sessions${dayWorkouts.length === 0 ? " is-empty" : ""}`}>
                {dayWorkouts.length === 0 && (
                  <article className="session-row rest-row" aria-label={`Rest on ${day}`}>
                    <h3>Rest</h3>
                  </article>
                )}
                {dayWorkouts.map((workout) => (
                  <WorkoutSession key={workout.id} workout={workout} onUpdate={onUpdate} onDelete={onDelete} />
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const title = workout.title ?? typeLabels[workout.type];

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
      <InlineSelectField
        label="Type"
        value={workout.type}
        options={typeOptions}
        onSave={(value) => onUpdate(workout.id, { type: value })}
        className="workout-type editable-type"
      />

      <div className="workout-title-cell">
        <InlineInputField
          label="Title"
          displayValue={workout.title ?? "Add title"}
          editValue={workout.title ?? ""}
          parse={parseNullableText}
          onSave={(value) => onUpdate(workout.id, { title: value })}
          className={`editable-title${workout.title ? "" : " empty-value"}`}
        />
      </div>

      <div className="workout-description-cell">
        <InlineInputField
          label="Description"
          displayValue={workout.description ?? "Add note"}
          editValue={workout.description ?? ""}
          parse={parseNullableText}
          onSave={(value) => onUpdate(workout.id, { description: value })}
          className={`editable-note${workout.description ? "" : " empty-value"}`}
        />
      </div>

      <div className="workout-metric workout-start">
        <InlineInputField label="Start time" displayValue={formatStartTime(workout.start_time)} editValue={workout.start_time ?? ""} parse={parseNullableText} onSave={(value) => onUpdate(workout.id, { start_time: value })} inputType="time" step="1" />
      </div>
      <div className="workout-metric workout-duration">
        <InlineInputField label="Duration" displayValue={formatDuration(workout.duration_seconds)} editValue={durationInput(workout.duration_seconds)} parse={parseDurationInput} onSave={(value) => onUpdate(workout.id, { duration_seconds: value })} inputMode="numeric" placeholder="MM:SS" />
      </div>
      <div className="workout-metric workout-pace" aria-label="Average pace">
        {formatPace(calculateAveragePaceSeconds(workout.duration_seconds, workout.distance))}
      </div>
      <div className="workout-metric workout-planned">
        <InlineInputField label="Planned miles" displayValue={formatDistance(workout.planned_distance)} editValue={numberInput(workout.planned_distance)} parse={parseNullableDistance} onSave={(value) => onUpdate(workout.id, { planned_distance: value })} inputType="number" inputMode="decimal" min="0" step="any" unit="mi" />
      </div>
      <div className="workout-metric workout-actual">
        <InlineInputField label="Actual miles" displayValue={formatDistance(workout.distance)} editValue={numberInput(workout.distance)} parse={parseNullableDistance} onSave={(value) => onUpdate(workout.id, { distance: value })} inputType="number" inputMode="decimal" min="0" step="any" unit="mi" />
      </div>

      <div className="session-actions">
        {!confirmingDelete ? (
          <button className="delete-session-button" type="button" aria-label={`Delete ${title}`} onClick={() => setConfirmingDelete(true)}>×</button>
        ) : (
          <div className="delete-confirmation" role="group" aria-label={`Delete ${title}`} onKeyDown={(event) => {
            if (event.key === "Escape" && !isDeleting) setConfirmingDelete(false);
          }}>
            <span>Delete this session?</span>
            <button autoFocus className="text-button danger-button" type="button" disabled={isDeleting} onClick={handleDelete}>{isDeleting ? "Deleting..." : "Confirm"}</button>
            <button className="text-button" type="button" disabled={isDeleting} onClick={() => setConfirmingDelete(false)}>Cancel</button>
            {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
          </div>
        )}
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

function parseNullableText(value: string): string | null {
  return value.trim() || null;
}

function parseNullableDistance(value: string): number | null {
  if (value.trim() === "") return null;
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance < 0) throw new Error("Distance must be zero or greater");
  return distance;
}

function numberInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function durationInput(value: number | null): string {
  return value === null ? "" : formatDuration(value);
}

function formatStartTime(value: string | null): string {
  if (!value) return "—";
  const [hoursPart, minutes = "00"] = value.split(":");
  const hours = Number(hoursPart);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return value.slice(0, 5);
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}
