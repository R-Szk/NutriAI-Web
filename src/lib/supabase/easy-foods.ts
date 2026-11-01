/** Supabaseのカタログデータを画面用の型へ変換するデータ層。 */
import {
    calculateEasyFoodNutrients,
    rankEasyFoodCandidates,
    type EasyFoodCandidate,
    type ServingComponent,
} from "@/lib/easy-foods";
import { createClient } from "@/lib/supabase/client";

type FoodNutrientRecord = {
    amount: number | null;
    value_status: string;
    nutrients: {
        code: string;
        name: string;
        unit: string;
        display_order: number;
        is_primary: boolean;
    };
};

export type PresetRecord = {
    id: number;
    display_name: string;
    search_keywords: string[];
    default_amount_g: number;
    unit_label: string;
    priority: number;
    is_active: boolean;
    food_serving_options: Array<{
        id: number;
        display_name: string;
        amount_g: number;
        display_order: number;
    }>;
    foods: {
        id: number;
        food_code: string;
        name: string;
        food_nutrients: FoodNutrientRecord[];
    };
};

export type RecipeRecord = {
    id: number;
    display_name: string;
    search_keywords: string[];
    unit_label: string;
    priority: number;
    is_active: boolean;
    standard_recipe_items: Array<{
        amount_g: number;
        display_order: number;
        foods: {
            id: number;
            food_code: string;
            name: string;
            food_nutrients: FoodNutrientRecord[];
        };
    }>;
};

/** Supabaseのpresetレコードを、画面で扱うcamelCaseの候補へ変換する。 */
export function mapPresetRecordToCandidate(
    record: PresetRecord,
): EasyFoodCandidate {
    const component: ServingComponent = {
        foodId: record.foods.id,
        foodCode: record.foods.food_code,
        name: record.foods.name,
        amountG: Number(record.default_amount_g),
        nutrients: record.foods.food_nutrients
            .filter(
                (foodNutrient) => foodNutrient.nutrients.is_primary,
            )
            .map((foodNutrient) => ({
                code: foodNutrient.nutrients.code,
                name: foodNutrient.nutrients.name,
                unit: foodNutrient.nutrients.unit,
                displayOrder: foodNutrient.nutrients.display_order,
                amountPer100g: foodNutrient.amount,
                valueStatus: foodNutrient.value_status,
            })),
    };

    const components = [component];

    return {
        sourceType: "serving_preset",
        sourceId: record.id,
        displayName: record.display_name,
        searchKeywords: record.search_keywords,
        unitLabel: record.unit_label,
        priority: record.priority,
        isActive: record.is_active,

        servingChoices: [...record.food_serving_options]
            .sort((a, b) => a.display_order - b.display_order)
            .map((option) => ({
                id: option.id,
                label: option.display_name,
                amountG: Number(option.amount_g),
                displayOrder: option.display_order,
            })),

        components,
        nutrients: calculateEasyFoodNutrients(components),
    };
}

/** Supabaseのrecipeレコードを、画面で扱う料理候補へ変換する。 */
export function mapRecipeRecordToCandidate(
    record: RecipeRecord,
): EasyFoodCandidate {
    const components: ServingComponent[] = [...record.standard_recipe_items]
        .sort((a, b) => a.display_order - b.display_order)
        .map((recipeItem) => ({
            foodId: recipeItem.foods.id,
            foodCode: recipeItem.foods.food_code,
            name: recipeItem.foods.name,
            amountG: Number(recipeItem.amount_g),
            nutrients: recipeItem.foods.food_nutrients
                .filter((foodNutrient) => foodNutrient.nutrients.is_primary)
                .map((foodNutrient) => ({
                    code: foodNutrient.nutrients.code,
                    name: foodNutrient.nutrients.name,
                    unit: foodNutrient.nutrients.unit,
                    displayOrder: foodNutrient.nutrients.display_order,
                    amountPer100g: foodNutrient.amount,
                    valueStatus: foodNutrient.value_status,
                })),
        }));

    return {
        sourceType: "standard_recipe",
        sourceId: record.id,
        displayName: record.display_name,
        searchKeywords: record.search_keywords,
        unitLabel: record.unit_label,
        priority: record.priority,
        isActive: record.is_active,
        servingChoices: [],
        components,
        nutrients: calculateEasyFoodNutrients(components),
    };
}

/**
 * 有効な標準量と標準料理を取得し、
 * 検索語との一致度に従って最大5件返す。
 */
export async function searchEasyFoods(
    query: string,
): Promise<EasyFoodCandidate[]> {
    const normalizedQuery = query
        .normalize("NFKC")
        .trim();

    // 空検索ではSupabaseクライアントも作らない
    if (normalizedQuery === "") {
        return [];
    }

    const supabase = createClient();

    const [presetResult, recipeResult] = await Promise.all([
        supabase
            .from("food_serving_presets")
            .select(`
                id,
                display_name,
                search_keywords,
                default_amount_g,
                unit_label,
                priority,
                is_active,
                food_serving_options (
                    id,
                    display_name,
                    amount_g,
                    display_order
                ),
                foods (
                    id,
                    food_code,
                    name,
                    food_nutrients (
                        amount,
                        value_status,
                        nutrients (
                            code,
                            name,
                            unit,
                            display_order,
                            is_primary
                        )
                    )
                )
            `)
            .eq("is_active", true)
            .overrideTypes<
                PresetRecord[],
                { merge: false }
            >(),

        supabase
            .from("standard_recipes")
            .select(`
                id,
                display_name,
                search_keywords,
                unit_label,
                priority,
                is_active,
                standard_recipe_items (
                    amount_g,
                    display_order,
                    foods (
                        id,
                        food_code,
                        name,
                        food_nutrients (
                            amount,
                            value_status,
                            nutrients (
                                code,
                                name,
                                unit,
                                display_order,
                                is_primary
                            )
                        )
                    )
                )
            `)
            .eq("is_active", true)
            .overrideTypes<
                RecipeRecord[],
                { merge: false }
            >(),
    ]);

    if (presetResult.error) {
        throw new Error(
            `標準量の検索に失敗しました: ${presetResult.error.message}`,
        );
    }

    if (recipeResult.error) {
        throw new Error(
            `標準料理の検索に失敗しました: ${recipeResult.error.message}`,
        );
    }

    const candidates = [
        ...(presetResult.data ?? [])
            .map(mapPresetRecordToCandidate),

        ...(recipeResult.data ?? [])
            .map(mapRecipeRecordToCandidate),
    ];

    return rankEasyFoodCandidates(normalizedQuery, candidates);
}
