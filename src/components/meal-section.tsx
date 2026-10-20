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
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
            aria-labelledby={headingId}
        >
            <div className="flex items-center justify-between gap-3">
                <h3 id={headingId} className="font-bold">{entry.label}</h3>

                <Link
                    className="shrink-0 rounded-full bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-100"
                    href={buildRecordHref(mealDate, entry.mealType)}
                >
                    {entry.label}に食品を追加
                </Link>
            </div>

            {!entry.meal || entry.meal.items.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-600">
                    まだ記録がありません
                </p>
            ) : (
                <ul className="mt-3 space-y-3">
                    {entry.meal.items.map((item) => (
                        <li
                            className="rounded-xl border border-gray-100 bg-gray-50 p-3"
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