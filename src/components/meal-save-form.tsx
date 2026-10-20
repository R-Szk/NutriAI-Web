"use client";

/** 計算済みの食品を、選択した食事区分へ保存するフォーム。 */
import { type SubmitEvent, useState } from "react";
import {
    MEAL_TYPE_LABELS,
    type MealType,
} from "@/lib/meals";
import { saveMealItem } from "@/lib/supabase/meal-records";

type MealSaveFormProps = {
    userId: string | null;
    mealDate: string;
    mealType: MealType;
    foodId: number;
    amountG: number;
    isAuthLoading: boolean;
    authError: string | null;
    onSaved: () => void;
};

export default function MealSaveForm({
    userId,
    mealDate,
    mealType,
    foodId,
    amountG,
    isAuthLoading,
    authError,
    onSaved,
}: MealSaveFormProps) {
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

        // DB処理の成功・失敗をこのフォーム内で利用者へフィードバックする。
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

    // 認証が確定していない間は、所有者不明のレコードを送信しない。
    const isSaveDisabled = isSaving || isAuthLoading || !userId || Boolean(authError);

    return (
        <form
            className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4"
            onSubmit={handleSubmit}
        >
            <div>
                <p className="text-sm font-medium">追加先</p>
                <p className="mt-1">
                    {mealDate}・{MEAL_TYPE_LABELS[mealType]}
                </p>
            </div>

            <button
                className="mt-4 h-12 w-full rounded-xl bg-green-700 px-4 font-semibold text-white disabled:opacity-50"
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
