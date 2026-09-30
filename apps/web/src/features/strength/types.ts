export interface StrengthMax {
  id: string;
  exercise_key: string;
  value: number;
  effective_date: string;
  created_at: string;
}

export interface StrengthMaxCollection {
  current: StrengthMax[];
  history: StrengthMax[];
}

export interface StrengthMaxUpsert {
  value: number;
  effective_date: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  default_max_source: string | null;
  is_custom: boolean;
}

export interface ExerciseCreate {
  name: string;
  category: string;
  default_max_source?: string | null;
}

export type DistanceUnit = "yards" | "meters";

export interface PlannedSet {
  id: string;
  set_number: number;
  target_reps: number | null;
  target_distance: number | null;
  distance_unit: DistanceUnit | null;
  target_duration_seconds: number | null;
  percentage: number | null;
  max_source: string | null;
  max_value_at_creation: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
}

export interface ActualSet {
  planned_set_id: string;
  actual_reps: number | null;
  actual_distance: number | null;
  actual_duration_seconds: number | null;
  actual_weight: number | null;
  completed: boolean;
  notes: string | null;
}

export interface ExerciseBlock {
  id: string;
  exercise_id: string;
  order: number;
  group_id: string | null;
  label: string | null;
  planned_sets: PlannedSet[];
  actual_sets: ActualSet[];
}

export interface StrengthSession {
  id: string;
  date: string;
  title: string;
  notes: string | null;
  exercise_blocks: ExerciseBlock[];
}

export interface StrengthWeek {
  week_start: string;
  week_end: string;
  sessions: StrengthSession[];
}

export type PlannedSetInput = Omit<PlannedSet, "id"> & { id?: string };
export type ExerciseBlockInput = Omit<ExerciseBlock, "id" | "planned_sets"> & {
  id?: string;
  planned_sets: PlannedSetInput[];
};

export interface StrengthSessionCreate {
  date: string;
  title: string;
  notes?: string | null;
  exercise_blocks?: ExerciseBlockInput[];
}

export interface StrengthSessionUpdate {
  date?: string;
  title?: string;
  notes?: string | null;
  exercise_blocks?: ExerciseBlockInput[];
}
