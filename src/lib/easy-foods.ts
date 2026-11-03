import { calculateNutrientAmount } from "./food-search";

/** 食事記録が参照するデータの種類。DBのsource_typeと同じ値を使う。 */
export type MealEntrySourceType =
    | "food"
    | "serving_preset"
    | "standard_recipe";

/** 食事保存RPCへ渡す、選択元と数量。 */
export type MealEntrySelection = {
    sourceType: MealEntrySourceType;
    sourceId: number;
    servingOptionId?: number;
    quantity: number;
};

/** 構成食品が持つ100g当たりの栄養値。 */
export type ServingComponentNutrient = {
    code: string;
    name: string;
    unit: string;
    displayOrder: number;
    amountPer100g: number | null;
    valueStatus: string;
};

/** 標準量または標準料理を構成する食品と重量。 */
export type ServingComponent = {
    foodId: number;
    foodCode: string;
    name: string;
    amountG: number;
    nutrients: ServingComponentNutrient[];
};

/** 画面に表示する固定重量の選択肢。 */
export type ServingChoice = {
    id: number;
    label: string;
    amountG: number;
    displayOrder: number;
};

/** 標準量・料理1単位分として計算した主要栄養素。 */
export type EasyFoodNutrient = {
    code: string;
    name: string;
    unit: string;
    displayOrder: number;
    amount: number;
    hasMissingValue: boolean;
    hasKnownValue: boolean;
};

/** 検索画面へ表示する、標準量または標準料理の候補。 */
export type EasyFoodCandidate = {
    sourceType: "serving_preset" | "standard_recipe";
    sourceId: number;
    displayName: string;
    description: string | null;
    sourceDescription: string;
    sourceUrl: string | null;
    sourceCheckedAt: string;
    searchKeywords: string[];
    unitLabel: string;
    priority: number;
    isActive: boolean;
    servingChoices: ServingChoice[];
    components: ServingComponent[];
    nutrients: EasyFoodNutrient[];
};

/**
 * 選択内容を保存できるか確認する。
 * 問題がなければnull、問題があれば利用者向けメッセージを返す。
 */
export function validateMealEntrySelection(selection: MealEntrySelection): string | null {
    if (!Number.isSafeInteger(selection.sourceId) || selection.sourceId <= 0) {
        return "記録元のIDが不正です";
    }

    if (
        selection.servingOptionId !== undefined
        && (
            !Number.isSafeInteger(selection.servingOptionId)
            || selection.servingOptionId <= 0
        )
    ) {
        return "量候補のIDが不正です";
    }

    if (
        selection.sourceType !== "serving_preset"
        && selection.servingOptionId !== undefined
    ) {
        return "この記録元では量候補を指定できません";
    }

    if (!Number.isFinite(selection.quantity) || selection.quantity <= 0) {
        return "数量は0より大きい数を指定してください";
    }

    if (selection.sourceType === "food" && selection.quantity > 10000) {
        return "食品の摂取量は10000g以下にしてください";
    }

    if (selection.sourceType !== "food" && selection.quantity > 100) {
        return "標準量・標準料理の数量は100以下にしてください";
    }

    return null;
}

/**
 * 標準量・標準料理の構成食品を、選択された数量に合わせて拡大する。
 * 100g当たり栄養値と欠損状態は変更しない。
 */
export function scaleServingComponents(
    components: readonly ServingComponent[],
    quantity: number,
): ServingComponent[] {
    return components.map((component) => ({
        ...component,
        amountG: component.amountG * quantity,
        nutrients: component.nutrients.map((nutrient) => ({
            ...nutrient,
        })),
    }));
}

/**
 * 構成食品の100g当たり栄養値を実重量へ換算し、
 * 栄養素コードごとに合計する。
 */
export function calculateEasyFoodNutrients(
    components: readonly ServingComponent[],
): EasyFoodNutrient[] {
    const totalsByCode = new Map<string, EasyFoodNutrient>();

    for (const component of components) {
        for (const nutrient of component.nutrients) {
            const currentTotal = totalsByCode.get(nutrient.code) ?? {
                code: nutrient.code,
                name: nutrient.name,
                unit: nutrient.unit,
                displayOrder: nutrient.displayOrder,
                amount: 0,
                hasMissingValue: false,
                hasKnownValue: false,
            };

            if (nutrient.amountPer100g === null) {
                currentTotal.hasMissingValue = true;
            } else {
                currentTotal.amount += calculateNutrientAmount(
                    nutrient.amountPer100g,
                    component.amountG,
                );
                currentTotal.hasKnownValue = true;
            }

            totalsByCode.set(nutrient.code, currentTotal);
        }
    }

    return [...totalsByCode.values()].sort(
        (a, b) => a.displayOrder - b.displayOrder,
    );
}

/** 表記揺れを抑え、検索比較に使える文字列へ変換する。 */
function normalizeEasyFoodSearchText(value: string): string {
    return value
        .normalize("NFKC")
        .trim()
        .toLocaleLowerCase("ja-JP");
}

/** 完全一致・前方一致・部分一致を数値へ変換する。小さいほど優先。 */
function getMatchRank(
    query: string,
    candidate: EasyFoodCandidate,
): number | null {
    const terms = [candidate.displayName, ...candidate.searchKeywords]
        .map(normalizeEasyFoodSearchText)
        .filter((term) => term !== "");

    if (terms.some((term) => term === query)) {
        return 0;
    }

    if (terms.some((term) => term.startsWith(query))) {
        return 1;
    }

    if (terms.some((term) => term.includes(query))) {
        return 2;
    }

    return null;
}

/**
 * 有効な候補だけを検索し、一致方法と表示優先度で最大5件に絞る。
 */
export function rankEasyFoodCandidates(
    query: string,
    candidates: readonly EasyFoodCandidate[],
): EasyFoodCandidate[] {
    const normalizedQuery = normalizeEasyFoodSearchText(query);

    if (normalizedQuery === "") {
        return [];
    }

    return candidates
        .map((candidate, originalIndex) => ({
            candidate,
            originalIndex,
            matchRank: getMatchRank(normalizedQuery, candidate),
        }))
        .filter(
            (
                result,
            ): result is typeof result & { matchRank: number } =>
                result.candidate.isActive
                && result.matchRank !== null,
        )
        .sort((a, b) => {
            if (a.matchRank !== b.matchRank) {
                return a.matchRank - b.matchRank;
            }

            if (a.candidate.priority !== b.candidate.priority) {
                return b.candidate.priority - a.candidate.priority;
            }

            return a.originalIndex - b.originalIndex;
        })
        .slice(0, 5)
        .map((result) => result.candidate);
}

/**
 * 候補と確定した量から、実際に保存する量の栄養値を計算する。
 * 候補とselectionの組み合わせが不正な場合はnullを返す。
 */
export function calculateSelectedEasyFoodNutrients(
    candidate: EasyFoodCandidate,
    selection: MealEntrySelection,
): EasyFoodNutrient[] | null {
    const validationError = validateMealEntrySelection(selection);

    if (validationError) {
        return null;
    }

    // 任意グラムは、プリセットが参照する元食品として計算する。
    if (selection.sourceType === "food") {
        const component = candidate.components.find(
            (item) => item.foodId === selection.sourceId,
        );

        if (!component || candidate.components.length !== 1) {
            return null;
        }

        const scale = selection.quantity / component.amountG;

        return calculateEasyFoodNutrients(scaleServingComponents([component], scale));
    }

    // 標準量・標準料理は、選択元が候補と一致する必要がある。
    if (
        selection.sourceType !== candidate.sourceType
        || selection.sourceId !== candidate.sourceId
    ) {
        return null;
    }

    let scale = selection.quantity;

    if (selection.servingOptionId !== undefined) {
        if (candidate.sourceType !== "serving_preset") {
            return null;
        }

        const servingChoice = candidate.servingChoices.find(
            (choice) => choice.id === selection.servingOptionId,
        );

        const defaultAmountG = candidate.components.reduce(
            (total, component) => total + component.amountG,
            0,
        );

        if (!servingChoice || defaultAmountG <= 0) {
            return null;
        }

        scale *= servingChoice.amountG / defaultAmountG;
    }

    return calculateEasyFoodNutrients(
        scaleServingComponents(candidate.components, scale),
    );
}