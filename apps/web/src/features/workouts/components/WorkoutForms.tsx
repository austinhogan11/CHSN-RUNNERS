import { useId, useState } from "react";

import { mutationErrorMessage } from "../api";
import type { WorkoutCreate, WorkoutType } from "../types";
import { parseDurationInput } from "../utils";

const workoutTypes: Array<{ value: WorkoutType; label: string }> = [
  { value: "run", label: "Run" },
  { value: "rest", label: "Rest" },
  { value: "strength", label: "Strength" },
  { value: "cross_training", label: "Cross-training" },
  { value: "other", label: "Other" },
];

interface AddSessionFormProps {
  day: string;
  onCreate: (workout: WorkoutCreate) => Promise<void>;
}

export function AddSessionForm({ day, onCreate }: AddSessionFormProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<WorkoutType>("run");
  const [title, setTitle] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [startTime, setStartTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setType("run");
    setTitle("");
    setDistance("");
    setDuration("");
    setStartTime("");
    setError(null);
  }

  function open(): void {
    setStartTime(formatLocalClockTime(new Date()));
    setIsOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSaving) return;

    let parsedDistance: number | undefined;
    let durationSeconds: number | null;
    try {
      parsedDistance = parseOptionalDistance(distance);
      durationSeconds = parseDurationInput(duration);
    } catch (validationError) {
      setError(validationMessage(validationError));
      return;
    }

    const workout: WorkoutCreate = {
      date: day,
      start_time: startTime,
      distance: null,
      duration_seconds: null,
    };
    if (type !== "run") workout.type = type;
    if (title.trim()) workout.title = title.trim();
    if (parsedDistance !== undefined) workout.planned_distance = parsedDistance;
    if (durationSeconds !== null) {
      workout.duration_seconds = durationSeconds;
      if (parsedDistance !== undefined) workout.distance = parsedDistance;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onCreate(workout);
      reset();
      setIsOpen(false);
    } catch (saveError) {
      setError(mutationErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <button className="add-session-button" type="button" aria-label={`Add session on ${day}`} onClick={open}>
        + Add session
      </button>
    );
  }

  return (
    <form className="add-session-form" aria-label={`New session on ${day}`} onSubmit={handleSubmit}>
      <div className="add-type-field">
        <label className="sr-only" htmlFor={`${id}-type`}>Type</label>
        <select id={`${id}-type`} value={type} disabled={isSaving} onChange={(event) => setType(event.target.value as WorkoutType)}>
          {workoutTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="add-title-field">
        <label className="sr-only" htmlFor={`${id}-title`}>Title</label>
        <input id={`${id}-title`} value={title} disabled={isSaving} placeholder="Workout title..." onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="add-distance-field">
        <label className="sr-only" htmlFor={`${id}-distance`}>Distance</label>
        <input id={`${id}-distance`} type="number" inputMode="decimal" min="0" step="any" value={distance} disabled={isSaving} placeholder="5.0" onChange={(event) => setDistance(event.target.value)} />
        <span aria-hidden="true">mi</span>
      </div>
      <div className="add-duration-field">
        <label className="sr-only" htmlFor={`${id}-duration`}>Duration (optional)</label>
        <input id={`${id}-duration`} inputMode="numeric" value={duration} disabled={isSaving} placeholder="MM:SS optional" onChange={(event) => setDuration(event.target.value)} />
      </div>
      <button className="compact-add-button" type="submit" disabled={isSaving}>{isSaving ? "Adding..." : "Add"}</button>
      <button className="compact-cancel-button" type="button" aria-label="Cancel adding session" disabled={isSaving} onClick={() => { reset(); setIsOpen(false); }}>×</button>
      {error && <p className="form-error add-session-error" role="alert">{error}</p>}
    </form>
  );
}

function parseOptionalDistance(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance < 0) throw new Error("Distance must be zero or greater");
  return distance;
}

function validationMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Check the workout values";
}

function formatLocalClockTime(value: Date): string {
  return `${value.getHours().toString().padStart(2, "0")}:${value
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}
