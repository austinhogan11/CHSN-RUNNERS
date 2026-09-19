export type WorkoutStatus = "planned" | "completed" | "skipped";
export type WorkoutType = "run" | "rest" | "strength" | "cross_training" | "other";

export interface Workout {
  id: string;
  date: string;
  type: WorkoutType;
  title: string | null;
  description: string | null;

  planned_distance: number | null;

  start_time: string | null;
  duration_seconds: number | null;
  distance: number | null;

  status: WorkoutStatus;
}

export interface WeekSummary {
  week_start: string;
  planned_distance: number;
  actual_distance: number;
  workouts: Workout[];
}

export interface MileageTrendPoint {
  week_start: string;
  planned_distance: number;
  actual_distance: number;
}
