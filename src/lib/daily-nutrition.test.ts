/** 複数食品の栄養値合計と、欠損値の扱いを検証する。 */
import assert from "node:assert/strict";
import test from "node:test";
import type { DailyMealItem } from "@/lib/supabase/meal-records";
import { calculateDailyNutrientTotals } from "./daily-nutrition";

const items: DailyMealItem[] = [
  {
    id: 1,
    amountG: 150,
    food: {
      id: 1,
      foodCode: "TEST001",
      name: "食品A",
    },
    nutrients: [
      {
        code: "energy_kcal",
        name: "エネルギー",
        unit: "kcal",
        displayOrder: 2,
        amountPer100g: 100,
        valueStatus: "measured",
      },
      {
        code: "protein",
        name: "たんぱく質",
        unit: "g",
        displayOrder: 5,
        amountPer100g: 10,
        valueStatus: "measured",
      },
      {
        code: "fat",
        name: "脂質",
        unit: "g",
        displayOrder: 8,
        amountPer100g: null,
        valueStatus: "not_measured",
      },
    ],
  },
  {
    id: 2,
    amountG: 50,
    food: {
      id: 2,
      foodCode: "TEST002",
      name: "食品B",
    },
    nutrients: [
      {
        code: "energy_kcal",
        name: "エネルギー",
        unit: "kcal",
        displayOrder: 2,
        amountPer100g: 200,
        valueStatus: "measured",
      },
      {
        code: "protein",
        name: "たんぱく質",
        unit: "g",
        displayOrder: 5,
        amountPer100g: 20,
        valueStatus: "measured",
      },
      {
        code: "fat",
        name: "脂質",
        unit: "g",
        displayOrder: 8,
        amountPer100g: 4,
        valueStatus: "measured",
      },
    ],
  },
];

test("複数食品の栄養値を摂取量に応じて合計できる", () => {
  const totals = calculateDailyNutrientTotals(items);

  assert.deepEqual(totals, [
    {
      code: "energy_kcal",
      name: "エネルギー",
      unit: "kcal",
      displayOrder: 2,
      amount: 250,
      hasMissingValue: false,
      hasKnownValue: true,
    },
    {
      code: "protein",
      name: "たんぱく質",
      unit: "g",
      displayOrder: 5,
      amount: 25,
      hasMissingValue: false,
      hasKnownValue: true,
    },
    {
      code: "fat",
      name: "脂質",
      unit: "g",
      displayOrder: 8,
      amount: 2,
      hasMissingValue: true,
      hasKnownValue: true,
    },
  ]);
});

test("全食品で値が欠損している栄養素を0と判定しない", () => {
  const missingItems: DailyMealItem[] = [
    {
      id: 3,
      amountG: 100,
      food: {
        id: 3,
        foodCode: "TEST003",
        name: "食品C",
      },
      nutrients: [
        {
          code: "fat",
          name: "脂質",
          unit: "g",
          displayOrder: 8,
          amountPer100g: null,
          valueStatus: "not_measured",
        },
      ],
    },
  ];

  const totals = calculateDailyNutrientTotals(missingItems);

  assert.deepEqual(totals, [
    {
      code: "fat",
      name: "脂質",
      unit: "g",
      displayOrder: 8,
      amount: 0,
      hasMissingValue: true,
      hasKnownValue: false,
    },
  ]);
});