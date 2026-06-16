export type Sex = 'male' | 'female';
export type Goal = 'cutting' | 'maintenance' | 'bulking';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export type FoodSource = 'scan' | 'ai_photo' | 'search' | 'manual';
export type Units = 'metric' | 'imperial';

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal: Goal;
  activity_level: ActivityLevel;
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  calorie_override: number | null;
  units: Units;
  wake_time: string;
  sleep_time: string;
}

export interface ProfileInput {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal: Goal;
  activity_level: ActivityLevel;
}

export interface Targets {
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
}

export interface FoodEntry {
  id: string;
  log_date: string;
  meal: Meal;
  food_name: string;
  serving_size: string | null;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: FoodSource;
  logged_at: string;
}

export interface FoodSaveFields {
  food_name: string;
  serving_size: string | null;
  meal: Meal;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: FoodSource;
}

export interface FoodDraft {
  food_name: string;
  serving_size: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: FoodSource;
  confidence?: 'high' | 'medium' | 'low';
  note?: string;
  /** false when a scanned product had no nutriment data */
  has_macros?: boolean;
  /** per-gram nutrition basis, when known, used to recalculate on serving change */
  perGram?: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}

export interface WeightEntry {
  id: string;
  log_date: string;
  weight_kg: number;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export interface SearchResult {
  name: string;
  brand: string | null;
  serving_size: string | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  kcal_serving: number | null;
  protein_serving: number | null;
  carbs_serving: number | null;
  fat_serving: number | null;
}
