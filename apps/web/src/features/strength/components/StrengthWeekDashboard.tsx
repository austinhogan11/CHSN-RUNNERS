import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { WeekDaySelector } from "../../training/components/WeekDaySelector";
import { WeekNavigation } from "../../training/components/WeekNavigation";
import { useWeekdaySelection } from "../../training/useWeekdaySelection";
import { formatCalendarDate, formatLocalDate } from "../../../utils/date";
import type {
  DistanceUnit,
  Exercise,
  ExerciseBlock,
  PlannedSet,
  StrengthSession,
  StrengthSessionCreate,
  StrengthSessionUpdate,
  StrengthWeek,
} from "../types";

export interface MaxSourceOption {
  key: string;
  label: string;
}

interface StrengthWeekDashboardProps {
  week: StrengthWeek;
  exercises: Exercise[];
  maxSources: MaxSourceOption[];
  isCurrentWeek: boolean;
  isWeekLoading: boolean;
  weekError: string | null;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  onCreate: (payload: StrengthSessionCreate) => Promise<StrengthSession>;
  onUpdate: (sessionId: string, payload: StrengthSessionUpdate) => Promise<StrengthSession>;
  onReload: (sessionId: string) => Promise<StrengthSession>;
  onDelete: (sessionId: string) => Promise<void>;
}

export function StrengthWeekDashboard({
  week,
  exercises,
  maxSources,
  isCurrentWeek,
  isWeekLoading,
  weekError,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  onCreate,
  onUpdate,
  onReload,
  onDelete,
}: StrengthWeekDashboardProps) {
  const today = formatLocalDate(new Date());
  const { weekDates, selectedDay, selectedWeekdayIndex, selectWeekday } =
    useWeekdaySelection(week.week_start, today);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const selectedDayRef = useRef<HTMLElement>(null);
  const sessionsByDate = groupSessionsByDate(week.sessions);
  const selectedSessions = sessionsByDate.get(selectedDay) ?? [];
  const selectedSession = selectedSessions.find((session) => session.id === selectedSessionId)
    ?? selectedSessions[0]
    ?? null;

  async function handleCreate() {
    setIsCreatingSession(true);
    setCreateError(null);
    try {
      const created = await onCreate({
        date: selectedDay,
        title: "Strength Session",
        notes: null,
        exercise_blocks: [],
      });
      setSelectedSessionId(created.id);
      selectedDayRef.current?.focus();
    } catch {
      setCreateError("Unable to create strength session. Try again.");
    } finally {
      setIsCreatingSession(false);
    }
  }

  return (
    <section className="strength-week-section" aria-labelledby="strength-week-heading">
      <div className="section-heading">
        <h3 id="strength-week-heading">Weekly Training</h3>
        <span className="section-note">
          {week.sessions.length} {week.sessions.length === 1 ? "session" : "sessions"} this week
        </span>
      </div>

      <WeekNavigation
        weekStart={week.week_start}
        isCurrentWeek={isCurrentWeek}
        isLoading={isWeekLoading}
        error={weekError}
        onPrevious={onPreviousWeek}
        onNext={onNextWeek}
        onCurrent={onCurrentWeek}
      />

      <WeekDaySelector
        weekDates={weekDates}
        selectedWeekdayIndex={selectedWeekdayIndex}
        today={today}
        onSelect={(index) => {
          selectWeekday(index);
          setSelectedSessionId(null);
          setCreateError(null);
        }}
        renderSummary={(day) => {
          const count = sessionsByDate.get(day)?.length ?? 0;
          return count === 0 ? "—" : `${count} ${count === 1 ? "session" : "sessions"}`;
        }}
      />

      <section
        className="panel strength-selected-day"
        aria-labelledby="strength-selected-day-heading"
        ref={selectedDayRef}
        tabIndex={-1}
      >
        <div className="selected-day-header">
          <div className="selected-day-title">
            <h4 id="strength-selected-day-heading">
              {formatCalendarDate(selectedDay, {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </h4>
            {selectedDay === today && <span className="today-label">Today</span>}
          </div>
          <button
            className="text-button strength-quick-add"
            type="button"
            disabled={isCreatingSession}
            onClick={() => void handleCreate()}
          >
            {isCreatingSession ? "Adding..." : "+ Add session"}
          </button>
        </div>

        {createError && <p className="form-error strength-create-error" role="alert">{createError}</p>}

        {selectedSessions.length === 0 ? (
          <p className="strength-day-empty">No strength sessions for this day.</p>
        ) : (
          <>
            <div className="strength-session-selector" aria-label="Strength sessions">
              {selectedSessions.map((session) => (
                <button
                  type="button"
                  key={session.id}
                  aria-pressed={session.id === selectedSession?.id}
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  <strong>{session.title}</strong>
                  <span>
                    {session.exercise_blocks.length} {session.exercise_blocks.length === 1 ? "exercise" : "exercises"}
                  </span>
                </button>
              ))}
            </div>
            {selectedSession && (
              <StrengthSessionEditor
                key={selectedSession.id}
                session={selectedSession}
                exercises={exercises}
                maxSources={maxSources}
                onSave={onUpdate}
                onReload={onReload}
                onDelete={async (sessionId) => {
                  await onDelete(sessionId);
                  setSelectedSessionId(null);
                }}
              />
            )}
          </>
        )}
      </section>
    </section>
  );
}

interface StrengthSessionEditorProps {
  session: StrengthSession;
  exercises: Exercise[];
  maxSources: MaxSourceOption[];
  onSave: (sessionId: string, payload: StrengthSessionUpdate) => Promise<StrengthSession>;
  onReload: (sessionId: string) => Promise<StrengthSession>;
  onDelete: (sessionId: string) => Promise<void>;
}

function StrengthSessionEditor({
  session,
  exercises,
  maxSources,
  onSave,
  onReload,
  onDelete,
}: StrengthSessionEditorProps) {
  const [draft, setDraft] = useState(() => cloneSession(session));
  const [persisted, setPersisted] = useState(() => cloneSession(session));
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isNotesVisible, setIsNotesVisible] = useState(false);
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const exerciseNames = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  const filteredExercises = exercises.filter((exercise) => (
    exercise.name.toLocaleLowerCase().includes(exerciseSearch.trim().toLocaleLowerCase())
  ));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(persisted);

  function updateBlock(blockId: string, transform: (block: ExerciseBlock) => ExerciseBlock) {
    setDraft((current) => ({
      ...current,
      exercise_blocks: current.exercise_blocks.map((block) => (
        block.id === blockId ? transform(block) : block
      )),
    }));
  }

  function addExercise(exerciseId: string) {
    setDraft((current) => ({
      ...current,
      exercise_blocks: [
        ...current.exercise_blocks,
        {
          id: newId(),
          exercise_id: exerciseId,
          order: current.exercise_blocks.length + 1,
          group_id: null,
          label: null,
          planned_sets: [],
          actual_sets: [],
        },
      ],
    }));
    setIsExercisePickerOpen(false);
    setExerciseSearch("");
  }

  function removeExercise(blockId: string) {
    setDraft((current) => ({
      ...current,
      exercise_blocks: normalizeBlocks(
        current.exercise_blocks.filter((block) => block.id !== blockId),
      ),
    }));
  }

  function addSet(blockId: string) {
    updateBlock(blockId, (block) => ({
      ...block,
      planned_sets: [
        ...block.planned_sets,
        emptyPlannedSet(block.planned_sets.length + 1),
      ],
    }));
  }

  function removeSet(blockId: string, setId: string) {
    updateBlock(blockId, (block) => ({
      ...block,
      planned_sets: block.planned_sets
        .filter((set) => set.id !== setId)
        .map((set, index) => ({ ...set, set_number: index + 1 })),
      actual_sets: block.actual_sets.filter((set) => set.planned_set_id !== setId),
    }));
  }

  function updateSet(blockId: string, setId: string, changes: Partial<PlannedSet>) {
    updateBlock(blockId, (block) => ({
      ...block,
      planned_sets: block.planned_sets.map((set) => (
        set.id === setId ? { ...set, ...changes } : set
      )),
    }));
  }

  async function handleSave(): Promise<boolean> {
    const normalized = normalizeBlocks(draft.exercise_blocks);
    const error = validateSession(draft.title, normalized);
    if (error) {
      setSaveError(error);
      return false;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await onSave(draft.id, {
        title: draft.title.trim(),
        notes: draft.notes?.trim() || null,
        exercise_blocks: normalized,
      });
      const authoritative = cloneSession(saved);
      setDraft(authoritative);
      setPersisted(cloneSession(authoritative));
      return true;
    } catch {
      setSaveError("Unable to save strength session. Try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReload() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const reloaded = cloneSession(await onReload(draft.id));
      setDraft(reloaded);
      setPersisted(cloneSession(reloaded));
      setIsEditingTitle(false);
      setIsNotesVisible(false);
    } catch {
      setSaveError("Unable to reload strength session. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTitle() {
    if (await handleSave()) setIsEditingTitle(false);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveTitle();
    }
    if (event.key === "Escape") {
      setDraft((current) => ({ ...current, title: persisted.title }));
      setIsEditingTitle(false);
      setSaveError(null);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setSaveError(null);
    try {
      await onDelete(draft.id);
    } catch {
      setSaveError("Unable to delete strength session. Try again.");
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="strength-session-editor">
      <div className="strength-session-heading">
        {isEditingTitle ? (
          <input
            className="strength-title-input"
            aria-label="Session title"
            value={draft.title}
            disabled={isSaving}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            onKeyDown={handleTitleKeyDown}
            onFocus={(event) => event.currentTarget.select()}
            autoFocus
          />
        ) : (
          <button
            className="editable-value strength-session-title"
            type="button"
            aria-label={`Edit title: ${draft.title}`}
            onClick={() => setIsEditingTitle(true)}
          >
            {draft.title}
          </button>
        )}
        <button
          className="text-button"
          type="button"
          onClick={() => setIsNotesVisible((visible) => !visible)}
        >
          {isNotesVisible ? "Hide notes" : draft.notes ? "Edit notes" : "+ Notes"}
        </button>
      </div>

      {isNotesVisible && (
        <label>
          <span className="sr-only">Session notes</span>
          <textarea
            className="strength-notes-input"
            aria-label="Session notes"
            value={draft.notes ?? ""}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value || null })}
            autoFocus
          />
        </label>
      )}

      <div className="strength-exercise-picker">
        <button
          className="text-button"
          type="button"
          onClick={() => setIsExercisePickerOpen((open) => !open)}
        >
          + Add exercise
        </button>
        {isExercisePickerOpen && (
          <div className="strength-exercise-options">
            <input
              type="search"
              aria-label="Search session exercises"
              placeholder="Search exercises"
              value={exerciseSearch}
              onChange={(event) => setExerciseSearch(event.target.value)}
              autoFocus
            />
            <div className="strength-exercise-option-list" role="listbox" aria-label="Exercises">
              {filteredExercises.map((exercise) => (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  key={exercise.id}
                  onClick={() => addExercise(exercise.id)}
                >
                  {exercise.name}
                </button>
              ))}
              {filteredExercises.length === 0 && <span>No matching exercises</span>}
            </div>
          </div>
        )}
      </div>

      <div className="strength-blocks">
        {draft.exercise_blocks.map((block) => {
          const exerciseName = exerciseNames.get(block.exercise_id) ?? "Exercise";
          return (
            <section className="strength-block" aria-label={exerciseName} key={block.id}>
              <div className="strength-block-heading">
                <h5>{exerciseName}</h5>
                <button className="text-button danger-button" type="button" onClick={() => removeExercise(block.id)}>
                  Remove exercise
                </button>
              </div>
              {block.planned_sets.length > 0 && (
                <div className="strength-sets">
                  <div className="strength-set-header" aria-hidden="true">
                    <span>Set</span><span>Reps</span><span>%</span><span>Max</span><span>Weight</span><span>Distance</span><span>Unit</span><span>Duration</span><span>Rest</span><span />
                  </div>
                  {block.planned_sets.map((set) => (
                    <PlannedSetRow
                      key={set.id}
                      set={set}
                      exerciseName={exerciseName}
                      maxSources={maxSources}
                      onChange={(changes) => updateSet(block.id, set.id, changes)}
                      onRemove={() => removeSet(block.id, set.id)}
                    />
                  ))}
                </div>
              )}
              <button className="text-button strength-add-set" type="button" onClick={() => addSet(block.id)}>
                + Add set
              </button>
            </section>
          );
        })}
      </div>

      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <div className="strength-editor-actions">
        {isDirty && (
          <button className="secondary-button" type="button" disabled={isSaving || isDeleting} onClick={() => void handleSave()}>
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        )}
        <button className="secondary-button" type="button" disabled={isSaving || isDeleting} onClick={handleReload}>
          Reload
        </button>
        {!confirmingDelete ? (
          <button className="text-button danger-button" type="button" disabled={isSaving} onClick={() => setConfirmingDelete(true)}>
            Delete session
          </button>
        ) : (
          <div className="strength-delete-confirmation" role="group" aria-label={`Delete ${draft.title}`}>
            <span>Delete this session?</span>
            <button className="text-button danger-button" type="button" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? "Deleting..." : "Confirm"}
            </button>
            <button className="text-button" type="button" disabled={isDeleting} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface PlannedSetRowProps {
  set: PlannedSet;
  exerciseName: string;
  maxSources: MaxSourceOption[];
  onChange: (changes: Partial<PlannedSet>) => void;
  onRemove: () => void;
}

function PlannedSetRow({ set, exerciseName, maxSources, onChange, onRemove }: PlannedSetRowProps) {
  const label = `${exerciseName} set ${set.set_number}`;
  return (
    <div className="strength-set-row">
      <strong>{set.set_number}</strong>
      <NumberField label={`${label} reps`} value={set.target_reps} min={1} step={1} onChange={(value) => onChange({ target_reps: value })} />
      <NumberField label={`${label} percentage`} value={set.percentage} min={0} max={500} onChange={(value) => onChange({ percentage: value })} />
      <label>
        <span className="sr-only">{label} max source</span>
        <select aria-label={`${label} max source`} value={set.max_source ?? ""} onChange={(event) => onChange({ max_source: event.target.value || null })}>
          <option value="">—</option>
          {maxSources.map((source) => <option value={source.key} key={source.key}>{source.label}</option>)}
        </select>
      </label>
      <NumberField label={`${label} weight`} value={set.target_weight} min={0} onChange={(value) => onChange({ target_weight: value })} />
      <NumberField label={`${label} distance`} value={set.target_distance} min={0.01} onChange={(value) => onChange({ target_distance: value })} />
      <label>
        <span className="sr-only">{label} distance unit</span>
        <select aria-label={`${label} distance unit`} value={set.distance_unit ?? ""} onChange={(event) => onChange({ distance_unit: (event.target.value || null) as DistanceUnit | null })}>
          <option value="">—</option>
          <option value="yards">Yards</option>
          <option value="meters">Meters</option>
        </select>
      </label>
      <NumberField label={`${label} duration seconds`} value={set.target_duration_seconds} min={1} step={1} onChange={(value) => onChange({ target_duration_seconds: value })} />
      <NumberField label={`${label} rest seconds`} value={set.rest_seconds} min={0} step={1} onChange={(value) => onChange({ rest_seconds: value })} />
      <button className="delete-session-button" type="button" aria-label={`Remove ${label}`} onClick={onRemove}>×</button>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | null;
  min: number;
  max?: number;
  step?: number;
  onChange: (value: number | null) => void;
}

function NumberField({ label, value, min, max, step = 0.01, onChange }: NumberFieldProps) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </label>
  );
}

function groupSessionsByDate(sessions: StrengthSession[]): Map<string, StrengthSession[]> {
  const result = new Map<string, StrengthSession[]>();
  for (const session of sessions) {
    result.set(session.date, [...(result.get(session.date) ?? []), session]);
  }
  return result;
}

function emptyPlannedSet(setNumber: number): PlannedSet {
  return {
    id: newId(),
    set_number: setNumber,
    target_reps: null,
    target_distance: null,
    distance_unit: null,
    target_duration_seconds: null,
    percentage: null,
    max_source: null,
    max_value_at_creation: null,
    target_weight: null,
    rest_seconds: null,
  };
}

function normalizeBlocks(blocks: ExerciseBlock[]): ExerciseBlock[] {
  return blocks.map((block, blockIndex) => ({
    ...block,
    order: blockIndex + 1,
    planned_sets: block.planned_sets.map((set, setIndex) => ({
      ...set,
      set_number: setIndex + 1,
    })),
  }));
}

function validateSession(title: string, blocks: ExerciseBlock[]): string | null {
  if (!title.trim()) return "Enter a session title.";
  for (const block of blocks) {
    for (const set of block.planned_sets) {
      const prefix = `Set ${set.set_number}`;
      if (set.target_reps !== null && (!Number.isInteger(set.target_reps) || set.target_reps <= 0)) {
        return `${prefix} reps must be a whole number greater than 0.`;
      }
      if (set.target_distance !== null && set.target_distance <= 0) {
        return `${prefix} distance must be greater than 0.`;
      }
      if ((set.target_distance === null) !== (set.distance_unit === null)) {
        return `${prefix} distance and unit must be provided together.`;
      }
      if (set.target_duration_seconds !== null && (!Number.isInteger(set.target_duration_seconds) || set.target_duration_seconds <= 0)) {
        return `${prefix} duration must be a whole number greater than 0.`;
      }
      if (set.target_reps === null && set.target_distance === null && set.target_duration_seconds === null) {
        return `${prefix} needs reps, distance, or duration.`;
      }
      if ((set.percentage === null) !== (set.max_source === null)) {
        return `${prefix} percentage and max source must be provided together.`;
      }
      if (set.percentage !== null && (set.percentage < 0 || set.percentage > 500)) {
        return `${prefix} percentage must be between 0 and 500.`;
      }
      if (set.target_weight !== null && set.target_weight < 0) {
        return `${prefix} weight must be 0 pounds or greater.`;
      }
      if (set.rest_seconds !== null && (!Number.isInteger(set.rest_seconds) || set.rest_seconds < 0)) {
        return `${prefix} rest must be a whole number of seconds.`;
      }
    }
  }
  return null;
}

function cloneSession(session: StrengthSession): StrengthSession {
  return structuredClone(session);
}

function newId(): string {
  return crypto.randomUUID();
}
