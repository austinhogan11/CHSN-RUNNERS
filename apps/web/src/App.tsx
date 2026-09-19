import { Show, SignIn, UserButton, useAuth } from "@clerk/react";
import { useEffect, useState } from "react";

import { getMileageTrend, getWeek } from "./features/workouts/api";
import { MileageTrend } from "./features/workouts/components/MileageTrend";
import { WeekSummary } from "./features/workouts/components/WeekSummary";
import { WorkoutList } from "./features/workouts/components/WorkoutList";
import type {
  MileageTrendPoint,
  WeekSummary as WeekSummaryData,
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

  useEffect(() => {
    const today = formatLocalDate(new Date());

    getToken()
      .then((token) => {
        if (!token) {
          throw new Error("No active Clerk session token");
        }

        return Promise.all([
          getWeek(today, token),
          getMileageTrend(today, token),
        ]);
      })
      .then(([weekData, trendData]) => {
        setWeek(weekData);
        setTrend(trendData);
      })
      .catch(() => {
        setError("Unable to load runner dashboard.");
      });
  }, [getToken]);

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

      <WorkoutList weekStart={week.week_start} workouts={week.workouts} />
    </main>
  );
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
