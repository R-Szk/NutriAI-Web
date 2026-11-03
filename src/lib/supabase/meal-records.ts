/** 食事記録の保存・取得に使う型とSupabaseアクセスをまとめるデータ層。 */
import {
    isMealType,
    type MealEntryRecordInput,
    type MealRecordInput,
    type MealType,
    validateMealRecordInput,
    validateMealEntryRecordInput
} from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";
import type { MealEntrySourceType } from "@/lib/easy-foods";

export type SaveMealItemResult = {
    mealId: number;
    mealItemId: number;
};

export type SaveMealEntryResult = {
    mealId: number;
    mealEntryId: number;
};

type SaveMealEntryRpcRow = {
    meal_id: number;
    meal_entry_id: number;
};

/** RPCの戻り値が保存結果として必要な形を持つか確認する。 */
function isSaveMealEntryRpcRow(value: unknown): value is SaveMealEntryRpcRow {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    return (
        "meal_id" in value
        && typeof value.meal_id === "number"
        && "meal_entry_id" in value
        && typeof value.meal_entry_id === "number"
    );
}

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
    entries: DailyMealEntry[];
    items: DailyMealItem[];
};

type DailyMealComponentRecord = {
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
};

/** Supabaseのnested selectが返すDB列名のままのデータ形式。 */
type DailyMealRecord = {
  id: number;
  meal_type: string;
  meal_entries: Array<{
    id: number;
    display_name: string;
    quantity: number;
    unit_label: string;
    source_type: string;
    meal_entry_components: DailyMealComponentRecord[];
  }>;
};

/** 1件の食事記録を栄養計算用に展開した構成食品。 */
export type DailyMealComponent = {
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

/** 利用者が記録した食品・標準量・標準料理の1件。 */
export type DailyMealEntry = {
  id: number;
  displayName: string;
  quantity: number;
  unitLabel: string;
  sourceType: MealEntrySourceType;
  components: DailyMealComponent[];
};

/** DBから取得した文字列を、対応済みの記録元へ絞り込む。 */
function isMealEntrySourceType(value: string): value is MealEntrySourceType {
    return (
        value === "food"
        || value === "serving_preset"
        || value === "standard_recipe"
    );
}

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
 * 選択した食品・標準量・標準料理をRPCで保存する。
 * ユーザーIDと構成食品の展開は、改ざんを防ぐためDB側へ委ねる。
 */
export async function saveMealEntry(input: MealEntryRecordInput): Promise<SaveMealEntryResult> {
    const validationError = validateMealEntryRecordInput(input);

    if (validationError) {
        throw new Error(validationError);
    }

    const supabase = createClient();

    const { data, error } = await supabase
        .rpc("save_meal_entry", {
            p_meal_date: input.mealDate,
            p_meal_type: input.mealType,
            p_source_type: input.selection.sourceType,
            p_source_id: input.selection.sourceId,
            p_quantity: input.selection.quantity,
            p_serving_option_id: input.selection.servingOptionId ?? null,
        })
        .single();

    if (error) {
        throw new Error(`食事記録の保存に失敗しました: ${error.message}`);
    }

    if (!isSaveMealEntryRpcRow(data)) {
        throw new Error("保存した食事記録を確認できません");
    }

    return {
        mealId: Number(data.meal_id),
        mealEntryId: Number(data.meal_entry_id),
    };
}

/** DBのsnake_case形式を、画面と計算で使うcamelCase形式へ変換する。 */
function mapDailyMealComponent(component: DailyMealComponentRecord): DailyMealComponent {
    return {
        id: component.id,
        amountG: Number(component.amount_g),
        food: {
            id: component.foods.id,
            foodCode: component.foods.food_code,
            name: component.foods.name,
        },
        nutrients: component.foods.food_nutrients
            .filter((foodNutrient) => foodNutrient.nutrients.is_primary)
            .sort(
                (a, b) => a.nutrients.display_order - b.nutrients.display_order
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
                display_name,
                quantity,
                unit_label,
                source_type,
                meal_entry_components (
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

        const entries: DailyMealEntry[] = meal.meal_entries.map((entry) => {
            if (!isMealEntrySourceType(entry.source_type)) {
                throw new Error(`未対応の記録元です: ${entry.source_type}`);
            }

            return {
                id: entry.id,
                displayName: entry.display_name,
                quantity: Number(entry.quantity),
                unitLabel: entry.unit_label,
                sourceType: entry.source_type,
                components: entry.meal_entry_components.map(mapDailyMealComponent),
            };
        });

        return {
            id: meal.id,
            mealType: meal.meal_type,
            entries,
            items: entries.flatMap((entry) => entry.components)
        };
    });

    return meals.sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType));
}