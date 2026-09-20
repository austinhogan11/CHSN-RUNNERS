import { useId, useState } from "react";

import { mutationErrorMessage } from "../api";
import type { WorkoutCreate, WorkoutType } from "../types";

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
    if (isSaving) return;

    let distance: number | undefined;
    try {
      distance = parseOptionalDistance(plannedDistance);
    } catch (validationError) {
      setError(validationMessage(validationError));
      return;
    }

    const workout: WorkoutCreate = { date: day };
    if (type !== "run") workout.type = type;
    if (title.trim()) workout.title = title.trim();
    if (distance !== undefined) workout.planned_distance = distance;

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
      <button className="add-session-button" type="button" aria-label={`Add session on ${day}`} onClick={() => setIsOpen(true)}>
        + Add session
      </button>
    );
  }

  return (
    <form className="session-form add-session-form" onSubmit={handleSubmit}>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-type`}>Type</label>
        <select id={`${id}-type`} value={type} disabled={isSaving} onChange={(event) => setType(event.target.value as WorkoutType)}>
          {workoutTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="form-field grow-field">
        <label htmlFor={`${id}-title`}>Title</label>
        <input id={`${id}-title`} value={title} disabled={isSaving} placeholder="Easy run" onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="form-field compact-field">
        <label htmlFor={`${id}-planned`}>Planned miles</label>
        <input id={`${id}-planned`} type="number" min="0" step="any" value={plannedDistance} disabled={isSaving} onChange={(event) => setPlannedDistance(event.target.value)} />
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Adding..." : "Add"}</button>
        <button className="text-button" type="button" disabled={isSaving} onClick={() => { reset(); setIsOpen(false); }}>Cancel</button>
      </div>
      {error && <p className="form-error form-wide" role="alert">{error}</p>}
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
