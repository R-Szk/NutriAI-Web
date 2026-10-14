/** 計算済みの1日分の主要栄養素を表示する。 */
import type { DailyNutrientTotal } from "@/lib/daily-nutrition";

type DailyNutritionSummaryProps = {
    totals: DailyNutrientTotal[];
};

export default function DailyNutritionSummary({
    totals
}: DailyNutritionSummaryProps) {
    if (totals.length === 0) {
        return null;
    }

    return (
        <section className="mt-4 rounded border border-green-700 p-4">
            <h2 className="font-bold">1日の栄養合計</h2>

            <dl className="mt-3 grid grid-cols-2 gap-3">
                {totals.map((total) => (
                    <div
                        className="rounded bg-green-50 p-3"
                        key={total.code}
                    >
                        <dt className="text-sm text-gray-600">
                            {total.name}
                        </dt>

                        <dd className="font-bold">
                            {!total.hasKnownValue
                                ? "データ無し"
                                : `${total.amount.toLocaleString("ja-JP", {
                                    maximumFractionDigits: 2,
                                })} ${total.unit}`}
                        </dd>

                        {total.hasKnownValue && total.hasMissingValue && (
                            <p className="mt-1 text-xs text-amber-700">
                                一部の食品にデータがありません
                            </p>
                        )}
                    </div>
                ))}
            </dl>
        </section>
    );
}