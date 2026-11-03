"use client";

/** 日常的な量で登録できる食品・標準料理の検索結果を表示する。 */
import {
    calculateSelectedEasyFoodNutrients,
    type EasyFoodCandidate,
    type MealEntrySelection,
} from "@/lib/easy-foods";

type EasyFoodResultProps = {
    candidates: EasyFoodCandidate[];
    selectedCandidate: EasyFoodCandidate | null;
    selection: MealEntrySelection | null;
    onSelect: (candidate: EasyFoodCandidate) => void;
};

/** 候補1単位に含まれる構成食品の合計重量を求める。 */
function getTotalAmountG(candidate: EasyFoodCandidate): number {
    return candidate.components.reduce(
        (total, component) => total + component.amountG,
        0,
    );
}

function getSelectedAmountG(
    candidate: EasyFoodCandidate,
    selection: MealEntrySelection,
): number | null {
    if (selection.sourceType === "food") {
        const component = candidate.components.find((item) => item.foodId === selection.sourceId);

        return component ? selection.quantity : null;
    }

    if (
        selection.sourceType !== candidate.sourceType
        || selection.sourceId !== candidate.sourceId
    ) {
        return null;
    }

    if (selection.servingOptionId !== undefined) {
        const choice = candidate.servingChoices.find(
            (item) => item.id === selection.servingOptionId,
        );

        return choice
            ? choice.amountG * selection.quantity
            : null;
    }

    return getTotalAmountG(candidate) * selection.quantity;
}

export default function EasyFoodResults({
    candidates,
    selectedCandidate,
    selection,
    onSelect,
}: EasyFoodResultProps) {
    if (candidates.length === 0) {
        return null;
    }

    return (
        <section className="mt-5" aria-labelledby="easy-food-heading">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-green-700">
                        かんたん入力
                    </p>
                    <h3 className="mt-1 text-lg font-bold" id="easy-food-heading">おすすめ</h3>
                </div>

                <p className="text-xs text-gray-500">日常的な量で表示</p>
            </div>

            <div className="mt-3 grid gap-3">
                {candidates.map((candidate) => {
                    const isSelected =
                        selectedCandidate?.sourceType === candidate.sourceType
                        && selectedCandidate.sourceId === candidate.sourceId;
                    
                    const defaultAmountG = getTotalAmountG(candidate);

                    const selectedNutrients =
                    isSelected && selection
                        ? calculateSelectedEasyFoodNutrients(
                            candidate,
                            selection,
                        )
                        : null;

                    const selectedAmountG =
                    isSelected && selection
                        ? getSelectedAmountG(candidate, selection)
                        : null;

                    const displayedNutrients =
                    selectedNutrients ?? candidate.nutrients;

                    const energy = displayedNutrients.find(
                    (nutrient) => nutrient.code === "energy_kcal",
                    );

                    const energyKcal =
                    energy?.hasKnownValue ? energy.amount : null;

                    const displayedAmountG =
                    selectedAmountG ?? defaultAmountG;

                    return (
                        <article
                            className={[
                                "overflow-hidden rounded-2xl border transition",
                                isSelected
                                    ? "border-green-700 bg-green-50"
                                    : "border-gray-200 bg-white",
                            ].join(" ")}
                            key={`${candidate.sourceType}-${candidate.sourceId}`}
                        >
                            <button
                                aria-pressed={isSelected}
                                className={[
                                    "w-full p-4 text-left",
                                    "focus-visible:outline-2 focus-visible:outline-offset-2",
                                    "focus-visible:outline-green-700",
                                    !isSelected ? "hover:bg-green-50/50" : "",
                                ].join(" ")}
                                onClick={() => onSelect(candidate)}
                                type="button"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold">{candidate.displayName}</p>

                                        <p className="mt-1 text-sm text-gray-600">
                                            {candidate.unitLabel}
                                            {"・"}
                                            {Math.round(displayedAmountG)}g
                                        </p>
                                    </div>

                                    {isSelected && (
                                        <span className="shrink-0 rounded-full bg-green-700 px-2 py-1 text-xs font-semibold text-white">
                                            選択中
                                        </span>
                                    )}
                                </div>

                                <p className="mt-3 text-lg font-bold text-green-800">
                                    {energyKcal === null
                                        ? "カロリー情報なし"
                                        : `約 ${Math.round(energyKcal)} kcal`}
                                </p>
                            </button>

                            <details className="border-t border-gray-200 px-4 py-3">
                                <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                                    根拠と内訳を見る
                                </summary>

                                <div className="mt-3 space-y-4 text-sm">
                                    {candidate.description && (
                                        <div>
                                            <p className="font-semibold">説明</p>
                                            <p className="mt-1 text-gray-700">
                                                {candidate.description}
                                            </p>
                                        </div>
                                    )}

                                    {candidate.sourceType === "standard_recipe" && (
                                        <div>
                                            <p className="font-semibold">標準1食分の材料</p>

                                            <ul className="mt-2 space-y-1">
                                                {candidate.components.map((component) => (
                                                    <li
                                                        className="flex justify-between gap-4 text-gray-700"
                                                        key={component.foodId}
                                                    >
                                                        <span>{component.name}</span>
                                                        <span className="shrink-0">
                                                            {Math.round(component.amountG * 10) / 10}g
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div>
                                        <p className="font-semibold">標準量・レシピの根拠</p>
                                        <p className="mt-1 text-gray-700">
                                            {candidate.sourceDescription}
                                        </p>
                                        </div>

                                        <div>
                                        <p className="font-semibold">確認日</p>
                                        <p className="mt-1 text-gray-700">
                                            {candidate.sourceCheckedAt}
                                        </p>
                                        </div>

                                        {candidate.sourceUrl && (
                                        <a
                                            className="inline-flex min-h-11 items-center font-semibold text-green-800 underline underline-offset-4"
                                            href={candidate.sourceUrl}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            参考資料を開く
                                            <span className="sr-only">（新しいタブで開きます）</span>
                                        </a>
                                    )}
                                </div>
                            </details>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}