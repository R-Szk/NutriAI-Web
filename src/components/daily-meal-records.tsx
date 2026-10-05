"use client";

/**
 * 選択日の食事を取得し、食事区分ごとに食品と主要栄養素を表示する。
 * refreshVersionが変わるたび、保存後の最新データを再取得する。
 */
import { useEffect, useState } from "react";
import { calculateNutrientAmount } from "@/lib/food-search";
import { MEAL_TYPE_LABELS } from "@/lib/meals";
import { type DailyMeal, fetchDailyMeals } from "@/lib/supabase/meal-records";
import { calculateDailyNutrientTotals } from "@/lib/daily-nutrition";

type DailyMealRecordsProps = {
    userId: string | null;
    mealDate: string;
    refreshVersion: number;
};

export default function DailyMealRecords({userId, mealDate, refreshVersion}: DailyMealRecordsProps) {
    const [meals, setMeals] = useState<DailyMeal[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            return;
        }

        const authenticatedUserId = userId;
        let isMounted = true;

        async function loadMeals() {
            setIsLoading(true);
            setLoadError(null);

            try {
                const dailyMeals = await fetchDailyMeals(authenticatedUserId, mealDate);

                if (isMounted) {
                    setMeals(dailyMeals);
                }
            } catch (error) {
                if (isMounted) {
                    setMeals([]);
                    setLoadError(error instanceof Error ? error.message : "食事記録の取得に失敗しました");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        void loadMeals();

        return () => {
            isMounted = false
        };
    }, [userId, mealDate, refreshVersion]);

    const dailyTotals = calculateDailyNutrientTotals(meals.flatMap((meal) => meal.items));

    return (
        <section className="mt-8">
            <h2 className="text-xl font-bold">{mealDate}の食事記録</h2>

            {!userId && (
                <p className="mt-4 text-gray-600">記録機能を準備しています...</p>
            )}

            {isLoading && (
                <p className="mt-4 text-gray-600">食事記録を読み込んでいます...</p>
            )}

            {loadError && (
                <p className="mt-4 text-red-700">{loadError}</p>
            )}

            {!isLoading &&
                !loadError &&
                userId &&
                meals.length === 0 && (
                    <p className="mt-4 text-gray-600">この日の食事記録はありません</p>
            )}

            {!isLoading &&
                !loadError &&
                dailyTotals.length > 0 && (
                    <section className="mt-4 rounded border border-green-700 p-4">
                        <h3 className="font-bold">1日の栄養合計</h3>

                        <dl className="mt-3 grid grid-cols-2 gap-3">
                            {dailyTotals.map((total) => (
                                <div className="rounded bg-green-50 p-3" key={total.code}>
                                    <dt className="text-sm text-gray-600">{total.name}</dt>
                                    <dd className="font-bold">
                                        {!total.hasKnownValue
                                            ? "データ無し"
                                            : `${total.amount.toLocaleString("ja-JP", {
                                                maximumFractionDigits: 2,
                                            })} ${total.unit}`}
                                    </dd>

                                    {total.hasKnownValue &&
                                        total.hasMissingValue && (
                                            <p className="mt-1 text-xs text-amber-700">一部の食品にデータがありません</p>
                                        )}
                                </div>
                            ))}
                        </dl>
                    </section>
                )}

            <div className="mt-4 space-y-6">
                {meals.map((meal) => (
                    <section
                        className="rounded border p-4"
                        key={meal.id}
                    >
                        <h3 className="font-bold">{MEAL_TYPE_LABELS[meal.mealType]}</h3>

                        {meal.items.length === 0 ? (
                            <p className="mt-2 text-sm text-gray-600">食品は登録されていません</p>
                        ) : (
                            <ul className="mt-3 space-y-3">
                                {meal.items.map((item) => (
                                    <li
                                        className="rounded bg-gray-50 p-3"
                                        key={item.id}>
                                        <p className="font-medium">{item.food.name}</p>
                                        <p className="text-sm text-gray-600">{item.food.foodCode}・{item.amountG}g</p>
                                        <dl className="mt-2 grid grid-cols-2 gap-2">
                                            {item.nutrients.map((nutrient) => {
                                                const calculatedAmount =
                                                    nutrient.amountPer100g === null
                                                        ? null
                                                        : calculateNutrientAmount(nutrient.amountPer100g, item.amountG);
                                                return (
                                                    <div key={nutrient.code}>
                                                        <dt className="text-xs text-gray-600">{nutrient.name}</dt>
                                                        <dd className="text-sm font-medium">
                                                            {calculatedAmount === null
                                                                ? "データ無し"
                                                            : `${calculatedAmount.toLocaleString("ja-JP", { maximumFractionDigits: 2 }

                                                            )} ${nutrient.unit}`}
                                                        </dd>
                                                    </div>
                                                );
                                            })}
                                        </dl>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}
            </div>
        </section>
    );
}
