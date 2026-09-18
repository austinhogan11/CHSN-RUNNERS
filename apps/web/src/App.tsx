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
  const [week, setWeek] = useState<WeekSummaryData | null>(null);
  const [trend, setTrend] = useState<MileageTrendPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = formatLocalDate(new Date());

    Promise.all([
      getWeek(today),
      getMileageTrend(today),
    ])
      .then(([weekData, trendData]) => {
        setWeek(weekData);
        setTrend(trendData);
      })
      .catch(() => {
        setError("Unable to load runner dashboard.");
      });
  }, []);

  if (error) {
    return (
      <main className="dashboard">
        <h1>Runner</h1>
        <p className="panel page-message" role="alert">{error}</p>
      </main>
    );
  }

  if (!week || !trend) {
    return (
      <main className="dashboard">
        <h1>Runner</h1>
        <p className="panel page-message" role="status">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <h1>Runner</h1>
        </div>
      </header>

      <MileageTrend points={trend} />

      <WeekSummary summary={week} />

      <WorkoutList weekStart={week.week_start} workouts={week.workouts} />
    </main>
  );
}

export default App;
