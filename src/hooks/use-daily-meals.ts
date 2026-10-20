"use client";

/** 選択日の食事記録と、読み込み・エラー状態を管理する。 */
import { useEffect, useState } from "react";
import {
    type DailyMeal,
    fetchDailyMeals,
} from "@/lib/supabase/meal-records";

type UseDailyMealsResult = {
    meals: DailyMeal[];
    isLoading: boolean;
    loadError: string | null;
};

export function useDailyMeals(
    userId: string | null,
    mealDate: string,
): UseDailyMealsResult {
    const [meals, setMeals] = useState<DailyMeal[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            return;
        }

        const authenticatedUserId = userId;
        let isMounted = true;

        async function loadMeals() {
            setIsLoading(true);
            setLoadError(null);

            try {
                const dailyMeals = await fetchDailyMeals(
                    authenticatedUserId,
                    mealDate
                );

                if (isMounted) {
                    setMeals(dailyMeals);
                }
            } catch (error) {
                if (isMounted) {
                    setMeals([]);
                    setLoadError(error instanceof Error
                        ? error.message
                        : "食事記録の取得に失敗しました"
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        void loadMeals();

        return () => {
            isMounted = false;
        };

    }, [userId, mealDate]);

    if (!userId) {
        return {
            meals: [],
            isLoading: false,
            loadError: null,
        };
    }
    
    return {
        meals,
        isLoading,
        loadError,
    };
}