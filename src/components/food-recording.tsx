"use client";

/** 食品追加画面の認証状態と、保存成功後の画面遷移を管理する。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import FoodSearch from "@/components/food-search";
import { useAnonymousSession } from "@/hooks/use-anonymous-session";
import {
    MEAL_TYPE_LABELS,
    type MealType,
} from "@/lib/meals";
import { buildDashboardHref } from "@/lib/meal-navigation";

type FoodRecordingProps = {
    mealDate: string;
    mealType: MealType;
};

export default function FoodRecording({
    mealDate,
    mealType,
}: FoodRecordingProps) {
    const router = useRouter();

    const {
        userId,
        isAuthLoading,
        authError,
    } = useAnonymousSession();

    function handleMealSaved() {
        router.replace(buildDashboardHref(mealDate));
    }

    return (
        <>
            <Link
                className="inline-flex text-sm font-medium text-green-800"
                href={buildDashboardHref(mealDate)}
            >
                ← ダッシュボードへ戻る
            </Link>

            <section className="mt-6">
                <p className="text-sm text-gray-600">追加先</p>
                <h1 className="text-2xl font-bold">{mealDate}・{MEAL_TYPE_LABELS[mealType]}</h1>

                {isAuthLoading && (
                    <p className="mt-2 text-sm text-gray-600">記録機能を準備しています...</p>
                )}

                {authError && (
                    <p className="mt-2 text-sm text-red-700">匿名認証に失敗しました: {authError}</p>
                )}
            </section>

            <FoodSearch
                mealDate={mealDate}
                mealType={mealType}
                userId={userId}
                isAuthLoading={isAuthLoading}
                authError={authError}
                onMealSaved={handleMealSaved}
            />
        </>
    );
}