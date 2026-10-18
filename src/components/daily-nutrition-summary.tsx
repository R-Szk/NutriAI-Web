/** 計算済みの1日分の主要栄養素を表示する。 */
import type { DailyNutrientTotal } from "@/lib/daily-nutrition";

type DailyNutritionSummaryProps = {
    totals: DailyNutrientTotal[];
};

function formatAmount(total: DailyNutrientTotal): string {
    if (!total.hasKnownValue) {
        return "データ無し";
    }

    return `${total.amount.toLocaleString("ja-JP", {
        maximumFractionDigits: 2,
    })} ${total.unit}`
}

export default function DailyNutritionSummary({
    totals
}: DailyNutritionSummaryProps) {
    if (totals.length === 0) {
        return null;
    }

    const energy = totals.find((total) => total.code === "energy_kcal");

    const macros = totals.filter((total) => total.code !== "energy_kcal");

    return (
        <section className="mt-6 rounded-2xl bg-green-950 p-5 text-white shadow-lg shadow-green-950/10">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-green-200">1日の栄養</p>
                    <h2 className="mt-1 text-xl font-bold">現在の実績</h2>
                </div>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-green-100">
                    目標表示に対応予定
                </span>
            </div>

            {energy && (
                <div className="mt-6">
                    <p className="text-sm text-green-200">{energy.name}</p>

                    <p className="mt-1 text-3xl font-bold tracking-tight">{formatAmount(energy)}</p>

                    {energy?.hasKnownValue && energy.hasMissingValue && (
                        <p className="mt-2 text-xs text-amber-200">
                            一部の食品にデータがありません
                        </p>
                    )}
                </div>
            )}

            <dl className="mt-6 grid grid-cols-3 gap-2">
                {macros.map((total) => (
                    <div
                        className="rounded-xl bg-white/10 p-3"
                        key={total.code}
                    >
                        <dt className="mt-1 text-sm text-green-200">
                            {total.name}
                        </dt>

                        <dd className="mt-1 text-sm font-bold">
                            {formatAmount(total)}
                        </dd>

                        {total.hasKnownValue && total.hasMissingValue && (
                            <p className="mt-1 text-xs text-amber-200">
                                一部欠損
                            </p>
                        )}
                    </div>
                ))}
            </dl>
        </section>
    );
}