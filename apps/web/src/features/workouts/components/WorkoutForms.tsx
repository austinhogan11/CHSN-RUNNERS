import { useId, useState } from "react";

import { mutationErrorMessage } from "../api";
import type {
  Workout,
  WorkoutCreate,
  WorkoutStatus,
  WorkoutType,
  WorkoutUpdate,
} from "../types";
import { formatDuration, parseDurationInput } from "../utils";

const workoutTypes: Array<{ value: WorkoutType; label: string }> = [
  { value: "run", label: "Run" },
  { value: "rest", label: "Rest" },
  { value: "strength", label: "Strength" },
  { value: "cross_training", label: "Cross-training" },
  { value: "other", label: "Other" },
];

const workoutStatuses: Array<{ value: WorkoutStatus; label: string }> = [
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
  { value: "skipped", label: "Skipped" },
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
  const [plannedDistance, setPlannedDistance] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setType("run");
    setTitle("");
    setPlannedDistance("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    let distance: number | undefined;
    try {
      distance = parseOptionalDistance(plannedDistance);
    } catch (validationError) {
      setError(getValidationMessage(validationError));
      return;
    }

    const workout: WorkoutCreate = { date: day };
    if (type !== "run") {
      workout.type = type;
    }
    if (title.trim()) {
      workout.title = title.trim();
    }
    if (distance !== undefined) {
      workout.planned_distance = distance;
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
      <button
        className="add-session-button"
        type="button"
        aria-label={`Add session on ${day}`}
        onClick={() => setIsOpen(true)}
      >
        + Add session
      </button>
    );
  }

  return (
    <form className="session-form add-session-form" onSubmit={handleSubmit}>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-type`}>Type</label>
        <select
          id={`${id}-type`}
          value={type}
          disabled={isSaving}
          onChange={(event) => setType(event.target.value as WorkoutType)}
        >
          {workoutTypes.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="form-field grow-field">
        <label htmlFor={`${id}-title`}>Title</label>
        <input
          id={`${id}-title`}
          value={title}
          disabled={isSaving}
          placeholder="Easy run"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-planned`}>Planned miles</label>
        <input
          id={`${id}-planned`}
          type="number"
          min="0"
          step="any"
          value={plannedDistance}
          disabled={isSaving}
          onChange={(event) => setPlannedDistance(event.target.value)}
        />
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? "Adding..." : "Add"}
        </button>
        <button
          className="text-button"
          type="button"
          disabled={isSaving}
          onClick={() => {
            reset();
            setIsOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
      {error && <p className="form-error form-wide" role="alert">{error}</p>}
    </form>
  );
}

interface WorkoutEditorProps {
  workout: Workout;
  onSave: (changes: WorkoutUpdate) => Promise<void>;
  onCancel: () => void;
}

export function WorkoutEditor({ workout, onSave, onCancel }: WorkoutEditorProps) {
  const id = useId();
  const [title, setTitle] = useState(workout.title ?? "");
  const [description, setDescription] = useState(workout.description ?? "");
  const [type, setType] = useState(workout.type);
  const [status, setStatus] = useState(workout.status);
  const [plannedDistance, setPlannedDistance] = useState(numberInput(workout.planned_distance));
  const [distance, setDistance] = useState(numberInput(workout.distance));
  const [duration, setDuration] = useState(durationInput(workout.duration_seconds));
  const [startTime, setStartTime] = useState(workout.start_time ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    let plannedValue: number | null;
    let distanceValue: number | null;
    let durationValue: number | null;
    try {
      plannedValue = parseNullableDistance(plannedDistance);
      distanceValue = parseNullableDistance(distance);
      durationValue = parseDurationInput(duration);
    } catch (validationError) {
      setError(getValidationMessage(validationError));
      return;
    }

    const changes: WorkoutUpdate = {};
    addChange(changes, "title", title.trim() || null, workout.title);
    addChange(changes, "description", description.trim() || null, workout.description);
    addChange(changes, "type", type, workout.type);
    addChange(changes, "status", status, workout.status);
    addChange(changes, "planned_distance", plannedValue, workout.planned_distance);
    addChange(changes, "distance", distanceValue, workout.distance);
    addChange(changes, "duration_seconds", durationValue, workout.duration_seconds);
    addChange(changes, "start_time", startTime || null, workout.start_time);

    if (Object.keys(changes).length === 0) {
      onCancel();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(changes);
    } catch (saveError) {
      setError(mutationErrorMessage(saveError));
      setIsSaving(false);
    }
  }

  return (
    <form className="session-form edit-session-form" onSubmit={handleSubmit}>
      <div className="form-field grow-field">
        <label htmlFor={`${id}-title`}>Title</label>
        <input id={`${id}-title`} value={title} disabled={isSaving} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-type`}>Type</label>
        <select id={`${id}-type`} value={type} disabled={isSaving} onChange={(event) => setType(event.target.value as WorkoutType)}>
          {workoutTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-status`}>Status</label>
        <select id={`${id}-status`} value={status} disabled={isSaving} onChange={(event) => setStatus(event.target.value as WorkoutStatus)}>
          {workoutStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-planned`}>Planned miles</label>
        <input id={`${id}-planned`} type="number" min="0" step="any" value={plannedDistance} disabled={isSaving} onChange={(event) => setPlannedDistance(event.target.value)} />
      </div>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-actual`}>Actual miles</label>
        <input id={`${id}-actual`} type="number" min="0" step="any" value={distance} disabled={isSaving} onChange={(event) => setDistance(event.target.value)} />
      </div>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-duration`}>Duration</label>
        <input id={`${id}-duration`} value={duration} disabled={isSaving} placeholder="MM:SS or HH:MM:SS" inputMode="numeric" onChange={(event) => setDuration(event.target.value)} />
      </div>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-start`}>Start time</label>
        <input id={`${id}-start`} type="time" step="1" value={startTime} disabled={isSaving} onChange={(event) => setStartTime(event.target.value)} />
      </div>
      <div className="form-field form-wide">
        <label htmlFor={`${id}-description`}>Description</label>
        <textarea id={`${id}-description`} rows={2} value={description} disabled={isSaving} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="form-actions form-wide">
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button className="text-button" type="button" disabled={isSaving} onClick={onCancel}>Cancel</button>
      </div>
      {error && <p className="form-error form-wide" role="alert">{error}</p>}
    </form>
  );
}

function addChange<Key extends keyof WorkoutUpdate>(
  changes: WorkoutUpdate,
  key: Key,
  value: WorkoutUpdate[Key],
  original: WorkoutUpdate[Key],
): void {
  if (value !== original) {
    changes[key] = value;
  }
}

function numberInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function durationInput(value: number | null): string {
  return value === null ? "" : formatDuration(value);
}

function parseOptionalDistance(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }
  return parseDistance(value);
}

function parseNullableDistance(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  return parseDistance(value);
}

function parseDistance(value: string): number {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance < 0) {
    throw new Error("Distance must be zero or greater");
  }
  return distance;
}

function getValidationMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Check the workout values";
}
