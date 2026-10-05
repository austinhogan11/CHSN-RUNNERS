import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { WeekDaySelector } from "../../training/components/WeekDaySelector";
import { WeekNavigation } from "../../training/components/WeekNavigation";
import { useWeekdaySelection } from "../../training/useWeekdaySelection";
import { formatCalendarDate, formatLocalDate } from "../../../utils/date";
import { StrengthApiError, strengthErrorMessage } from "../api";
import type {
  ActualSet,
  DistanceUnit,
  Exercise,
  ExerciseBlock,
  PlannedSet,
  StrengthMax,
  StrengthProgram,
  StrengthProgramInstanceSummary,
  StrengthProgramSchedule,
  StrengthProgramScheduleResult,
  StrengthSession,
  StrengthSessionCreate,
  StrengthSessionUpdate,
  StrengthWeek,
} from "../types";

export interface MaxSourceOption {
  key: string;
  label: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DEFAULT_PROGRAM_WEEKDAYS: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

interface StrengthWeekDashboardProps {
  week: StrengthWeek;
  exercises: Exercise[];
  maxSources: MaxSourceOption[];
  maxHistory: StrengthMax[];
  programs: StrengthProgram[];
  programInstances: StrengthProgramInstanceSummary[];
  isCurrentWeek: boolean;
  isWeekLoading: boolean;
  weekError: string | null;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  onCreate: (payload: StrengthSessionCreate) => Promise<StrengthSession>;
  onScheduleProgram: (
    programId: string,
    payload: StrengthProgramSchedule,
  ) => Promise<StrengthProgramScheduleResult>;
  onUpdate: (sessionId: string, payload: StrengthSessionUpdate) => Promise<StrengthSession>;
  onReload: (sessionId: string) => Promise<StrengthSession>;
  onDelete: (sessionId: string) => Promise<void>;
}

interface TrainingPlanPanelProps {
  programs: StrengthProgram[];
  instances: StrengthProgramInstanceSummary[];
  exercises: Exercise[];
  defaultStartDate: string;
  onSchedule: (
    programId: string,
    payload: StrengthProgramSchedule,
  ) => Promise<StrengthProgramScheduleResult>;
}

function TrainingPlanPanel({
  programs,
  instances,
  exercises,
  defaultStartDate,
  onSchedule,
}: TrainingPlanPanelProps) {
  const [isSetupOpen, setIsSetupOpen] = useState(instances.length === 0);
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(
    DEFAULT_PROGRAM_WEEKDAYS[3],
  );
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsDuplicateConfirmation, setNeedsDuplicateConfirmation] = useState(false);
  const selectedProgram = programs.find((program) => program.id === programId) ?? programs[0];

  function chooseFrequency(value: number) {
    setDaysPerWeek(value);
    setSelectedWeekdays(DEFAULT_PROGRAM_WEEKDAYS[value]);
    setError(null);
  }

  async function submit(allowDuplicate = false) {
    if (!selectedProgram) return;
    if (selectedWeekdays.length !== daysPerWeek) {
      setError(`Choose exactly ${daysPerWeek} training days.`);
      return;
    }
    setIsScheduling(true);
    setError(null);
    try {
      await onSchedule(selectedProgram.id, {
        start_date: startDate,
        days_per_week: daysPerWeek,
        selected_weekdays: [...selectedWeekdays].sort((a, b) => a - b),
        allow_duplicate: allowDuplicate,
      });
      setNeedsDuplicateConfirmation(false);
      setIsSetupOpen(false);
    } catch (caught) {
      if (caught instanceof StrengthApiError && caught.status === 409) {
        setNeedsDuplicateConfirmation(true);
        setError(caught.detail ?? "This plan is already scheduled.");
      } else {
        setError(strengthErrorMessage(caught, "training plan"));
      }
    } finally {
      setIsScheduling(false);
    }
  }

  return (
    <section className="panel strength-plan-panel" aria-labelledby="training-plan-heading">
      <div className="strength-plan-heading">
        <div>
          <h4 id="training-plan-heading">Training Plan</h4>
          {instances.length === 0 && <span className="section-note">No plan scheduled</span>}
        </div>
        <button className="text-button" type="button" onClick={() => setIsSetupOpen((open) => !open)}>
          {isSetupOpen ? "Close setup" : instances.length > 0 ? "Add another plan" : "Schedule plan"}
        </button>
      </div>

      {instances.map((instance) => (
        <div className="strength-plan-summary" key={instance.instance_id}>
          <div><strong>{instance.program_name}</strong><span>{instance.total_workouts} workouts</span></div>
          <span>{instance.days_per_week} days/week · {instance.selected_weekdays.map((day) => WEEKDAYS[day][0]).join(" ")}</span>
          <span>Started {formatCalendarDate(instance.start_date, { month: "short", day: "numeric" })}</span>
          <span>Progress {instance.completed_workouts} / {instance.total_workouts}</span>
        </div>
      ))}

      {isSetupOpen && selectedProgram && (
        <div className="strength-plan-setup">
          <label>Training Plan<select value={programId} onChange={(event) => setProgramId(event.target.value)}>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
          <fieldset><legend>Days per week</legend><div className="strength-frequency-buttons">{[2, 3, 4, 5, 6, 7].map((count) => <button type="button" aria-pressed={daysPerWeek === count} key={count} onClick={() => chooseFrequency(count)}>{count}</button>)}</div></fieldset>
          <fieldset><legend>Weekdays</legend><div className="strength-frequency-buttons">{WEEKDAYS.map((label, index) => <button type="button" aria-pressed={selectedWeekdays.includes(index)} key={label} onClick={() => setSelectedWeekdays((days) => days.includes(index) ? days.filter((day) => day !== index) : [...days, index])}>{label}</button>)}</div></fieldset>
          <label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <p className="section-note">Day 1 starts on this date. Later workouts use the selected weekdays.</p>
          <details className="strength-plan-preview"><summary>View plan</summary>{selectedProgram.days.map((day) => <div key={day.id}><strong>{day.name}</strong><span>{previewExerciseNames(day, exercises)}</span></div>)}</details>
          {error && <p className="form-error" role="alert">{error}</p>}
          {needsDuplicateConfirmation ? (
            <div className="strength-plan-actions"><button className="secondary-button" type="button" onClick={() => { setNeedsDuplicateConfirmation(false); setError(null); }}>Cancel</button><button className="primary-button" type="button" disabled={isScheduling} onClick={() => void submit(true)}>Schedule another run</button></div>
          ) : (
            <button className="primary-button" type="button" disabled={isScheduling} onClick={() => void submit()}>{isScheduling ? "Scheduling..." : "Add plan to calendar"}</button>
          )}
        </div>
      )}
    </section>
  );
}

function workoutExerciseCount(session: StrengthSession, exercises: Exercise[]) {
  const categoryById = new Map(exercises.map((exercise) => [exercise.id, exercise.category]));
  return session.exercise_blocks.filter((block) => (
    block.label?.toLocaleLowerCase() !== "warm-up"
    && categoryById.get(block.exercise_id)?.toLocaleLowerCase() !== "conditioning"
  )).length;
}

function previewExerciseNames(day: StrengthProgram["days"][number], exercises: Exercise[]) {
  const nameById = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  const names = day.exercise_blocks
    .filter((block) => block.label?.toLocaleLowerCase() !== "warm-up")
    .map((block) => nameById.get(block.exercise_id) ?? "Exercise");
  return names.slice(0, 3).join(" · ") + (names.length > 3 ? ` · +${names.length - 3}` : "");
}

export function StrengthWeekDashboard({
  week,
  exercises,
  maxSources,
  maxHistory,
  programs,
  programInstances,
  isCurrentWeek,
  isWeekLoading,
  weekError,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  onCreate,
  onScheduleProgram,
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

      <TrainingPlanPanel
        programs={programs}
        instances={programInstances}
        exercises={exercises}
        defaultStartDate={selectedDay}
        onSchedule={onScheduleProgram}
      />

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
            {isCreatingSession ? "Adding..." : "+ Blank workout"}
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
                    {workoutExerciseCount(session, exercises)} {workoutExerciseCount(session, exercises) === 1 ? "exercise" : "exercises"}
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
                maxHistory={maxHistory}
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
  maxHistory: StrengthMax[];
  onSave: (sessionId: string, payload: StrengthSessionUpdate) => Promise<StrengthSession>;
  onReload: (sessionId: string) => Promise<StrengthSession>;
  onDelete: (sessionId: string) => Promise<void>;
}

function StrengthSessionEditor({
  session,
  exercises,
  maxSources,
  maxHistory,
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
  const [isMoving, setIsMoving] = useState(false);
  const [moveDate, setMoveDate] = useState(session.date);
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
          planned_sets: [
            {
              ...emptyPlannedSet(1),
              target_reps: 5,
            },
          ],
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

  function replaceExercise(blockId: string, exerciseId: string) {
    updateBlock(blockId, (block) => ({ ...block, exercise_id: exerciseId }));
  }

  function addSet(blockId: string) {
    updateBlock(blockId, (block) => ({
      ...block,
      planned_sets: [
        ...block.planned_sets,
        copyPlannedSet(
          block.planned_sets.at(-1),
          block.planned_sets.length + 1,
        ),
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

  function updateActualSet(
    blockId: string,
    plannedSet: PlannedSet,
    changes: Partial<ActualSet>,
  ) {
    updateBlock(blockId, (block) => {
      const existing = block.actual_sets.find((set) => set.planned_set_id === plannedSet.id);
      const next = {
        ...(existing ?? expectedActualSet(plannedSet)),
        ...changes,
      };
      return {
        ...block,
        actual_sets: existing
          ? block.actual_sets.map((set) => set.planned_set_id === plannedSet.id ? next : set)
          : [...block.actual_sets, next],
      };
    });
  }

  async function handleSave(): Promise<boolean> {
    const normalized = normalizeBlocks(draft.exercise_blocks)
      .map((block) => (
        draft.program ? block : snapshotPercentageSets(block, draft.date, maxHistory)
      ))
      .map(normalizeBlockForSave);
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
    } catch (error) {
      setSaveError(strengthErrorMessage(error, "strength session"));
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

  async function handleMove() {
    if (!moveDate || moveDate === draft.date) {
      setIsMoving(false);
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const moved = cloneSession(await onSave(draft.id, { date: moveDate }));
      setDraft(moved);
      setPersisted(cloneSession(moved));
      setIsMoving(false);
    } catch (error) {
      setSaveError(strengthErrorMessage(error, "workout move"));
    } finally {
      setIsSaving(false);
    }
  }

  const primaryBlocks = draft.exercise_blocks.filter((block) => {
    const exercise = exercises.find((candidate) => candidate.id === block.exercise_id);
    return !isWarmupBlock(block) && exercise?.category.toLocaleLowerCase() !== "conditioning";
  });
  const warmupBlocks = draft.exercise_blocks.filter(isWarmupBlock);
  const conditioningBlocks = draft.exercise_blocks.filter((block) => (
    !isWarmupBlock(block)
    && exercises.find((candidate) => candidate.id === block.exercise_id)?.category.toLocaleLowerCase()
      === "conditioning"
  ));
  const blockLabels = buildExerciseLabels(primaryBlocks);

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
        <div className="strength-session-header-actions">
          {!isMoving ? (
            <button className="text-button" type="button" disabled={isSaving || isDeleting || isDirty} onClick={() => setIsMoving(true)}>
              Move
            </button>
          ) : (
            <div className="strength-move-controls" role="group" aria-label={`Move ${draft.title}`}>
              <input
                type="date"
                aria-label="Move workout date"
                value={moveDate}
                onChange={(event) => setMoveDate(event.target.value)}
              />
              <button className="text-button" type="button" disabled={isSaving} onClick={() => void handleMove()}>
                Save move
              </button>
              <button className="text-button" type="button" disabled={isSaving} onClick={() => {
                setMoveDate(draft.date);
                setIsMoving(false);
              }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <SupplementalSummary
        warmupBlocks={warmupBlocks}
        conditioningBlocks={conditioningBlocks}
        exerciseNames={exerciseNames}
      />

      <div className="strength-blocks">
        {primaryBlocks.map((block) => {
          const exercise = exercises.find((candidate) => candidate.id === block.exercise_id);
          const exerciseName = exerciseNames.get(block.exercise_id) ?? "Exercise";
          return (
            <ExerciseBlockEditor
              key={block.id}
              block={block}
              displayLabel={blockLabels.get(block.id) ?? `${block.order}.`}
              exerciseName={exerciseName}
              exercises={exercises}
              defaultMaxSource={exercise?.default_max_source ?? null}
              maxSources={maxSources}
              maxHistory={maxHistory}
              sessionDate={draft.date}
              freezePlannedWeights={draft.program != null}
              onChangeBlock={(transform) => updateBlock(block.id, transform)}
              onReplace={(exerciseId) => replaceExercise(block.id, exerciseId)}
              onChangeSet={(setId, changes) => updateSet(block.id, setId, changes)}
              onChangeActual={(plannedSet, changes) => updateActualSet(block.id, plannedSet, changes)}
              onAddSet={() => addSet(block.id)}
              onRemoveSet={(setId) => removeSet(block.id, setId)}
              onRemove={() => removeExercise(block.id)}
            />
          );
        })}
      </div>

      <div className="strength-exercise-picker">
        <button
          className="text-button"
          type="button"
          onClick={() => setIsExercisePickerOpen((open) => !open)}
        >
          + Exercise
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

      <section className="strength-workout-notes" aria-label="Workout notes">
        <button
          className="text-button"
          type="button"
          aria-expanded={isNotesVisible}
          onClick={() => setIsNotesVisible((visible) => !visible)}
        >
          {isNotesVisible ? "Hide notes" : draft.notes ? "Edit notes" : "+ Notes"}
        </button>
        {isNotesVisible && (
          <label>
            <span>Notes</span>
            <textarea
              className="strength-notes-input"
              aria-label="Session notes"
              value={draft.notes ?? ""}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value || null })}
              autoFocus
            />
          </label>
        )}
      </section>

      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <div className="strength-editor-actions">
        {isDirty && <span className="strength-dirty-state">Unsaved changes</span>}
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

type PrescriptionMode = "percentage" | "fixed" | "reps" | "distance" | "duration";

interface ExerciseBlockEditorProps {
  block: ExerciseBlock;
  displayLabel: string;
  exerciseName: string;
  exercises: Exercise[];
  defaultMaxSource: string | null;
  maxSources: MaxSourceOption[];
  maxHistory: StrengthMax[];
  sessionDate: string;
  freezePlannedWeights: boolean;
  onChangeBlock: (transform: (block: ExerciseBlock) => ExerciseBlock) => void;
  onReplace: (exerciseId: string) => void;
  onChangeSet: (setId: string, changes: Partial<PlannedSet>) => void;
  onChangeActual: (plannedSet: PlannedSet, changes: Partial<ActualSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
}

function ExerciseBlockEditor({
  block,
  displayLabel,
  exerciseName,
  exercises,
  defaultMaxSource,
  maxSources,
  maxHistory,
  sessionDate,
  freezePlannedWeights,
  onChangeBlock,
  onReplace,
  onChangeSet,
  onChangeActual,
  onAddSet,
  onRemoveSet,
  onRemove,
}: ExerciseBlockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const mode = inferPrescriptionMode(block.planned_sets);
  const maxSource = block.planned_sets.find((set) => set.max_source)?.max_source
    ?? defaultMaxSource
    ?? maxSources[0]?.key
    ?? "";
  const effectiveMax = maxSource
    ? findEffectiveMax(maxHistory, maxSource, sessionDate)
    : null;

  function changeMode(nextMode: PrescriptionMode) {
    onChangeBlock((current) => ({
      ...current,
      planned_sets: current.planned_sets.map((set) => snapshotPercentageSet(
        setForMode(
          set,
          nextMode,
          defaultMaxSource ?? maxSources[0]?.key ?? null,
        ),
        sessionDate,
        maxHistory,
      )),
      actual_sets: current.actual_sets.map((set) => ({
        ...set,
        actual_reps: nextMode === "percentage" || nextMode === "fixed" || nextMode === "reps"
          ? set.actual_reps
          : null,
        actual_distance: nextMode === "distance" ? set.actual_distance : null,
        actual_duration_seconds: nextMode === "duration" ? set.actual_duration_seconds : null,
        actual_weight: nextMode === "reps" ? null : set.actual_weight,
      })),
    }));
  }

  function changeMaxSource(source: string) {
    onChangeBlock((current) => ({
      ...current,
      planned_sets: current.planned_sets.map((set) => snapshotPercentageSet({
        ...set,
        max_source: set.percentage === null ? null : source || null,
      }, sessionDate, maxHistory)),
    }));
  }

  return (
    <section
      className={`strength-block${block.group_id ? " is-superset" : ""}`}
      aria-label={exerciseName}
      data-layout="compact-exercise"
    >
      <div className="strength-block-heading">
        <div className="strength-exercise-identity">
          <span className="strength-exercise-number">{displayLabel}</span>
          <div>
            <h5>
              {exerciseName}
              {displayLabel.includes("A.") && <span className="strength-superset-label">SS</span>}
            </h5>
            <span>{exercisePrescriptionSummary(block, maxSources)}</span>
          </div>
        </div>
        <span className="strength-exercise-rest">{formatRest(block)}</span>
        <button
          className="strength-exercise-menu"
          type="button"
          aria-label={`Edit ${exerciseName}`}
          aria-expanded={isEditing}
          onClick={() => setIsEditing((editing) => !editing)}
        >
          •••
        </button>
      </div>
      {!isEditing && (
        <>
          <div className="strength-compact-sets" role="list" aria-label={`${exerciseName} sets`}>
            {block.planned_sets.map((set) => (
              <CompactExecutionSet
                key={set.id}
                set={set}
                mode={mode}
                exerciseName={exerciseName}
                freezePlannedWeights={freezePlannedWeights}
                effectiveMax={effectiveMax}
                actualSet={block.actual_sets.find((actual) => actual.planned_set_id === set.id) ?? null}
                onChangeActual={(changes) => onChangeActual(set, changes)}
              />
            ))}
          </div>
          {mode === "percentage" && effectiveMax === null && (
            <p className="strength-missing-max">
              Set {maxSources.find((source) => source.key === maxSource)?.label ?? "this exercise"} max to calculate planned weights
            </p>
          )}
        </>
      )}

      {isEditing && (
        <div className="strength-exercise-edit" aria-label={`Edit ${exerciseName} prescription`}>
          <label>
            <span>Replace exercise</span>
            <select
              aria-label={`Replace ${exerciseName}`}
              value={block.exercise_id}
              onChange={(event) => onReplace(event.target.value)}
            >
              {exercises.map((exercise) => (
                <option value={exercise.id} key={exercise.id}>{exercise.name}</option>
              ))}
            </select>
          </label>
          <div className="strength-prescription-controls">
            <label>
              <span>Prescription</span>
              <select
                aria-label={`${exerciseName} prescription`}
                value={mode}
                onChange={(event) => changeMode(event.target.value as PrescriptionMode)}
              >
                <option value="reps">Reps only</option>
                <option value="fixed">Fixed weight</option>
                <option value="percentage">Percentage</option>
                <option value="distance">Distance</option>
                <option value="duration">Duration</option>
              </select>
            </label>
            {mode === "percentage" && (
              <label>
                <span>Max</span>
                <select
                  aria-label={`${exerciseName} max source`}
                  value={maxSource}
                  onChange={(event) => changeMaxSource(event.target.value)}
                >
                  {maxSources.map((source) => (
                    <option value={source.key} key={source.key}>{source.label}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="text-button strength-more-options"
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((visible) => !visible)}
            >
              {showAdvanced ? "Fewer options" : "More options"}
            </button>
          </div>
          <div className="strength-sets">
            {block.planned_sets.map((set) => (
              <PlannedSetRow
                key={set.id}
                set={set}
                mode={mode}
                exerciseName={exerciseName}
                showAdvanced={showAdvanced}
                freezePlannedWeights={freezePlannedWeights}
                effectiveMax={effectiveMax}
                onChange={(changes) => onChangeSet(
                  set.id,
                  "percentage" in changes
                    ? snapshotPercentageSet({ ...set, ...changes }, sessionDate, maxHistory)
                    : changes,
                )}
                actualSet={block.actual_sets.find((actual) => actual.planned_set_id === set.id) ?? null}
                onChangeActual={(plannedSet, changes) => onChangeActual(plannedSet, changes)}
                onRemove={() => onRemoveSet(set.id)}
              />
            ))}
          </div>
          <div className="strength-exercise-edit-actions">
            <button className="text-button" type="button" onClick={onAddSet}>+ Set</button>
            <button className="text-button danger-button" type="button" onClick={onRemove}>Remove exercise</button>
          </div>
        </div>
      )}
    </section>
  );
}

interface CompactExecutionSetProps {
  set: PlannedSet;
  mode: PrescriptionMode;
  exerciseName: string;
  freezePlannedWeights: boolean;
  effectiveMax: StrengthMax | null;
  actualSet: ActualSet | null;
  onChangeActual: (changes: Partial<ActualSet>) => void;
}

function CompactExecutionSet({
  set,
  mode,
  exerciseName,
  freezePlannedWeights,
  effectiveMax,
  actualSet,
  onChangeActual,
}: CompactExecutionSetProps) {
  const label = `${exerciseName} set ${set.set_number}`;
  const resolvedWeight = freezePlannedWeights
    ? set.target_weight
    : set.percentage === null
      ? set.target_weight
      : calculatedWeight(set.percentage, effectiveMax?.value ?? null);
  const executionSet = { ...set, target_weight: resolvedWeight };
  const expected = expectedActualSet(executionSet);
  const actualField = compactActualField(mode, actualSet, expected, set.distance_unit);

  return (
    <div
      className={`strength-compact-set${actualSet?.completed ? " is-complete" : ""}`}
      role="listitem"
    >
      <span className="strength-compact-plan">{compactPlanText(executionSet, mode)}</span>
      {actualField && (
        <label className="strength-compact-actual">
          <span>Actual</span>
          <input
            aria-label={`${label} ${actualField.key.replace("actual_", "actual ")}`}
            type="number"
            min="0"
            step={actualField.key === "actual_reps" ? 1 : 0.01}
            value={actualField.value ?? ""}
            onChange={(event) => onChangeActual({
              [actualField.key]: event.target.value === "" ? null : Number(event.target.value),
            })}
          />
          <span>{actualField.unit}</span>
        </label>
      )}
      <button
        className="strength-complete-set"
        type="button"
        aria-label={`${actualSet?.completed ? "Mark incomplete" : "Complete"} ${label}`}
        aria-pressed={actualSet?.completed ?? false}
        onClick={() => onChangeActual({
          ...(actualSet ? {} : expected),
          completed: !(actualSet?.completed ?? false),
        })}
      >
        ✓
      </button>
    </div>
  );
}

function compactActualField(
  mode: PrescriptionMode,
  actual: ActualSet | null,
  expected: ActualSet,
  distanceUnit: DistanceUnit | null,
): { key: "actual_weight" | "actual_reps" | "actual_distance" | "actual_duration_seconds"; value: number | null; unit: string } | null {
  if (mode === "percentage" || mode === "fixed") {
    return { key: "actual_weight", value: actual?.actual_weight ?? expected.actual_weight, unit: "lb" };
  }
  if (mode === "reps") {
    return { key: "actual_reps", value: actual?.actual_reps ?? expected.actual_reps, unit: "reps" };
  }
  if (mode === "distance") {
    return { key: "actual_distance", value: actual?.actual_distance ?? expected.actual_distance, unit: distanceUnitLabel(distanceUnit) };
  }
  if (mode === "duration") {
    return { key: "actual_duration_seconds", value: actual?.actual_duration_seconds ?? expected.actual_duration_seconds, unit: "sec" };
  }
  return null;
}

function compactPlanText(set: PlannedSet, mode: PrescriptionMode): string {
  const reps = set.target_reps === null ? "— reps" : `${set.target_reps} reps`;
  if (mode === "percentage") {
    const percentage = set.percentage === null ? "—%" : `${formatWeight(set.percentage)}%`;
    const weight = set.target_weight === null ? "weight —" : `${formatWeight(set.target_weight)} lb planned`;
    return `${reps} · ${percentage} · ${weight}`;
  }
  if (mode === "fixed") {
    const weight = set.target_weight === null ? "Weight —" : `${formatWeight(set.target_weight)} lb`;
    return `${weight} × ${set.target_reps ?? "—"}`;
  }
  if (mode === "distance") {
    return `${formatWeight(set.target_distance ?? 0)} ${distanceUnitLabel(set.distance_unit)} planned`;
  }
  if (mode === "duration") return `${set.target_duration_seconds ?? "—"} sec planned`;
  return reps;
}

function SupplementalSummary({
  warmupBlocks,
  conditioningBlocks,
  exerciseNames,
}: {
  warmupBlocks: ExerciseBlock[];
  conditioningBlocks: ExerciseBlock[];
  exerciseNames: Map<string, string>;
}) {
  const warmupLabel = warmupBlocks[0]?.label ?? "Warm-up";
  const rounds = Math.max(0, ...warmupBlocks.map((block) => block.planned_sets.length));
  return (
    <div className="strength-supplemental">
      {warmupBlocks.length > 0 && (
        <details>
          <summary>{warmupLabel} · {rounds} {rounds === 1 ? "round" : "rounds"}</summary>
          <SupplementalBlockList blocks={warmupBlocks} exerciseNames={exerciseNames} />
        </details>
      )}
      <details>
        <summary>Conditioning · {conditioningBlocks.length === 0 ? "None" : `${conditioningBlocks.length} block${conditioningBlocks.length === 1 ? "" : "s"}`}</summary>
        {conditioningBlocks.length > 0 && (
          <SupplementalBlockList blocks={conditioningBlocks} exerciseNames={exerciseNames} />
        )}
      </details>
    </div>
  );
}

function SupplementalBlockList({
  blocks,
  exerciseNames,
}: {
  blocks: ExerciseBlock[];
  exerciseNames: Map<string, string>;
}) {
  return (
    <ul>
      {blocks.map((block) => (
        <li key={block.id}>
          <strong>{exerciseNames.get(block.exercise_id) ?? "Exercise"}</strong>
          <span>{supplementalPrescription(block)}</span>
        </li>
      ))}
    </ul>
  );
}

function supplementalPrescription(block: ExerciseBlock): string {
  const first = block.planned_sets[0];
  if (!first) return "No prescribed sets";
  if (first.target_distance !== null) {
    return `${block.planned_sets.length} × ${formatWeight(first.target_distance)} ${distanceUnitLabel(first.distance_unit)}`;
  }
  if (first.target_duration_seconds !== null) {
    return `${block.planned_sets.length} × ${first.target_duration_seconds} sec`;
  }
  return `${block.planned_sets.length} × ${first.target_reps ?? "—"} reps`;
}

function isWarmupBlock(block: ExerciseBlock): boolean {
  return block.label?.toLocaleLowerCase().startsWith("warm-up") ?? false;
}

function buildExerciseLabels(blocks: ExerciseBlock[]): Map<string, string> {
  const labels = new Map<string, string>();
  const groupNumbers = new Map<string, number>();
  let number = 0;
  for (const block of blocks) {
    let blockNumber: number;
    if (block.group_id) {
      const existing = groupNumbers.get(block.group_id);
      if (existing !== undefined) {
        blockNumber = existing;
      } else {
        number += 1;
        blockNumber = number;
        groupNumbers.set(block.group_id, blockNumber);
      }
    } else {
      number += 1;
      blockNumber = number;
    }
    const suffix = block.group_id
      ? block.label?.endsWith("2") ? "B" : "A"
      : "";
    labels.set(block.id, `${blockNumber}${suffix}.`);
  }
  return labels;
}

function exercisePrescriptionSummary(
  block: ExerciseBlock,
  maxSources: MaxSourceOption[],
): string {
  const first = block.planned_sets[0];
  if (!first) return "No sets";
  const details: string[] = [];
  if (first.target_reps !== null) details.push(`${first.target_reps} reps`);
  if (first.max_source) {
    details.push(`${maxSources.find((source) => source.key === first.max_source)?.label ?? first.max_source} max`);
  }
  return details.join(" · ");
}

function formatRest(block: ExerciseBlock): string {
  const seconds = block.planned_sets.find((set) => set.rest_seconds !== null)?.rest_seconds;
  if (seconds === null || seconds === undefined) return "";
  return seconds >= 120 && seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`;
}

interface PlannedSetRowProps {
  set: PlannedSet;
  mode: PrescriptionMode;
  exerciseName: string;
  showAdvanced: boolean;
  freezePlannedWeights: boolean;
  effectiveMax: StrengthMax | null;
  actualSet: ActualSet | null;
  onChange: (changes: Partial<PlannedSet>) => void;
  onChangeActual: (plannedSet: PlannedSet, changes: Partial<ActualSet>) => void;
  onRemove: () => void;
}

function PlannedSetRow({
  set,
  mode,
  exerciseName,
  showAdvanced,
  freezePlannedWeights,
  effectiveMax,
  actualSet,
  onChange,
  onChangeActual,
  onRemove,
}: PlannedSetRowProps) {
  const label = `${exerciseName} set ${set.set_number}`;
  const resolvedWeight = freezePlannedWeights
    ? set.target_weight
    : set.percentage === null
      ? set.target_weight
      : calculatedWeight(set.percentage, effectiveMax?.value ?? null);
  const executionSet = { ...set, target_weight: resolvedWeight };
  const expected = expectedActualSet(executionSet);
  return (
    <div className={`strength-set-row mode-${mode}`} data-layout="stacked-set">
      <strong className="strength-set-number"><span>Set </span>{set.set_number}</strong>
      <div className="strength-set-plan">
        <span className="strength-set-kind">Plan</span>
        {(mode === "percentage" || mode === "fixed" || mode === "reps") && (
          <NumberField label={`${label} reps`} shortLabel="Reps" value={set.target_reps} min={1} step={1} onChange={(value) => onChange({ target_reps: value })} />
        )}
        {mode === "percentage" && (
          <>
            <NumberField label={`${label} percentage`} shortLabel="%" value={set.percentage} min={0} max={500} onChange={(value) => onChange({ percentage: value })} />
            <span className={resolvedWeight === null ? "planned-weight missing-max" : "planned-weight"}>
              {resolvedWeight === null ? "Planned weight —" : `${formatWeight(resolvedWeight)} lb planned`}
            </span>
          </>
        )}
        {mode === "fixed" && (
          <NumberField label={`${label} weight`} shortLabel="Weight" value={set.target_weight} min={0} onChange={(value) => onChange({ target_weight: value })} />
        )}
        {mode === "distance" && (
          <>
            <NumberField label={`${label} distance`} shortLabel="Distance" value={set.target_distance} min={0.01} onChange={(value) => onChange({ target_distance: value })} />
            <DistanceUnitField label={label} value={set.distance_unit} onChange={(value) => onChange({ distance_unit: value })} />
            <NumberField label={`${label} weight`} shortLabel="Weight" value={set.target_weight} min={0} onChange={(value) => onChange({ target_weight: value })} />
          </>
        )}
        {mode === "duration" && (
          <>
            <NumberField label={`${label} duration seconds`} shortLabel="Duration (sec)" value={set.target_duration_seconds} min={1} step={1} onChange={(value) => onChange({ target_duration_seconds: value })} />
            <NumberField label={`${label} weight`} shortLabel="Weight" value={set.target_weight} min={0} onChange={(value) => onChange({ target_weight: value })} />
          </>
        )}
      </div>
      <div className="strength-set-actual">
        <span className="strength-set-kind">Actual</span>
        {(mode === "percentage" || mode === "fixed") && (
          <NumberField
            label={`${label} actual weight`}
            shortLabel="Weight"
            value={actualSet ? actualSet.actual_weight : expected.actual_weight}
            min={0}
            onChange={(value) => onChangeActual(executionSet, { actual_weight: value })}
          />
        )}
        {(mode === "percentage" || mode === "fixed" || mode === "reps") && (
          <NumberField
            label={`${label} actual reps`}
            shortLabel="Reps"
            value={actualSet ? actualSet.actual_reps : expected.actual_reps}
            min={0}
            step={1}
            onChange={(value) => onChangeActual(executionSet, { actual_reps: value })}
          />
        )}
        {mode === "distance" && (
          <>
            <NumberField
              label={`${label} actual distance`}
              shortLabel={`Distance (${distanceUnitLabel(set.distance_unit)})`}
              value={actualSet ? actualSet.actual_distance : expected.actual_distance}
              min={0}
              onChange={(value) => onChangeActual(executionSet, { actual_distance: value })}
            />
            <NumberField
              label={`${label} actual weight`}
              shortLabel="Weight"
              value={actualSet ? actualSet.actual_weight : expected.actual_weight}
              min={0}
              onChange={(value) => onChangeActual(executionSet, { actual_weight: value })}
            />
          </>
        )}
        {mode === "duration" && (
          <>
            <NumberField
              label={`${label} actual duration seconds`}
              shortLabel="Duration (sec)"
              value={actualSet ? actualSet.actual_duration_seconds : expected.actual_duration_seconds}
              min={0}
              step={1}
              onChange={(value) => onChangeActual(executionSet, { actual_duration_seconds: value })}
            />
            <NumberField
              label={`${label} actual weight`}
              shortLabel="Weight"
              value={actualSet ? actualSet.actual_weight : expected.actual_weight}
              min={0}
              onChange={(value) => onChangeActual(executionSet, { actual_weight: value })}
            />
          </>
        )}
        <button
          className="strength-complete-set"
          type="button"
          aria-label={`${actualSet?.completed ? "Mark incomplete" : "Complete"} ${label}`}
          aria-pressed={actualSet?.completed ?? false}
          onClick={() => onChangeActual(executionSet, {
            ...(actualSet ? {} : expected),
            completed: !(actualSet?.completed ?? false),
          })}
        >
          ✓
        </button>
      </div>
      <button className="delete-session-button" type="button" aria-label={`Remove ${label}`} onClick={onRemove}>×</button>
      {showAdvanced && (
        <div className="strength-set-advanced">
          <NumberField label={`${label} rest seconds`} shortLabel="Rest (sec)" value={set.rest_seconds} min={0} step={1} onChange={(value) => onChange({ rest_seconds: value })} />
          {mode === "percentage" && (
            <NumberField label={`${label} weight`} shortLabel="Resolved weight" value={set.target_weight} min={0} onChange={(value) => onChange({ target_weight: value })} />
          )}
          {mode !== "distance" && (
            <>
              <NumberField label={`${label} distance`} shortLabel="Distance" value={set.target_distance} min={0.01} onChange={(value) => onChange({ target_distance: value })} />
              <DistanceUnitField label={label} value={set.distance_unit} onChange={(value) => onChange({ distance_unit: value })} />
            </>
          )}
          {mode !== "duration" && (
            <NumberField label={`${label} duration seconds`} shortLabel="Duration (sec)" value={set.target_duration_seconds} min={1} step={1} onChange={(value) => onChange({ target_duration_seconds: value })} />
          )}
        </div>
      )}
    </div>
  );
}

function DistanceUnitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DistanceUnit | null;
  onChange: (value: DistanceUnit | null) => void;
}) {
  return (
    <label className="strength-set-field">
      <span className="strength-field-label">Unit</span>
      <select aria-label={`${label} distance unit`} value={value ?? ""} onChange={(event) => onChange((event.target.value || null) as DistanceUnit | null)}>
        <option value="">—</option>
        <option value="yards">Yards</option>
        <option value="meters">Meters</option>
      </select>
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  shortLabel: string;
  value: number | null;
  min: number;
  max?: number;
  step?: number;
  onChange: (value: number | null) => void;
}

function NumberField({ label, shortLabel, value, min, max, step = 0.01, onChange }: NumberFieldProps) {
  return (
    <label className="strength-set-field">
      <span className="strength-field-label">{shortLabel}</span>
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

function copyPlannedSet(previous: PlannedSet | undefined, setNumber: number): PlannedSet {
  if (!previous) return { ...emptyPlannedSet(setNumber), target_reps: 5 };
  return {
    ...previous,
    id: newId(),
    set_number: setNumber,
  };
}

function inferPrescriptionMode(sets: PlannedSet[]): PrescriptionMode {
  if (sets.some((set) => hasOptionalValue(set.percentage) || hasOptionalValue(set.max_source))) return "percentage";
  if (sets.some((set) => hasOptionalValue(set.target_distance) || hasOptionalValue(set.distance_unit))) return "distance";
  if (sets.some((set) => hasOptionalValue(set.target_duration_seconds) && !hasOptionalValue(set.target_reps))) return "duration";
  if (sets.some((set) => hasOptionalValue(set.target_weight))) return "fixed";
  return "reps";
}

function hasOptionalValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function setForMode(
  set: PlannedSet,
  mode: PrescriptionMode,
  defaultMaxSource: string | null,
): PlannedSet {
  const base = {
    ...set,
    target_reps: null,
    target_distance: null,
    distance_unit: null,
    target_duration_seconds: null,
    percentage: null,
    max_source: null,
    max_value_at_creation: null,
    target_weight: null,
  };
  if (mode === "percentage") {
    return {
      ...base,
      target_reps: set.target_reps ?? 5,
      percentage: set.percentage ?? 50,
      max_source: set.max_source ?? defaultMaxSource,
      target_weight: set.target_weight,
    };
  }
  if (mode === "fixed") {
    return { ...base, target_reps: set.target_reps ?? 5, target_weight: set.target_weight ?? 0 };
  }
  if (mode === "distance") {
    return {
      ...base,
      target_distance: set.target_distance ?? 20,
      distance_unit: set.distance_unit ?? "yards",
      target_weight: set.target_weight,
    };
  }
  if (mode === "duration") {
    return {
      ...base,
      target_duration_seconds: set.target_duration_seconds ?? 30,
      target_weight: set.target_weight,
    };
  }
  return { ...base, target_reps: set.target_reps ?? 5 };
}

function findEffectiveMax(
  history: StrengthMax[],
  source: string,
  sessionDate: string,
): StrengthMax | null {
  return history
    .filter((item) => item.exercise_key === source && item.effective_date <= sessionDate)
    .sort((left, right) => (
      right.effective_date.localeCompare(left.effective_date)
      || right.created_at.localeCompare(left.created_at)
    ))[0] ?? null;
}

function calculatedWeight(percentage: number, maxValue: number | null): number | null {
  if (maxValue === null) return null;
  return Math.round((percentage * maxValue / 100) / 5) * 5;
}

function snapshotPercentageSet(
  set: PlannedSet,
  sessionDate: string,
  history: StrengthMax[],
): PlannedSet {
  if (set.percentage === null || set.max_source === null) return set;
  const effectiveMax = findEffectiveMax(history, set.max_source, sessionDate);
  return {
    ...set,
    max_value_at_creation: effectiveMax?.value ?? null,
    target_weight: calculatedWeight(set.percentage, effectiveMax?.value ?? null),
  };
}

function snapshotPercentageSets(
  block: ExerciseBlock,
  sessionDate: string,
  history: StrengthMax[],
): ExerciseBlock {
  return {
    ...block,
    planned_sets: block.planned_sets.map((set) => (
      snapshotPercentageSet(set, sessionDate, history)
    )),
  };
}

function expectedActualSet(set: PlannedSet): ActualSet {
  return {
    planned_set_id: set.id,
    actual_reps: set.target_reps,
    actual_distance: set.target_distance,
    actual_duration_seconds: set.target_duration_seconds,
    actual_weight: set.target_weight,
    completed: false,
    notes: null,
  };
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function distanceUnitLabel(unit: DistanceUnit | null): string {
  if (unit === "yards") return "yd";
  if (unit === "meters") return "m";
  return "distance";
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

function normalizeBlockForSave(block: ExerciseBlock): ExerciseBlock {
  return {
    id: block.id.trim(),
    exercise_id: block.exercise_id.trim(),
    order: block.order,
    group_id: normalizeOptionalText(block.group_id),
    label: normalizeOptionalText(block.label),
    planned_sets: block.planned_sets.map((set) => ({
      id: set.id.trim(),
      set_number: set.set_number,
      target_reps: normalizeOptionalNumber(set.target_reps),
      target_distance: normalizeOptionalNumber(set.target_distance),
      distance_unit: normalizeOptionalText(set.distance_unit) as DistanceUnit | null,
      target_duration_seconds: normalizeOptionalNumber(set.target_duration_seconds),
      percentage: normalizeOptionalNumber(set.percentage),
      max_source: normalizeOptionalText(set.max_source),
      max_value_at_creation: normalizeOptionalNumber(set.max_value_at_creation),
      target_weight: normalizeOptionalNumber(set.target_weight),
      rest_seconds: normalizeOptionalNumber(set.rest_seconds),
    })),
    actual_sets: block.actual_sets.map((set) => ({
      planned_set_id: set.planned_set_id.trim(),
      actual_reps: normalizeOptionalNumber(set.actual_reps),
      actual_distance: normalizeOptionalNumber(set.actual_distance),
      actual_duration_seconds: normalizeOptionalNumber(set.actual_duration_seconds),
      actual_weight: normalizeOptionalNumber(set.actual_weight),
      completed: set.completed,
      notes: normalizeOptionalText(set.notes),
    })),
  };
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
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
