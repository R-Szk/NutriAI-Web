"use client";

import { type SubmitEvent, useState } from "react";
import {
    MEAL_TYPE_LABELS,
    type MealType,
} from "@/lib/meals";
import { saveMealItem } from "@/lib/supabase/meal-records";

type MealSaveFormProps = {
    userId: string | null;
    mealDate: string;
    foodId: number;
    amountG: number;
    isAuthLoading: boolean;
    authError: string | null;
    onSaved: () => void;
};

export default function MealSaveForm({
    userId,
    mealDate,
    foodId,
    amountG,
    isAuthLoading,
    authError,
    onSaved,
}: MealSaveFormProps) {
    const [mealType, setMealType] = useState<MealType>("breakfast");
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");

    async function handleSubmit(event:SubmitEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!userId) {
            setSaveMessage("匿名認証が完了していません");
            return;
        }

        setIsSaving(true);
        setSaveMessage("");

        try {
            await saveMealItem({
                userId,
                mealDate,
                mealType,
                foodId,
                amountG,
            });

            setSaveMessage("食事を保存しました");
            onSaved();
        } catch (error) {
            setSaveMessage(error instanceof Error ? error.message : "食事の保存に失敗しました");
        } finally {
            setIsSaving(false);
        }
    }

    const isSaveDisabled = isSaving || isAuthLoading || !userId || Boolean(authError);

    return (
        <form
            className="mt-6 rounded border border-green-200 bg-green-50 p-4"
            onSubmit={handleSubmit}
        >
            <label className="flex max-w-xs flex-col gap-1">
                <span className="text-sm font-medium">食事区分</span>

                <select
                    className="rounded border bg-white px-3 py-2"
                    value={mealType}
                    onChange={(event) => setMealType(event.target.value as MealType)}>
                    {Object.entries(MEAL_TYPE_LABELS).map(
                        ([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ),
                    )}
                </select>
            </label>

            <button
                className="mt-4 rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
                type="submit"
                disabled={isSaveDisabled}>
                {isSaving ? "保存中..." : "食事に保存"}
            </button>

            {saveMessage && (
                <p className="mt-2 text-sm">{saveMessage}</p>
            )}
        </form>
    )
}