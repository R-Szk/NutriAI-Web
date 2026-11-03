/** 食事記録の構成食品から、1日分の栄養値を集計できることを検証する。 */
import assert from "node:assert/strict";
import test from "node:test";
import type { DailyMealEntry } from "@/lib/supabase/meal-records";
import { calculateDailyNutrientTotals } from "./daily-nutrition";

const entries: DailyMealEntry[] = [
  {
    id: 1,
    displayName: "標準料理A",
    quantity: 1,
    unitLabel: "1食",
    sourceType: "standard_recipe",
    components: [
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
    ],
  },
  {
    id: 2,
    displayName: "食品A",
    quantity: 100,
    unitLabel: "g",
    sourceType: "food",
    components: [
      {
        id: 3,
        amountG: 100,
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
    ],
  },
];

test("複数entryの全構成食品を重量に応じて合計できる", () => {
  const totals = calculateDailyNutrientTotals(entries);

  assert.deepEqual(totals, [
    {
      code: "energy_kcal",
      name: "エネルギー",
      unit: "kcal",
      displayOrder: 2,
      amount: 350,
      hasMissingValue: false,
      hasKnownValue: true,
    },
    {
      code: "protein",
      name: "たんぱく質",
      unit: "g",
      displayOrder: 5,
      amount: 35,
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

test("全構成食品で欠損している栄養素を0と判定しない", () => {
  const missingEntries: DailyMealEntry[] = [
    {
      id: 3,
      displayName: "欠損料理",
      quantity: 1,
      unitLabel: "1食",
      sourceType: "standard_recipe",
      components: [
        {
          id: 4,
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
      ],
    },
  ];

  const totals = calculateDailyNutrientTotals(missingEntries);

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