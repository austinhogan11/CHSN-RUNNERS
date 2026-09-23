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
import { WeekSummary } from "./features/workouts/components/WeekSummary";
import { WorkoutList } from "./features/workouts/components/WorkoutList";
import type {
  MileageTrendPoint,
  WeekSummary as WeekSummaryData,
  Workout,
  WorkoutCreate,
  WorkoutUpdate,
} from "./features/workouts/types";
import { hasActualExecution } from "./features/workouts/utils";
import { addCalendarDays, formatLocalDate, formatWeekRange, getMondayWeekStart } from "./utils/date";
import "./App.css";

function App() {
  return (
    <>
      <Show when="signed-out">
        <SignInExperience />
      </Show>
      <Show when="signed-in">
        <Dashboard />
      </Show>
    </>
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
  const [week, setWeek] = useState<WeekSummaryData | null>(null);
  const [trend, setTrend] = useState<MileageTrendPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const currentWeekStart = useMemo(() => getMondayWeekStart(today), [today]);
  const [displayedWeekStart, setDisplayedWeekStart] = useState(currentWeekStart);

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
      getMileageTrend(today, token),
    ]);
    setWeek(weekData);
    setTrend(trendData);
  }, [currentWeekStart, today]);

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

  async function navigateToWeek(targetWeekStart: string): Promise<void> {
    if (isWeekLoading || targetWeekStart === displayedWeekStart) return;
    setIsWeekLoading(true);
    setWeekError(null);
    try {
      const token = await requireToken();
      const weekData = await getWeek(targetWeekStart, token);
      setWeek(weekData);
      setDisplayedWeekStart(targetWeekStart);
    } catch {
      setWeekError("Unable to load selected week.");
    } finally {
      setIsWeekLoading(false);
    }
  }

  async function refreshAfterMutation(token: string): Promise<void> {
    setRefreshNotice(null);
    try {
      const [weekData, trendData] = await Promise.all([
        getWeek(displayedWeekStart, token),
        getMileageTrend(today, token),
      ]);
      setWeek(weekData);
      setTrend(trendData);
    } catch {
      setRefreshNotice("Change saved. Updated trend data could not be loaded.");
    }
  }

  if (error) {
    return (
      <main className="dashboard">
        <DashboardHeader />
        <p className="panel page-message" role="alert">{error}</p>
      </main>
    );
  }

  if (!week || !trend) {
    return (
      <main className="dashboard">
        <DashboardHeader />
        <p className="panel page-message" role="status">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <DashboardHeader />

      <MileageTrend points={trend} />

      <nav className="week-navigation" aria-label="Week navigation">
        <button type="button" aria-label="Previous week" disabled={isWeekLoading} onClick={() => navigateToWeek(addCalendarDays(displayedWeekStart, -7))}>‹</button>
        <strong>{formatWeekRange(displayedWeekStart)}</strong>
        <button type="button" aria-label="Next week" disabled={isWeekLoading} onClick={() => navigateToWeek(addCalendarDays(displayedWeekStart, 7))}>›</button>
        {displayedWeekStart !== currentWeekStart && (
          <button className="current-week-button" type="button" disabled={isWeekLoading} onClick={() => navigateToWeek(currentWeekStart)}>Current week</button>
        )}
      </nav>

      {isWeekLoading && <p className="week-navigation-status" role="status">Loading week…</p>}
      {weekError && <p className="week-navigation-status error" role="alert">{weekError}</p>}

      <WeekSummary summary={week} isCurrentWeek={displayedWeekStart === currentWeekStart} />

      {refreshNotice && <p className="mutation-notice" role="status">{refreshNotice}</p>}

      <WorkoutList
        weekStart={week.week_start}
        workouts={week.workouts}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </main>
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

function DashboardHeader() {
  return (
    <header className="dashboard-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">R</span>
        <h1>Runner</h1>
      </div>
      <div className="account-control" aria-label="Runner account">
        <UserButton />
      </div>
    </header>
  );
}

export default App;
