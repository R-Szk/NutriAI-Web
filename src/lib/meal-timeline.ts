/** DBの食事記録を、表示用の固定4区分へ変換する。 */
import {
  MEAL_TYPE_LABELS,
  type MealType,
} from "@/lib/meals";
import type { DailyMeal } from "@/lib/supabase/meal-records";

export type MealTimelineEntry = {
  mealType: MealType;
  label: string;
  meal: DailyMeal | null;
};

const MEAL_TYPE_ORDER: MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

export function createMealTimeline(meals: DailyMeal[]): MealTimelineEntry[] {
  return MEAL_TYPE_ORDER.map((mealType) => ({
    mealType,
    label: MEAL_TYPE_LABELS[mealType],
    meal: meals.find((meal) => meal.mealType === mealType) ?? null,
  }));
}