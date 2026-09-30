import { Show, SignIn, UserButton, useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createWorkout,
  deleteWorkout,
  getMileageTrend,
  getWeek,
  updateWorkout,
  WorkoutApiError,
} from "./features/workouts/api";
import { MileageTrend } from "./features/workouts/components/MileageTrend";
import { WorkoutList } from "./features/workouts/components/WorkoutList";
import type {
  MileageTrendPoint,
  WeekSummary as WeekSummaryData,
  Workout,
  WorkoutCreate,
  WorkoutUpdate,
} from "./features/workouts/types";
import { hasActualExecution } from "./features/workouts/utils";
import { StrengthPage } from "./features/strength/components/StrengthPage";
import { useWeekNavigation } from "./features/training/useWeekNavigation";
import { addCalendarDays, formatLocalDate, getMondayWeekStart } from "./utils/date";
import "./App.css";

type TrainingMode = "running" | "strength";
type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "runner-theme";

function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <>
      <Show when="signed-out">
        <SignInExperience />
      </Show>
      <Show when="signed-in">
        <AuthenticatedApp
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")}
        />
      </Show>
    </>
  );
}

interface AuthenticatedAppProps {
  theme: Theme;
  onToggleTheme: () => void;
}

function AuthenticatedApp({ theme, onToggleTheme }: AuthenticatedAppProps) {
  const [mode, setMode] = useState<TrainingMode>(() => modeForPath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setMode(modeForPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextMode: TrainingMode) {
    if (nextMode === mode) return;
    const path = nextMode === "strength" ? "/strength" : "/";
    window.history.pushState({}, "", path);
    setMode(nextMode);
  }

  return (
    <main className="dashboard">
      <DashboardHeader
        mode={mode}
        theme={theme}
        onNavigate={navigate}
        onToggleTheme={onToggleTheme}
      />
      {mode === "strength" ? <StrengthPage /> : <Dashboard />}
    </main>
  );
}

function SignInExperience() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <div className="brand auth-brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <h1>Runner</h1>
        </div>
        <h2 id="sign-in-heading">Sign in to Runner</h2>
        <p>Continue with Google to view your training.</p>
        <SignIn withSignUp />
      </section>
    </main>
  );
}

function Dashboard() {
  const { getToken } = useAuth();
  const [trend, setTrend] = useState<MileageTrendPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [isTrendLoading, setIsTrendLoading] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const currentWeekStart = useMemo(() => getMondayWeekStart(today), [today]);
  const [trendEndWeekStart, setTrendEndWeekStart] = useState(currentWeekStart);

  const loadRunningWeek = useCallback(async (weekStart: string): Promise<WeekSummaryData> => {
    const token = await getToken();
    if (!token) throw new WorkoutApiError("No active Clerk session token", 401);
    return getWeek(weekStart, token);
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
    loadWeek: loadRunningWeek,
  });

  async function requireToken(): Promise<string> {
    const token = await getToken();
    if (!token) {
      throw new WorkoutApiError("No active Clerk session token", 401);
    }
    return token;
  }

  const refreshDashboard = useCallback(async (token: string): Promise<void> => {
    const [weekData, trendData] = await Promise.all([
      getWeek(currentWeekStart, token),
      getMileageTrend(addCalendarDays(currentWeekStart, 6), token),
    ]);
    setWeek(weekData);
    setTrend(trendData);
  }, [currentWeekStart, setWeek]);

  useEffect(() => {
    getToken()
      .then((token) => {
        if (!token) {
          throw new Error("No active Clerk session token");
        }
        return refreshDashboard(token);
      })
      .catch(() => {
        setError("Unable to load runner dashboard.");
      });
  }, [getToken, refreshDashboard]);

  async function handleCreate(workout: WorkoutCreate): Promise<void> {
    const token = await requireToken();
    const created = await createWorkout(workout, token);
    setWeek((current) => updateWeek(current, (workouts) => [...workouts, created]));
    await refreshAfterMutation(token);
  }

  async function handleUpdate(
    workoutId: string,
    changes: WorkoutUpdate,
  ): Promise<void> {
    const token = await requireToken();
    const updated = await updateWorkout(workoutId, changes, token);
    setWeek((current) => updateWeek(
      current,
      (workouts) => workouts.map((workout) => (
        workout.id === workoutId ? updated : workout
      )),
    ));
    await refreshAfterMutation(token);
  }

  async function handleDelete(workoutId: string): Promise<void> {
    const token = await requireToken();
    await deleteWorkout(workoutId, token);
    setWeek((current) => updateWeek(
      current,
      (workouts) => workouts.filter((workout) => workout.id !== workoutId),
    ));
    await refreshAfterMutation(token);
  }

  async function navigateTrend(targetEndWeekStart: string): Promise<void> {
    if (isTrendLoading || targetEndWeekStart > currentWeekStart || targetEndWeekStart === trendEndWeekStart) return;
    setIsTrendLoading(true);
    setTrendError(null);
    try {
      const token = await requireToken();
      const trendData = await getMileageTrend(addCalendarDays(targetEndWeekStart, 6), token);
      setTrend(trendData);
      setTrendEndWeekStart(targetEndWeekStart);
    } catch {
      setTrendError("Unable to load mileage trend.");
    } finally {
      setIsTrendLoading(false);
    }
  }

  async function refreshAfterMutation(token: string): Promise<void> {
    setRefreshNotice(null);
    try {
      const [weekData, trendData] = await Promise.all([
        getWeek(displayedWeekStart, token),
        getMileageTrend(addCalendarDays(trendEndWeekStart, 6), token),
      ]);
      setWeek(weekData);
      setTrend(trendData);
    } catch {
      setRefreshNotice("Change saved. Updated trend data could not be loaded.");
    }
  }

  if (error) {
    return (
      <p className="panel page-message" role="alert">{error}</p>
    );
  }

  if (!week || !trend) {
    return (
      <p className="panel page-message" role="status">Loading dashboard...</p>
    );
  }

  return (
    <>
      <MileageTrend
        points={trend}
        isLoading={isTrendLoading}
        error={trendError}
        isLatestWindow={trendEndWeekStart === currentWeekStart}
        onPrevious={() => navigateTrend(addCalendarDays(trendEndWeekStart, -7))}
        onNext={() => navigateTrend(addCalendarDays(trendEndWeekStart, 7))}
      />

      {refreshNotice && <p className="mutation-notice" role="status">{refreshNotice}</p>}

      <WorkoutList
        weekStart={week.week_start}
        workouts={week.workouts}
        actualDistance={week.actual_distance}
        isCurrentWeek={isCurrentWeek}
        isWeekLoading={isWeekLoading}
        weekError={weekError}
        onPreviousWeek={showPreviousWeek}
        onNextWeek={showNextWeek}
        onCurrentWeek={showCurrentWeek}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}

function updateWeek(
  current: WeekSummaryData | null,
  transform: (workouts: Workout[]) => Workout[],
): WeekSummaryData | null {
  if (!current) {
    return current;
  }

  const workouts = transform(current.workouts);
  return {
    ...current,
    workouts,
    planned_distance: workouts.reduce(
      (total, workout) => total + (workout.planned_distance ?? 0),
      0,
    ),
    actual_distance: workouts.reduce(
      (total, workout) => (
        hasActualExecution(workout) ? total + (workout.distance ?? 0) : total
      ),
      0,
    ),
  };
}

interface DashboardHeaderProps {
  mode: TrainingMode;
  theme: Theme;
  onNavigate: (mode: TrainingMode) => void;
  onToggleTheme: () => void;
}

function DashboardHeader({ mode, theme, onNavigate, onToggleTheme }: DashboardHeaderProps) {
  return (
    <header className="dashboard-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">R</span>
        <h1>Runner</h1>
      </div>
      <nav className="training-mode-navigation" aria-label="Training mode">
        <a
          href="/"
          aria-current={mode === "running" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onNavigate("running");
          }}
        >
          Running
        </a>
        <a
          href="/strength"
          aria-current={mode === "strength" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onNavigate("strength");
          }}
        >
          Strength
        </a>
      </nav>
      <div className="account-control" aria-label="Runner account">
        <button
          className="theme-toggle"
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={onToggleTheme}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
        </button>
        <UserButton />
      </div>
    </header>
  );
}

function modeForPath(pathname: string): TrainingMode {
  return pathname === "/strength" ? "strength" : "running";
}

function initialTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default App;
