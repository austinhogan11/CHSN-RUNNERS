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
import { formatLocalDate } from "./utils/date";
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
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const today = useMemo(() => formatLocalDate(new Date()), []);

  async function requireToken(): Promise<string> {
    const token = await getToken();
    if (!token) {
      throw new WorkoutApiError("No active Clerk session token", 401);
    }
    return token;
  }

  const refreshDashboard = useCallback(async (token: string): Promise<void> => {
    const [weekData, trendData] = await Promise.all([
      getWeek(today, token),
      getMileageTrend(today, token),
    ]);
    setWeek(weekData);
    setTrend(trendData);
  }, [today]);

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

  async function refreshAfterMutation(token: string): Promise<void> {
    setRefreshNotice(null);
    try {
      await refreshDashboard(token);
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

      <WeekSummary summary={week} />

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
        workout.status === "completed" ? total + (workout.distance ?? 0) : total
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
