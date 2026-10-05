import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useWeekNavigation } from "../../training/useWeekNavigation";
import { formatLocalDate, getMondayWeekStart } from "../../../utils/date";
import {
  createExercise,
  createStrengthSession,
  deleteStrengthSession,
  getExercises,
  getStrengthMaxes,
  getStrengthPrograms,
  getStrengthProgramInstances,
  getStrengthSession,
  getStrengthWeek,
  saveStrengthMax,
  scheduleStrengthProgram,
  strengthErrorMessage,
  updateStrengthSession,
} from "../api";
import type {
  Exercise,
  ExerciseCreate,
  StrengthMaxCollection,
  StrengthProgram,
  StrengthProgramInstanceSummary,
  StrengthProgramSchedule,
  StrengthSessionCreate,
  StrengthSessionUpdate,
  StrengthWeek,
} from "../types";
import { StrengthWeekDashboard } from "./StrengthWeekDashboard";
import type { MaxSourceOption } from "./StrengthWeekDashboard";
import { StrengthMaxHistory } from "./StrengthMaxHistory";

const REQUIRED_MAX_SOURCES = [
  ["bench_press", "Bench Press"],
  ["back_squat", "Back Squat"],
  ["front_squat", "Front Squat"],
  ["deadlift", "Deadlift"],
  ["power_clean", "Power Clean"],
  ["power_snatch", "Power Snatch"],
  ["overhead_press", "Overhead Press"],
] as const;

const BIG_THREE_MAX_SOURCES = [
  ["bench_press", "Bench Press"],
  ["back_squat", "Back Squat"],
  ["deadlift", "Deadlift"],
] as const;

export function StrengthPage() {
  const { getToken } = useAuth();
  const [maxes, setMaxes] = useState<StrengthMaxCollection | null>(null);
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [programs, setPrograms] = useState<StrengthProgram[] | null>(null);
  const [programInstances, setProgramInstances] = useState<StrengthProgramInstanceSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const currentWeekStart = useMemo(() => getMondayWeekStart(today), [today]);

  const loadStrengthWeek = useCallback(async (weekStart: string): Promise<StrengthWeek> => {
    const token = await getToken();
    if (!token) throw new Error("No active Clerk session token");
    return getStrengthWeek(weekStart, token);
  }, [getToken]);
  const {
    week,
    setWeek,
    displayedWeekStart,
    isCurrentWeek,
    isWeekLoading,
    weekError,
    showPreviousWeek,
    showNextWeek,
    showCurrentWeek,
  } = useWeekNavigation({
    currentWeekStart,
    loadWeek: loadStrengthWeek,
    errorMessage: "Unable to load selected strength week.",
  });

  const fetchStrengthData = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("No active Clerk session token");
    return Promise.all([
      getStrengthMaxes(token),
      getExercises(token),
      getStrengthPrograms(token),
      getStrengthProgramInstances(token),
      getStrengthWeek(currentWeekStart, token),
    ]);
  }, [currentWeekStart, getToken]);

  const loadStrengthData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [maxData, exerciseData, programData, instanceData, weekData] = await fetchStrengthData();
      setMaxes(maxData);
      setExercises(exerciseData);
      setPrograms(programData);
      setProgramInstances(instanceData);
      setWeek(weekData);
    } catch {
      setLoadError("Unable to load strength dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchStrengthData, setWeek]);

  useEffect(() => {
    let isActive = true;
    fetchStrengthData()
      .then(([maxData, exerciseData, programData, instanceData, weekData]) => {
        if (!isActive) return;
        setMaxes(maxData);
        setExercises(exerciseData);
        setPrograms(programData);
        setProgramInstances(instanceData);
        setWeek(weekData);
      })
      .catch(() => {
        if (isActive) setLoadError("Unable to load strength dashboard.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [fetchStrengthData, setWeek]);

  if (isLoading) {
    return <p className="panel page-message" role="status">Loading strength...</p>;
  }

  if (loadError || !maxes || !exercises || !programs || !programInstances || !week) {
    return (
      <section className="panel page-message strength-load-error" role="alert">
        <p>{loadError ?? "Unable to load strength dashboard."}</p>
        <button className="secondary-button" type="button" onClick={() => void loadStrengthData()}>
          Try again
        </button>
      </section>
    );
  }

  const maxSources = buildMaxSources(exercises);

  async function requireToken(): Promise<string> {
    const token = await getToken();
    if (!token) throw new Error("No active Clerk session token");
    return token;
  }

  async function refreshWeek(token: string): Promise<StrengthWeek> {
    const refreshed = await getStrengthWeek(displayedWeekStart, token);
    setWeek(refreshed);
    return refreshed;
  }

  async function handleCreateSession(payload: StrengthSessionCreate) {
    const token = await requireToken();
    const created = await createStrengthSession(payload, token);
    await refreshWeek(token);
    return created;
  }

  async function handleScheduleProgram(
    programId: string,
    payload: StrengthProgramSchedule,
  ) {
    const token = await requireToken();
    const created = await scheduleStrengthProgram(programId, payload, token);
    setProgramInstances(await getStrengthProgramInstances(token));
    await refreshWeek(token);
    return created;
  }

  async function handleUpdateSession(sessionId: string, payload: StrengthSessionUpdate) {
    const token = await requireToken();
    const updated = await updateStrengthSession(sessionId, payload, token);
    const refreshed = await refreshWeek(token);
    return refreshed.sessions.find((session) => session.id === sessionId) ?? updated;
  }

  async function handleReloadSession(sessionId: string) {
    return getStrengthSession(sessionId, await requireToken());
  }

  async function handleDeleteSession(sessionId: string) {
    const token = await requireToken();
    await deleteStrengthSession(sessionId, token);
    await refreshWeek(token);
  }

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
      <StrengthWeekDashboard
        week={week}
        exercises={exercises}
        maxSources={maxSources}
        maxHistory={maxes.history}
        programs={programs}
        programInstances={programInstances}
        isCurrentWeek={isCurrentWeek}
        isWeekLoading={isWeekLoading}
        weekError={weekError}
        onPreviousWeek={showPreviousWeek}
        onNextWeek={showNextWeek}
        onCurrentWeek={showCurrentWeek}
        onCreate={handleCreateSession}
        onScheduleProgram={handleScheduleProgram}
        onUpdate={handleUpdateSession}
        onReload={handleReloadSession}
        onDelete={handleDeleteSession}
      />
    </div>
  );
}

interface MaxesPanelProps {
  maxes: StrengthMaxCollection;
  maxSources: MaxSourceOption[];
  getToken: () => Promise<string | null>;
  onRefresh: (maxes: StrengthMaxCollection) => void;
}

function MaxesPanel({ maxes, maxSources, getToken, onRefresh }: MaxesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedKey, setSelectedKey] = useState(() => defaultMaxSource(maxes, maxSources));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saveError, setSaveError] = useState<{ key: string; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const skipBlur = useRef(false);
  const saveInFlight = useRef(false);
  const currentByKey = new Map(
    maxes.current.map((item) => [item.exercise_key, item]),
  );
  const selectedSource = maxSources.find((source) => source.key === selectedKey) ?? maxSources[0];
  const selectedCurrent = selectedSource ? currentByKey.get(selectedSource.key) : undefined;
  const selectedHistory = selectedSource
    ? maxes.history.filter((item) => item.exercise_key === selectedSource.key)
    : [];

  function beginEdit(source: MaxSourceOption) {
    const current = currentByKey.get(source.key);
    skipBlur.current = false;
    setEditingKey(source.key);
    setValue(current ? String(current.value) : "");
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setSaveError(null);
  }

  async function saveMax(source: MaxSourceOption) {
    if (saveInFlight.current || editingKey !== source.key) return;
    const numericValue = Number(value);
    if (!value.trim() || !Number.isFinite(numericValue) || numericValue <= 0) {
      setEditingKey(null);
      setSaveError({ key: source.key, message: "Enter a max greater than 0 lb." });
      return;
    }
    if (currentByKey.get(source.key)?.value === numericValue) {
      setEditingKey(null);
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session token");
      await saveStrengthMax(
        source.key,
        { value: numericValue, effective_date: formatLocalDate(new Date()) },
        token,
      );
      onRefresh(await getStrengthMaxes(token));
    } catch (error) {
      setSaveError({ key: source.key, message: strengthErrorMessage(error, "max") });
    } finally {
      setEditingKey(null);
      setIsSaving(false);
      saveInFlight.current = false;
    }
  }

  return (
    <section className="strength-section" aria-labelledby="maxes-heading">
      <button
        className="panel strength-maxes-disclosure"
        type="button"
        aria-label="Maxes"
        aria-expanded={isExpanded}
        aria-controls="strength-maxes-content"
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span className="strength-maxes-title" id="maxes-heading">Maxes</span>
        <span className="strength-big-three" aria-label="Big 3 maxes">
          {BIG_THREE_MAX_SOURCES.map(([key, label]) => {
            const current = currentByKey.get(key);
            return (
              <span className="strength-big-three-item" key={key}>
                <span>{label}</span>
                <strong>{current ? `${formatPounds(current.value)} lb` : "—"}</strong>
              </span>
            );
          })}
        </span>
        <span className="disclosure-icon" aria-hidden="true">⌄</span>
      </button>
      {isExpanded && (
        <div className="strength-maxes-content" id="strength-maxes-content">
          <div className="strength-max-grid">
            {maxSources.map((source) => {
              const current = currentByKey.get(source.key);
              const isEditing = editingKey === source.key;
              return (
                <article
                  className={`strength-max-card${selectedKey === source.key ? " is-selected" : ""}`}
                  key={source.key}
                  onClick={() => setSelectedKey(source.key)}
                >
                  <div className="strength-max-summary">
                    <h4>
                      <button
                        className="strength-max-select"
                        type="button"
                        aria-pressed={selectedKey === source.key}
                        onClick={() => setSelectedKey(source.key)}
                      >
                        {source.label}
                      </button>
                    </h4>
                    <div className="strength-max-control">
                      {isEditing ? (
                        <div className="strength-max-inline-editor">
                          <input
                            aria-label={`${source.label} max`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            onBlur={() => {
                              if (skipBlur.current) {
                                skipBlur.current = false;
                                return;
                              }
                              void saveMax(source);
                            }}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                event.preventDefault();
                                skipBlur.current = true;
                                cancelEdit();
                              } else if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                            }}
                            disabled={isSaving}
                            autoFocus
                          />
                          <span>lb</span>
                        </div>
                      ) : (
                        <button
                          className={current ? "strength-max-value" : "strength-max-empty"}
                          type="button"
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            beginEdit(source);
                          }}
                        >
                          {current ? `${formatPounds(current.value)} lb` : "Add max"}
                        </button>
                      )}
                    </div>
                  </div>
                  {saveError?.key === source.key && (
                    <p className="form-error strength-max-error" role="alert">{saveError.message}</p>
                  )}
                </article>
              );
            })}
          </div>
          {selectedSource && (
            <StrengthMaxHistory
              exerciseKey={selectedSource.key}
              exerciseLabel={selectedSource.label}
              current={selectedCurrent}
              history={selectedHistory}
            />
          )}
        </div>
      )}
    </section>
  );
}

interface ExerciseLibraryProps {
  exercises: Exercise[];
  maxSources: MaxSourceOption[];
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

function buildMaxSources(exercises: Exercise[]): MaxSourceOption[] {
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

function defaultMaxSource(
  maxes: StrengthMaxCollection,
  maxSources: MaxSourceOption[],
): string {
  const keysWithData = new Set([
    ...maxes.current.map((item) => item.exercise_key),
    ...maxes.history.map((item) => item.exercise_key),
  ]);
  const bench = maxSources.find((source) => (
    source.key === "bench_press" && keysWithData.has(source.key)
  ));
  return bench?.key
    ?? maxSources.find((source) => keysWithData.has(source.key))?.key
    ?? maxSources[0]?.key
    ?? "";
}
