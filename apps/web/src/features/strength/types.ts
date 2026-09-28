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
