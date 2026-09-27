"use client";

import { createClient } from "@/lib/supabase/client";
import { type SubmitEvent, useState } from "react";
import { normalizeSearchQuery, parseIntakeAmount, calculateNutrientAmount } from "@/lib/food-search";
import MealSaveForm from "./meal-save-form";

type FoodSearchResult = {
    id: number;
    food_code: string;
        name: string;
        food_group_name: string;
};

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

type CalculatedNutrient = {
    code: string;
    name: string;
    unit: string;
    amount: number | null;
};

type FoodSearchProps = {
    mealDate: string;
    userId: string | null;
    isAuthLoading: boolean;
    authError: string | null;
};

export default function FoodSearch({
    mealDate,
    userId,
    isAuthLoading,
    authError,
}: FoodSearchProps) {
    const [foods, setFoods] = useState<FoodSearchResult[]>([]);
    const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);

    const [amountText, setAmountText] = useState("");
    const [amountMessage, setAmountMessage] = useState("");

    const [confirmedAmountG, setConfirmedAmountG] = useState<number | null>(null);

    const [calculatedNutrients, setCalculatedNutrients] = useState<CalculatedNutrient[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);

    const [query, setQuery] = useState("");
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();

        const normalizedQuery = normalizeSearchQuery(query);

        if (!normalizedQuery) {
            setFoods([]);
            setSelectedFood(null);
            setConfirmedAmountG(null);
            setCalculatedNutrients([]);
            setAmountText("");
            setAmountMessage("");
            setMessage("食品名を入力してください");
            return;
        }

        setIsLoading(true);
        setSelectedFood(null);
        setMessage("");
        setCalculatedNutrients([]);
        setConfirmedAmountG(null);
        setAmountText("");
        setAmountMessage("");

        const supabase = createClient();
        const { data, error } = await supabase
            .from("foods")
            .select("id, food_code, name, food_group_name")
            .eq("source", "MEXT")
            .ilike("name", `%${normalizedQuery}%`)
            .order("food_code")
            .limit(20);

        setIsLoading(false);

        if (error) {
            setFoods([]);
            setMessage(`検索に失敗しました: ${error.message}`);
            return;
        }

        setFoods(data ?? []);

        if (!data || data.length === 0) {
            setMessage("該当する食品が見つかりませんでした");
        }
    }

    function handleFoodSelection(food: FoodSearchResult) {
        const isSameFood = selectedFood?.food_code === food.food_code;

        setConfirmedAmountG(null);

        if (isSameFood) {
            setSelectedFood(null);
            setCalculatedNutrients([]);
            setAmountText("");
        } else {
            setSelectedFood(food);
            setCalculatedNutrients([]);
            setAmountText("100");
        }

        setAmountMessage("");
    }

    async function handleAmountSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();

        const intakeAmount = parseIntakeAmount(amountText);

        if (intakeAmount === null) {
            setCalculatedNutrients([]);
            setConfirmedAmountG(null);
            setAmountMessage("0より大きい摂取量を入力してください");
            return;
        }

        if (!selectedFood) {
            return;
        }

        setIsCalculating(true);
        setCalculatedNutrients([]);
        setConfirmedAmountG(null);
        setAmountMessage("");

        const supabase = createClient();
        const { data, error } = await supabase
            .from("food_nutrients")
            .select(`
                amount,
                value_status,
                nutrients (
                    code,
                    name,
                    unit,
                    display_order,
                    is_primary
                )
            `)
            .eq("food_id", selectedFood.id)
            .overrideTypes<FoodNutrientRecord[], { merge: false }>();

        setIsCalculating(false);
        if (error) {
            setAmountMessage(`栄養値の取得に失敗しました: ${error.message}`);
            return;
        }

        const results = data
            .filter((record) => record.nutrients.is_primary)
            .sort(
                (a, b) => a.nutrients.display_order - b.nutrients.display_order
            )
            .map((record) => ({
                code: record.nutrients.code,
                name: record.nutrients.name,
                unit: record.nutrients.unit,
                amount: record.amount === null
                    ? null
                    : calculateNutrientAmount(record.amount, intakeAmount),
            }));

        setCalculatedNutrients(results);
        setConfirmedAmountG(intakeAmount);
        setAmountMessage(`摂取量: ${intakeAmount}g`);
    }

    return (
        <section className="mt-8">
            <h2 className="text-xl font-bold">食品検索</h2>

            <form className="mt-4 flex items-end gap-2" onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="food-query">食品名</label>

                <input
                    id="food-query"
                    className="w-full rounded border px-3 py-2"
                    type="search"
                    placeholder="例: りんご"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)} />

                <button
                    className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
                    type="submit"
                    disabled={isLoading}>
                        {isLoading ? "検索中..." : "検索"}
                </button>

            </form>

            {message && <p className="mt-4">{message}</p>}
            {selectedFood && (
                <div className="mt-6 rounded border border-green-700 p-4">
                    <p className="text-sm text-gray-600">選択中の食品</p>
                    <p className="font-bold">{selectedFood.name}</p>
                    <p className="text-sm">{selectedFood.food_code}・{selectedFood.food_group_name}</p>

                    <form
                        className="mt-4 flex items-end gap-2"
                        onSubmit={handleAmountSubmit}>

                        <label className="flex flex-col gap-1" htmlFor="intake-amount">
                            <span className="text-sm">摂取量(g)</span>
                            <input
                                id="intake-amount"
                                className="rounded border px-3 py-2"
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={amountText}
                                onChange={(event) => {
                                    setAmountText(event.target.value);
                                    setCalculatedNutrients([]);
                                    setConfirmedAmountG(null);
                                    setAmountMessage("");
                                }} />
                        </label>

                        <button
                            className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
                            type="submit"
                            disabled={isCalculating}>
                                {isCalculating ? "計算中..." : "決定"}
                        </button>
                    </form>

                    {amountMessage && (
                        <p className="mt-2 text-sm">{amountMessage}</p>
                    )}

                    {calculatedNutrients.length > 0 && (
                        <dl className="mt-4 grid grid-cols-2 gap-3">
                            {calculatedNutrients.map((nutrient) => (
                                <div
                                    className="rounded bg-gray-50 p-3"
                                    key={nutrient.code}>
                                    <dt className="text-sm text-gray-600">
                                        {nutrient.name}
                                    </dt>
                                    <dd className="font-bold">
                                        {nutrient.amount === null
                                            ? "データ無し"
                                            : `${nutrient.amount} ${nutrient.unit}`}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    )}
                    {selectedFood &&
                        confirmedAmountG !== null &&
                        calculatedNutrients.length > 0 && (
                            <MealSaveForm
                            userId={userId}
                            mealDate={mealDate}
                            foodId={selectedFood.id}
                            amountG={confirmedAmountG}
                            isAuthLoading={isAuthLoading}
                            authError={authError}
                            onSaved={() => undefined}
                            />
                    )}
                </div>
            )}
            {foods.length > 0 && (
                <ul className="mt-4 space-y-2">
                    {foods.map((food) => {
                        const isSelected = selectedFood?.food_code === food.food_code;

                        return (
                            <li key={food.food_code}>
                                <button
                                    type="button"
                                    className={
                                        "w-full rounded border p-3 text-left " +
                                        (isSelected
                                            ? "border-green-700 bg-green-50"
                                            : "border-gray-300"
                                        )
                                    }
                                    aria-pressed={isSelected}
                                    onClick={() => handleFoodSelection(food)}>
                                    <p className="font-medium">{food.name}</p>
                                    <p className="text-sm text-gray-600">{food.food_code}・{food.food_group_name}</p>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
