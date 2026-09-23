import { useState } from "react";

import { mutationErrorMessage } from "../api";
import type { Workout, WorkoutCreate, WorkoutUpdate } from "../types";
import {
  calculateAveragePaceSeconds,
  formatDistance,
  formatDuration,
  formatPace,
  hasActualExecution,
  parseDurationInput,
} from "../utils";
import { formatCalendarDate, formatLocalDate, getWeekDates } from "../../../utils/date";
import { AddSessionForm } from "./WorkoutForms";
import { InlineInputField } from "./InlineWorkoutFields";

interface WorkoutListProps {
  weekStart: string;
  workouts: Workout[];
  onCreate: (workout: WorkoutCreate) => Promise<void>;
  onUpdate: (workoutId: string, changes: WorkoutUpdate) => Promise<void>;
  onDelete: (workoutId: string) => Promise<void>;
}

export function WorkoutList({ weekStart, workouts, onCreate, onUpdate, onDelete }: WorkoutListProps) {
  const today = formatLocalDate(new Date());
  const weekDates = getWeekDates(weekStart);
  const [selectedDay, setSelectedDay] = useState(() => (
    weekDates.includes(today) ? today : weekDates[0]
  ));
  const workoutsByDate = new Map<string, Workout[]>();
  for (const workout of workouts) {
    const dayWorkouts = workoutsByDate.get(workout.date) ?? [];
    dayWorkouts.push(workout);
    workoutsByDate.set(workout.date, dayWorkouts);
  }
  const selectedWorkouts = workoutsByDate.get(selectedDay) ?? [];
  const selectedMileage = dayMileage(selectedWorkouts);

  return (
    <section className="workouts-section" aria-labelledby="workouts-heading">
      <div className="section-heading">
        <h2 id="workouts-heading">Workouts</h2>
        <span className="section-note">
          {workouts.length} {workouts.length === 1 ? "workout" : "workouts"} this week
        </span>
      </div>

      <ul className="week-overview" aria-label="Week overview">
        {weekDates.map((day) => {
          const dayWorkouts = workoutsByDate.get(day) ?? [];
          const isToday = day === today;
          return (
            <li key={day}>
              <button
                className={`overview-day${isToday ? " is-today" : ""}`}
                type="button"
                aria-label={`Select ${formatCalendarDate(day, { weekday: "long", month: "short", day: "numeric" })}${isToday ? ", today" : ""}`}
                aria-pressed={selectedDay === day}
                onClick={() => setSelectedDay(day)}
              >
                <span className="overview-weekday">{formatCalendarDate(day, { weekday: "short" })}</span>
                <strong>{formatCalendarDate(day, { month: "short", day: "numeric" })}</strong>
                <span className="overview-mileage">{dayWorkouts.length === 0 ? "—" : formatDistance(dayMileage(dayWorkouts))}</span>
                {isToday && <span className="today-label">Today</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <section className="selected-day-panel panel" aria-labelledby="selected-day-heading">
        <div className="selected-day-header">
          <div className="selected-day-title">
            <h3 id="selected-day-heading">{formatCalendarDate(selectedDay, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</h3>
            {selectedDay === today && <span className="today-label">Today</span>}
          </div>
          {selectedWorkouts.length > 0 && (
            <span className="selected-day-summary">
              {formatDistance(selectedMileage)} · {selectedWorkouts.length} {selectedWorkouts.length === 1 ? "workout" : "workouts"}
            </span>
          )}
        </div>

        {selectedWorkouts.length > 0 ? (
          <div className="selected-day-sessions">
            <div className="session-table-header" aria-hidden="true">
              <span>Workout</span>
              <span>Distance</span>
              <span>Duration</span>
              <span>Pace</span>
              <span>Start</span>
              <span>Action</span>
            </div>
            {selectedWorkouts.map((workout) => (
              <WorkoutSession key={workout.id} workout={workout} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </div>
        ) : (
          <p className="selected-day-empty">No workouts yet.</p>
        )}
        <AddSessionForm day={selectedDay} onCreate={onCreate} />
      </section>
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
  const title = workout.title ?? (workout.type === "rest" ? "Rest" : "Workout");
  const displayTitle = workout.title ?? (workout.type === "rest" ? "Rest" : "Add title");
  const executed = hasActualExecution(workout);
  const visibleDistance = workout.distance ?? workout.planned_distance;

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
      <div className="workout-title-cell" title={title}>
        <InlineInputField
          label="Title"
          displayValue={displayTitle}
          editValue={workout.title ?? ""}
          parse={parseNullableText}
          onSave={(value) => onUpdate(workout.id, { title: value })}
          className={`editable-title${workout.title || workout.type === "rest" ? "" : " empty-value"}`}
        />
      </div>

      <div className="workout-metric workout-distance">
        <InlineInputField label="Distance" displayValue={formatDistance(visibleDistance)} editValue={numberInput(visibleDistance)} parse={parseNullableDistance} onSave={(value) => onUpdate(workout.id, executed ? { distance: value } : { planned_distance: value })} inputType="number" inputMode="decimal" min="0" step="any" unit="mi" />
      </div>
      <div className="workout-metric workout-duration">
        <InlineInputField label="Duration" displayValue={formatDuration(workout.duration_seconds)} editValue={durationInput(workout.duration_seconds)} parse={parseDurationInput} onSave={(value) => onUpdate(workout.id, { duration_seconds: value })} inputMode="numeric" placeholder="MM:SS" />
      </div>
      <div className="workout-metric workout-pace" aria-label="Average pace">
        {formatPace(calculateAveragePaceSeconds(workout.duration_seconds, workout.distance))}
      </div>
      <div className="workout-start">
        <InlineInputField label="Start time" displayValue={workout.start_time ? formatStartTime(workout.start_time) : "Add time"} editValue={workout.start_time ?? ""} parse={parseNullableText} onSave={(value) => onUpdate(workout.id, { start_time: value })} inputType="time" step="1" />
      </div>

      <div className={`session-actions${confirmingDelete ? " is-confirming" : ""}`}>
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

function dayMileage(workouts: Workout[]): number {
  return workouts.reduce((total, workout) => total + (workout.distance ?? workout.planned_distance ?? 0), 0);
}
