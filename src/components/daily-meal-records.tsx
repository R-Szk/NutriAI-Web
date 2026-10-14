"use client";

/** 親から受け取った選択日の食事記録を表示する。 */
import { calculateNutrientAmount } from "@/lib/food-search";
import { MEAL_TYPE_LABELS } from "@/lib/meals";
import type { DailyMeal } from "@/lib/supabase/meal-records";

type DailyMealRecordsProps = {
    userId: string | null;
    mealDate: string;
    meals: DailyMeal[];
    isLoading: boolean;
    loadError: string | null;
};

export default function DailyMealRecords({
    userId,
    mealDate,
    meals,
    isLoading,
    loadError
}: DailyMealRecordsProps) {

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
                    <p className="mt-4 text-gray-600">
                        この日の食事記録はありません
                    </p>
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