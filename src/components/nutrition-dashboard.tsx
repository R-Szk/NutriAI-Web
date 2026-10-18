"use client";

/** 記録日と匿名認証状態を管理し、配下の食事機能へ共有する親コンポーネント。 */
import { useState } from "react";
import { useAnonymousSession } from "@/hooks/use-anonymous-session";
import { getLocalDateString } from "@/lib/meals";
import MealTimeline from "./meal-timeline";
import DailyNutritionSummary from "./daily-nutrition-summary";
import { useDailyMeals } from "@/hooks/use-daily-meals";
import { calculateDailyNutrientTotals } from "@/lib/daily-nutrition";

type NutritionDashboardProps = {
    initialMealDate?: string;
};

export default function NutritionDashboard({
    initialMealDate,
}: NutritionDashboardProps) {
    // UTC変換による日付ずれを避け、ブラウザのローカル日付を初期値にする。
    const [mealDate, setMealDate] = useState(() => initialMealDate ?? getLocalDateString(new Date()));

    const {
        userId,
        isAuthLoading,
        authError,
    } = useAnonymousSession();

    const {
        meals,
        isLoading: isMealsLoading,
        loadError,
    } = useDailyMeals(userId, mealDate);

    const dailyTotals = calculateDailyNutrientTotals(
        meals.flatMap((meal) => meal.items),
    );

    return (
        <>
            <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-gray-600">記録日</p>
                    <p className="mt-1 font-semibold">食事と栄養を確認する日</p>
                </div>

                <label htmlFor="meal-date">
                    <span className="sr-only">記録日を選択</span>
                    <input
                        id="meal-date"
                        className="max-w-40 rounded-xl border border-gray-200 px-3 py-2 text-sm fond-medium"
                        type="date"
                        value={mealDate}
                        onChange={(event) => setMealDate(event.target.value)}
                    />
                </label>

                {isAuthLoading && (
                    <p className="mt-3 text-sm text-gray-600">記録機能を準備しています...</p>
                )}

                {authError && (
                    <p className="mt-3 text-sm text-red-700">匿名認証に失敗しました: {authError}</p>
                )}

            </section>

            {!isMealsLoading && !loadError && (
                <DailyNutritionSummary totals={dailyTotals} />
            )}

            {!userId && !isAuthLoading && !authError && (
                <p className="mt-8 text-gray-600">記録機能を準備しています...</p>
            )}

            {isMealsLoading && (
                <p className="mt-8 text-gray-600">食事記録を読み込んでいます...</p>
            )}

            {loadError && (
                <p className="mt-8 text-red-700">{loadError}</p>
            )}

            {userId && !isMealsLoading && !loadError && (
                <MealTimeline meals={meals} mealDate={mealDate} />
            )}
        </>
    );
}
