/** 1日分の食品から主要栄養素を合計する純粋関数。 */
import { calculateNutrientAmount } from "@/lib/food-search";
import type { DailyMealEntry } from "@/lib/supabase/meal-records";

export type DailyNutrientTotal = {
    code: string;
    name: string;
    unit: string;
    displayOrder: number;
    amount: number;
    hasMissingValue: boolean;
    hasKnownValue: boolean;
};

export function calculateDailyNutrientTotals(entries: DailyMealEntry[]): DailyNutrientTotal[] {
    const totalsByCode = new Map<string, DailyNutrientTotal>();

    for (const entry of entries) {
        for (const component of entry.components) {
            for (const nutrient of component.nutrients) {
                const currentTotal = totalsByCode.get(nutrient.code) ?? {
                    code: nutrient.code,
                    name: nutrient.name,
                    unit: nutrient.unit,
                    displayOrder: nutrient.displayOrder,
                    amount: 0,
                    hasMissingValue: false,
                    hasKnownValue: false,
                };

                if (nutrient.amountPer100g === null) {
                    currentTotal.hasMissingValue = true;
                } else {
                    currentTotal.amount += calculateNutrientAmount(nutrient.amountPer100g, component.amountG);
                    currentTotal.hasKnownValue = true;
                }

                totalsByCode.set(nutrient.code, currentTotal);
            }
        }
    }

    return [...totalsByCode.values()].sort(
        (a, b) => a.displayOrder - b.displayOrder,
    );
}