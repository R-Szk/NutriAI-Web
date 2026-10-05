/** 食事記録の保存・取得に使う型とSupabaseアクセスをまとめるデータ層。 */
import { isMealType, type MealRecordInput, MealType, validateMealRecordInput } from "@/lib/meals";
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

/** Supabaseのnested selectが返すDB列名のままのデータ形式。 */
type DailyMealRecord = {
  id: number;
  meal_type: string;
  meal_items: Array<{
    id: number;
    amount_g: number;
    foods: {
      id: number;
      food_code: string;
      name: string;
      food_nutrients: Array<{
        amount: number | null;
        value_status: string;
        nutrients: {
          code: string;
          name: string;
          unit: string;
          display_order: number;
          is_primary: boolean;
        };
      }>;
    };
  }>;
};

const MEAL_TYPE_ORDER: MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

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

/**
 * 現在のユーザーが選択した日付の食事と主要栄養素を取得する。
 * DBのsnake_caseを、画面で扱いやすいcamelCaseへ変換して返す。
 */
export async function fetchDailyMeals(userId:string, mealDate: string): Promise<DailyMeal[]> {
    if (userId.trim() === "") {
        throw new Error("ユーザー情報を確認できません");
    }

    const supabase = createClient();

    const { data, error } = await supabase
        .from("meals")
        .select(`
            id,
            meal_type,
            meal_items (
                id,
                amount_g,
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
        .eq("user_id", userId)
        .eq("meal_date", mealDate)
        .overrideTypes<DailyMealRecord[], {merge: false }>();

    if (error) {
        throw new Error(`食事記録の取得に失敗しました: ${error.message}`);
    }

    const meals = data.map((meal) => {
        if (!isMealType(meal.meal_type)) {
            throw new Error(`未対応の食事区分です: ${meal.meal_type}`);
        }

        return {
            id: meal.id,
            mealType: meal.meal_type,
            items: meal.meal_items.map((item) => ({
                id: item.id,
                amountG: Number(item.amount_g),
                food: {
                    id: item.foods.id,
                    foodCode: item.foods.food_code,
                    name: item.foods.name,
                },
                nutrients: item.foods.food_nutrients
                    .filter((foodNutrient) => foodNutrient.nutrients.is_primary)
                    .sort((a, b) => a.nutrients.display_order - b.nutrients.display_order)
                    .map((foodNutrient) => ({
                        code: foodNutrient.nutrients.code,
                        name: foodNutrient.nutrients.name,
                        unit: foodNutrient.nutrients.unit,
                        displayOrder: foodNutrient.nutrients.display_order,
                        amountPer100g: foodNutrient.amount,
                        valueStatus: foodNutrient.value_status,
                    })),
            })),
        };
    });

    return meals.sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType));
}