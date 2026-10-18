/** 1つの食事区分について、食品一覧・空状態・追加操作を表示する。 */
import Link from "next/link";
import { calculateNutrientAmount } from "@/lib/food-search";
import { buildRecordHref } from "@/lib/meal-navigation";
import type { MealTimelineEntry } from "@/lib/meal-timeline";

type MealSectionProps = {
    entry: MealTimelineEntry;
    mealDate: string;
};

export default function MealSection({
    entry,
    mealDate,
}: MealSectionProps) {
    const headingId = `meal-${entry.mealType}`;

    return (
        <section
            className="rounded border p-4"
            aria-labelledby={headingId}
        >
            <div className="flex items-center justify-between gap-3">
                <h3 id={headingId} className="font-bold">{entry.label}</h3>

                <Link
                    className="rounded bg-green-700 px-3 py-2 text-sm text-white"
                    href={buildRecordHref(mealDate, entry.mealType)}
                >
                    {entry.label}に食品を追加
                </Link>
            </div>

            {!entry.meal || entry.meal.items.length === 0 ? (
                <p className="mt-3 text-sm text-gray-600">まだ記録がありません</p>
            ) : (
                <ul className="mt-3 space-y-3">
                    {entry.meal.items.map((item) => (
                        <li
                            className="rounded bg-gray-50 p-3"
                            key={item.id}
                        >
                            <p className="font-medium">{item.food.name}</p>

                            <p className="text-sm text-gray-600">{item.food.foodCode}・{item.amountG}g</p>

                            <dl className="mt-2 grid grid-cols-2 gap-2">
                                {item.nutrients.map((nutrient) => {
                                    const calculatedAmount = nutrient.amountPer100g === null
                                        ? null
                                        : calculateNutrientAmount(nutrient.amountPer100g, item.amountG);
                                    
                                    return (
                                        <div key={nutrient.code}>
                                            <dt className="text-xs text-gray-600">{nutrient.name}</dt>

                                            <dd className="text-sm font-medium">
                                                {calculatedAmount === null
                                                    ? "データ無し"
                                                    : `${calculatedAmount.toLocaleString(
                                                        "ja-JP",
                                                        { maximumFractionDigits: 2 }
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
    );
}