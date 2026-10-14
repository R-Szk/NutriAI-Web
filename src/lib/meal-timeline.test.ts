/** DB記録の有無にかかわらず、4つの食事区分を固定順で生成できることを保証する。 */
import assert from "node:assert/strict";
import test from "node:test";
import type { DailyMeal } from "@/lib/supabase/meal-records";
import { createMealTimeline } from "./meal-timeline";

test("記録がなくても4つの食事区分を固定順で生成できる", () => {
  const timeline = createMealTimeline([]);

  assert.deepEqual(timeline, [
    {
      mealType: "breakfast",
      label: "朝食",
      meal: null,
    },
    {
      mealType: "lunch",
      label: "昼食",
      meal: null,
    },
    {
      mealType: "dinner",
      label: "夕食",
      meal: null,
    },
    {
      mealType: "snack",
      label: "間食",
      meal: null,
    },
  ]);
});

test("既存の食事を対応する区分へ配置できる", () => {
  const lunch: DailyMeal = {
    id: 10,
    mealType: "lunch",
    items: [],
  };

  const timeline = createMealTimeline([lunch]);

  assert.equal(timeline[0].meal, null);
  assert.equal(timeline[1].meal, lunch);
  assert.equal(timeline[2].meal, null);
  assert.equal(timeline[3].meal, null);
});