/** 食品追加画面で使用するURL値の検証と遷移先URLの生成を担当する。 */
import { 
  isMealDate,
  isMealType,
  type MealType
} from "@/lib/meals";

export type MealNavigationContext = {
  mealDate: string;
  mealType: MealType;
};

export function parseMealNavigationContext(
  date: string | string[] | undefined,
  mealType: string | string[] | undefined,
): MealNavigationContext | null {
  if (typeof date !== "string" || typeof mealType !== "string") {
    return null
  }

  if (!isMealDate(date) || !isMealType(mealType)) {
    return null;
  }

  return { mealDate: date, mealType };
}

export function buildRecordHref(mealDate: string, mealType: MealType): string {
  const searchParams = new URLSearchParams({ date: mealDate, mealType });

  return `/record?${searchParams.toString()}`;
}

export function buildDashboardHref(mealDate: string): string {
  const searchParams = new URLSearchParams({ date: mealDate });

  return `/?${searchParams.toString()}`;
}