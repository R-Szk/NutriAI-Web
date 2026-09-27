/** 食事記録の保存・取得に使う型とSupabaseアクセスをまとめるデータ層。 */
import { type MealRecordInput, MealType, validateMealRecordInput } from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

export type SaveMealItemResult = {
    mealId: number;
    mealItemId: number;
};

export type DailyMealItem = {
    id: number;
    amountG: number;
    food: {
        id: number;
        foodCode: string;
        name: string;
    };
    nutrients: Array<{
        code: string;
        name: string;
        unit: string;
        displayOrder: number;
        amountPer100g: number | null;
        valueStatus: string;
    }>;
};

export type DailyMeal = {
    id: number;
    mealType: MealType;
    items: DailyMealItem[];
};

/**
 * 食事枠を先にupsertし、そのIDを使って食品と摂取量をupsertする。
 * 同じ日・区分・食品を再保存した場合は、行を増やさず摂取量を置き換える。
 */
export async function saveMealItem(input:MealRecordInput): Promise<SaveMealItemResult> {
    const validationError = validateMealRecordInput(input);
    if (validationError) {
        throw new Error(validationError);
    }

    const supabase = createClient();

    // 1ユーザー・1日・1食事区分につき1つのmealを再利用する。
    const { data: meal, error: mealError } = await supabase
        .from("meals")
        .upsert(
            {
                user_id: input.userId,
                meal_date: input.mealDate,
                meal_type: input.mealType,
            },
            {
                onConflict: "user_id,meal_date,meal_type",
            },
        )
        .select("id")
        .single();

    if (mealError) {
        throw new Error(`食事の保存に失敗しました: ${mealError.message}`);
    }

    // 同じmeal内の同じ食品は、amount_gを最新の入力値へ更新する。
    const { data: mealItem, error: mealItemError } = await supabase
        .from("meal_items")
        .upsert(
            {
                meal_id: meal.id,
                food_id: input.foodId,
                amount_g: input.amountG,
            },
            {
                onConflict: "meal_id,food_id",
            },
        )
        .select("id")
        .single();

    if (mealItemError) {
        throw new Error(`食品の保存に失敗しました: ${mealItemError.message}`);
    }

    return {
        mealId: meal.id,
        mealItemId: mealItem.id,
    };
}
