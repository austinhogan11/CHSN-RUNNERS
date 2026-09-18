import { useEffect, useState } from "react";

import { getMileageTrend, getWeek } from "./features/workouts/api";
import { MileageTrend } from "./features/workouts/components/MileageTrend";
import { WeekSummary } from "./features/workouts/components/WeekSummary";
import { WorkoutList } from "./features/workouts/components/WorkoutList";
import type {
  MileageTrendPoint,
  WeekSummary as WeekSummaryData,
} from "./features/workouts/types";

function App() {
  const [week, setWeek] = useState<WeekSummaryData | null>(null);
  const [trend, setTrend] = useState<MileageTrendPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

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
    return <main>{error}</main>;
  }

  if (!week || !trend) {
    return <main>Loading dashboard...</main>;
  }

  return (
    <main>
      <h1>Runner</h1>

      <MileageTrend points={trend} />

      <WeekSummary summary={week} />

      <WorkoutList workouts={week.workouts} />
    </main>
  );
}

export default App;