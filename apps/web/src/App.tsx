import { useEffect, useState } from "react";

import { getWeek } from "./features/workouts/api";
import { WeekSummary } from "./features/workouts/components/WeekSummary";
import { WorkoutList } from "./features/workouts/components/WorkoutList";
import type { WeekSummary as WeekSummaryData } from "./features/workouts/types";

function App() {
  const [week, setWeek] = useState<WeekSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    getWeek(today)
      .then(setWeek)
      .catch(() => {
        setError("Unable to load this week's workouts.");
      });
  }, []);

  if (error) {
    return <main>{error}</main>;
  }

  if (!week) {
    return <main>Loading workouts...</main>;
  }

  return (
    <main>
      <h1>Runner</h1>

      <WeekSummary summary={week} />

      <WorkoutList workouts={week.workouts} />
    </main>
  );
}

export default App;