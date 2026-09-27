import { type MealRecordInput, validateMealRecordInput } from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

export type SaveMealItemResult = {
    mealId: number;
    mealItemId: number;
};

export async function saveMealItem(input:MealRecordInput): Promise<SaveMealItemResult> {
    const validationError = validateMealRecordInput(input);
    if (validationError) {
        throw new Error(validationError);
    }

    const supabase = createClient();

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
