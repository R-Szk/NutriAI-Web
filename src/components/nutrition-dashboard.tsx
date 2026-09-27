"use client";

/** 記録日と匿名認証状態を管理し、配下の食事機能へ共有する親コンポーネント。 */
import { useState } from "react";
import FoodSearch from "@/components/food-search";
import { useAnonymousSession } from "@/hooks/use-anonymous-session";
import { getLocalDateString } from "@/lib/meals";

export default function NutritionDashboard() {
    // UTC変換による日付ずれを避け、ブラウザのローカル日付を初期値にする。
    const [mealDate, setMealDate] = useState(() => getLocalDateString(new Date()));

    const {
        userId,
        isAuthLoading,
        authError,
    } = useAnonymousSession();

    return (
        <>
            <section className="mt-8">
                <label className="flex max-w-xs flex-col gap-1">
                    <span className="text-sm font-medium">記録日</span>
                    <input
                        className="rounded border px-3 py-2"
                        type="date"
                        value={mealDate}
                        onChange={(event) => setMealDate(event.target.value)}
                    />
                </label>

                {isAuthLoading && (
                    <p className="mt-2 text-sm text-gray-600">記録機能を準備しています...</p>
                )}

                {authError && (
                    <p className="mt-2 text-sm text-red-700">匿名認証に失敗しました: {authError}</p>
                )}

            </section>

            <FoodSearch
                mealDate={mealDate}
                userId={userId}
                isAuthLoading={isAuthLoading}
                authError={authError}
            />
        </>
    );
}
