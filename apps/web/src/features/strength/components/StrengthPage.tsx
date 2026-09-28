import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { formatCalendarDate, formatLocalDate } from "../../../utils/date";
import {
  createExercise,
  getExercises,
  getStrengthMaxes,
  saveStrengthMax,
  strengthErrorMessage,
} from "../api";
import type {
  Exercise,
  ExerciseCreate,
  StrengthMax,
  StrengthMaxCollection,
} from "../types";

const REQUIRED_MAX_SOURCES = [
  ["bench_press", "Bench Press"],
  ["back_squat", "Back Squat"],
  ["front_squat", "Front Squat"],
  ["deadlift", "Deadlift"],
  ["power_clean", "Power Clean"],
  ["power_snatch", "Power Snatch"],
  ["overhead_press", "Overhead Press"],
] as const;

interface MaxSource {
  key: string;
  label: string;
}

export function StrengthPage() {
  const { getToken } = useAuth();
  const [maxes, setMaxes] = useState<StrengthMaxCollection | null>(null);
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStrengthData = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("No active Clerk session token");
    return Promise.all([
      getStrengthMaxes(token),
      getExercises(token),
    ]);
  }, [getToken]);

  const loadStrengthData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [maxData, exerciseData] = await fetchStrengthData();
      setMaxes(maxData);
      setExercises(exerciseData);
    } catch {
      setLoadError("Unable to load strength settings.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchStrengthData]);

  useEffect(() => {
    let isActive = true;
    fetchStrengthData()
      .then(([maxData, exerciseData]) => {
        if (!isActive) return;
        setMaxes(maxData);
        setExercises(exerciseData);
      })
      .catch(() => {
        if (isActive) setLoadError("Unable to load strength settings.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [fetchStrengthData]);

  if (isLoading) {
    return <p className="panel page-message" role="status">Loading strength...</p>;
  }

  if (loadError || !maxes || !exercises) {
    return (
      <section className="panel page-message strength-load-error" role="alert">
        <p>{loadError ?? "Unable to load strength settings."}</p>
        <button className="secondary-button" type="button" onClick={() => void loadStrengthData()}>
          Try again
        </button>
      </section>
    );
  }

  const maxSources = buildMaxSources(exercises);

  return (
    <div className="strength-page">
      <div className="strength-page-heading">
        <h2>Strength</h2>
      </div>
      <MaxesPanel
        maxes={maxes}
        maxSources={maxSources}
        getToken={getToken}
        onRefresh={setMaxes}
      />
      <ExerciseLibrary
        exercises={exercises}
        maxSources={maxSources}
        getToken={getToken}
        onRefresh={setExercises}
      />
    </div>
  );
}

interface MaxesPanelProps {
  maxes: StrengthMaxCollection;
  maxSources: MaxSource[];
  getToken: () => Promise<string | null>;
  onRefresh: (maxes: StrengthMaxCollection) => void;
}

function MaxesPanel({ maxes, maxSources, getToken, onRefresh }: MaxesPanelProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [isDateVisible, setIsDateVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const currentByKey = new Map(
    maxes.current.map((item) => [item.exercise_key, item]),
  );

  function beginEdit(source: MaxSource) {
    const current = currentByKey.get(source.key);
    setEditingKey(source.key);
    setValue(current ? String(current.value) : "");
    setEffectiveDate(formatLocalDate(new Date()));
    setIsDateVisible(false);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setSaveError(null);
    setIsDateVisible(false);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingKey) return;
    const numericValue = Number(value);
    if (!value.trim() || !Number.isFinite(numericValue) || numericValue <= 0) {
      setSaveError("Enter a max greater than 0 pounds.");
      return;
    }
    if (!isValidDate(effectiveDate)) {
      setSaveError("Enter a valid effective date.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session token");
      await saveStrengthMax(
        editingKey,
        { value: numericValue, effective_date: effectiveDate },
        token,
      );
      onRefresh(await getStrengthMaxes(token));
      setEditingKey(null);
    } catch (error) {
      setSaveError(strengthErrorMessage(error, "max"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="strength-section" aria-labelledby="maxes-heading">
      <div className="section-heading">
        <h3 id="maxes-heading">Maxes</h3>
        <span className="section-note">Pounds</span>
      </div>
      <div className="strength-max-grid">
        {maxSources.map((source) => {
          const current = currentByKey.get(source.key);
          const history = maxes.history
            .filter((item) => item.exercise_key === source.key)
            .toSorted((left, right) => right.effective_date.localeCompare(left.effective_date));
          const isEditing = editingKey === source.key;
          return (
            <article className="strength-max-card" key={source.key}>
              <div className="strength-max-summary">
                <h4>{source.label}</h4>
                <div className="strength-max-control">
                  {isEditing ? (
                    <form
                      className="strength-max-inline-form"
                      onSubmit={handleSave}
                      noValidate
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelEdit();
                        } else if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.requestSubmit();
                        }
                      }}
                    >
                      <div className="strength-max-inline-controls">
                        <input
                          aria-label={`${source.label} max`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={value}
                          onChange={(event) => setValue(event.target.value)}
                          onFocus={(event) => event.currentTarget.select()}
                          disabled={isSaving}
                          autoFocus
                          required
                        />
                        <span>lb</span>
                        <button className="compact-add-button" type="submit" disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="compact-cancel-button"
                          type="button"
                          disabled={isSaving}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                        <button
                          className="strength-max-date-toggle"
                          type="button"
                          onClick={() => setIsDateVisible(true)}
                        >
                          Date
                        </button>
                      </div>
                      {isDateVisible && (
                        <label className="strength-max-date">
                          <span>Effective date</span>
                          <input
                            type="date"
                            value={effectiveDate}
                            onChange={(event) => setEffectiveDate(event.target.value)}
                            disabled={isSaving}
                            required
                          />
                        </label>
                      )}
                      {saveError && <p className="form-error" role="alert">{saveError}</p>}
                    </form>
                  ) : (
                    <button
                      className={current ? "strength-max-value" : "strength-max-empty"}
                      type="button"
                      onClick={() => beginEdit(source)}
                    >
                      {current ? `${formatPounds(current.value)} lb` : "Add max"}
                    </button>
                  )}
                  {history.length > 0 && (
                    <details className="max-history">
                      <summary>History</summary>
                      <ul>
                        {history.map((item) => (
                          <li key={item.id}>
                            <time dateTime={item.effective_date}>{formatHistoryDate(item)}</time>
                            <strong>{formatPounds(item.value)} lb</strong>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

interface ExerciseLibraryProps {
  exercises: Exercise[];
  maxSources: MaxSource[];
  getToken: () => Promise<string | null>;
  onRefresh: (exercises: Exercise[]) => void;
}

function ExerciseLibrary({
  exercises,
  maxSources,
  getToken,
  onRefresh,
}: ExerciseLibraryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [defaultMaxSource, setDefaultMaxSource] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const maxLabels = useMemo(
    () => new Map(maxSources.map((source) => [source.key, source.label])),
    [maxSources],
  );
  const filteredExercises = exercises.filter((exercise) =>
    exercise.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    if (!trimmedName || !trimmedCategory) {
      setSaveError("Enter an exercise name and category.");
      return;
    }

    const payload: ExerciseCreate = {
      name: trimmedName,
      category: trimmedCategory,
      default_max_source: defaultMaxSource || null,
    };
    setIsSaving(true);
    setSaveError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session token");
      await createExercise(payload, token);
      onRefresh(await getExercises(token));
      setName("");
      setCategory("");
      setDefaultMaxSource("");
      setIsAdding(false);
    } catch (error) {
      setSaveError(strengthErrorMessage(error, "exercise"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="strength-section" aria-labelledby="exercise-library-heading">
      <button
        className="panel exercise-library-disclosure"
        type="button"
        aria-expanded={isExpanded}
        aria-controls="exercise-library-content"
        aria-label={`Exercise Library, ${exercises.length} ${exercises.length === 1 ? "exercise" : "exercises"}`}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span
          className="exercise-library-title"
          id="exercise-library-heading"
          role="heading"
          aria-level={3}
        >
          Exercise Library
        </span>
        <span>{exercises.length} {exercises.length === 1 ? "exercise" : "exercises"}</span>
        <span className="disclosure-icon" aria-hidden="true">⌄</span>
      </button>

      {isExpanded && (
        <div className="exercise-library-content" id="exercise-library-content">
          <div className="exercise-library-toolbar">
            <label className="exercise-search">
              <span className="sr-only">Search exercises</span>
              <input
                type="search"
                placeholder="Search exercises"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button className="primary-button" type="button" onClick={() => setIsAdding(true)}>
              Add Exercise
            </button>
          </div>

          {isAdding && (
            <form className="panel exercise-form" onSubmit={handleCreate}>
              <label>
                <span>Exercise name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving} required />
              </label>
              <label>
                <span>Category</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} disabled={isSaving} required />
              </label>
              <label>
                <span>Default max source</span>
                <select
                  value={defaultMaxSource}
                  onChange={(event) => setDefaultMaxSource(event.target.value)}
                  disabled={isSaving}
                >
                  <option value="">None</option>
                  {maxSources.map((source) => (
                    <option value={source.key} key={source.key}>{source.label}</option>
                  ))}
                </select>
              </label>
              {saveError && <p className="form-error" role="alert">{saveError}</p>}
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isSaving}>
                  {isSaving ? "Adding..." : "Add exercise"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {filteredExercises.length > 0 ? (
            <div className="panel exercise-table">
              <div className="exercise-list-header" aria-hidden="true">
                <span>Exercise</span>
                <span>Category</span>
                <span>Max Source</span>
                <span>Type</span>
              </div>
              <ul className="exercise-list">
                {filteredExercises.map((exercise) => (
                  <li key={exercise.id}>
                    <strong>{exercise.name}</strong>
                    <span className="exercise-category" data-label="Category">
                      {humanizeKey(exercise.category)}
                    </span>
                    <span className="exercise-max-source" data-label="Max source">
                      {exercise.default_max_source
                        ? maxLabels.get(exercise.default_max_source) ?? humanizeKey(exercise.default_max_source)
                        : "—"}
                    </span>
                    <span className="exercise-type" data-label="Type">
                      {exercise.is_custom ? "Custom" : "Built-in"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="panel empty-state">No exercises match your search.</p>
          )}
        </div>
      )}
    </section>
  );
}

function buildMaxSources(exercises: Exercise[]): MaxSource[] {
  const labels = new Map<string, string>(REQUIRED_MAX_SOURCES);
  const exerciseLabels = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  for (const exercise of exercises) {
    if (exercise.default_max_source) {
      labels.set(
        exercise.default_max_source,
        exerciseLabels.get(exercise.default_max_source) ?? humanizeKey(exercise.default_max_source),
      );
    }
  }
  return [...labels].map(([key, label]) => ({ key, label }));
}

function humanizeKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPounds(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatHistoryDate(item: StrengthMax): string {
  return formatCalendarDate(item.effective_date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}
