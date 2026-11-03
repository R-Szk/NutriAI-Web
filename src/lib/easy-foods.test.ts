/** かんたん食品・標準料理の選択内容と数量検証を確認する。 */
import assert from "node:assert/strict";
import test from "node:test";

import {
    calculateEasyFoodNutrients,
    calculateSelectedEasyFoodNutrients,
    rankEasyFoodCandidates,
    scaleServingComponents,
    validateMealEntrySelection,
    type EasyFoodCandidate,
} from "./easy-foods";

import {
    mapPresetRecordToCandidate,
    mapRecipeRecordToCandidate,
    searchEasyFoods,
} from "./supabase/easy-foods";

test("有効な食品・標準量・標準料理を保存可能と判定する", () => {
    assert.equal(
        validateMealEntrySelection({
            sourceType: "food",
            sourceId: 1,
            quantity: 150,
        }),
        null,
    );

    assert.equal(
        validateMealEntrySelection({
            sourceType: "serving_preset",
            sourceId: 2,
            quantity: 2,
        }),
        null,
    );

    assert.equal(
        validateMealEntrySelection({
            sourceType: "standard_recipe",
            sourceId: 3,
            quantity: 1.5,
        }),
        null,
    );
});

test("0以下または有限でない数量を拒否する", () => {
    for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.notEqual(
            validateMealEntrySelection({
                sourceType: "food",
                sourceId: 1,
                quantity,
            }),
            null,
        );
    }
});

test("記録元ごとの数量上限を超えた値を拒否する", () => {
    assert.notEqual(
        validateMealEntrySelection({
            sourceType: "food",
            sourceId: 1,
            quantity: 10000.1,
        }),
        null,
    );

    for (const sourceType of [
        "serving_preset",
        "standard_recipe",
    ] as const) {
        assert.notEqual(
            validateMealEntrySelection({
                sourceType,
                sourceId: 1,
                quantity: 100.1,
            }),
            null,
        );
    }
});

test("正の整数ではない記録元IDを拒否する", () => {
    for (const sourceId of [
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
    ]) {
        assert.notEqual(
            validateMealEntrySelection({
                sourceType: "food",
                sourceId,
                quantity: 100,
            }),
            null,
        );
    }
});

test("記録元ごとの数量上限値は保存可能と判定する", () => {
    assert.equal(
        validateMealEntrySelection({
            sourceType: "food",
            sourceId: 1,
            quantity: 10000,
        }),
        null,
    );

    assert.equal(
        validateMealEntrySelection({
            sourceType: "standard_recipe",
            sourceId: 1,
            quantity: 100,
        }),
        null,
    );
});

test("数量に応じて全ての構成食品の重量を拡大できる", () => {
    const components = [
        {
            foodId: 1,
            foodCode: "TEST001",
            name: "食品A",
            amountG: 50,
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
            foodId: 2,
            foodCode: "TEST002",
            name: "食品B",
            amountG: 25,
            nutrients: [],
        },
    ];

    const scaled = scaleServingComponents(components, 2);

    assert.deepEqual(
        scaled.map((component) => component.amountG),
        [100, 50],
    );

    // 栄養値が欠損している状態は、数量を変えても勝手に0へ変えない。
    assert.equal(
        scaled[0].nutrients[1].amountPer100g,
        null,
    );

    // 元の配列を書き換えず、新しい結果を返す。
    assert.deepEqual(
        components.map((component) => component.amountG),
        [50, 25],
    );
});

test("固定量候補の重量に応じて栄養値を計算できる", () => {
    const candidate: EasyFoodCandidate = {
        sourceType: "serving_preset",
        sourceId: 10,
        displayName: "納豆",
        description: null,
        sourceDescription: "テスト用の根拠",
        sourceUrl: null,
        sourceCheckedAt: "2026-10-26",
        searchKeywords: ["納豆"],
        unitLabel: "1パック",
        priority: 100,
        isActive: true,
        servingChoices: [
            {
                id: 20,
                label: "2パック（90g）",
                amountG: 90,
                displayOrder: 0,
            },
        ],
        components: [
            {
                foodId: 100,
                foodCode: "04046",
                name: "糸引き納豆",
                amountG: 45,
                nutrients: [
                    {
                        code: "energy_kcal",
                        name: "エネルギー",
                        unit: "kcal",
                        displayOrder: 2,
                        amountPer100g: 184,
                        valueStatus: "measured",
                    },
                ],
            },
        ],
        nutrients: [],
    };

    const nutrients = calculateSelectedEasyFoodNutrients(
        candidate,
        {
            sourceType: "serving_preset",
            sourceId: 10,
            servingOptionId: 20,
            quantity: 1,
        },
    );

    assert.equal(nutrients?.[0].amount, 165.6);
});

test("任意グラムで元食品の栄養値を計算できる", () => {
    const candidate: EasyFoodCandidate = {
        sourceType: "serving_preset",
        sourceId: 10,
        displayName: "納豆",
        description: null,
        sourceDescription: "テスト用の根拠",
        sourceUrl: null,
        sourceCheckedAt: "2026-10-26",
        searchKeywords: ["納豆"],
        unitLabel: "1パック",
        priority: 100,
        isActive: true,
        servingChoices: [],
        components: [
            {
                foodId: 100,
                foodCode: "04046",
                name: "糸引き納豆",
                amountG: 45,
                nutrients: [
                    {
                        code: "energy_kcal",
                        name: "エネルギー",
                        unit: "kcal",
                        displayOrder: 2,
                        amountPer100g: 184,
                        valueStatus: "measured",
                    },
                ],
            },
        ],
        nutrients: [],
    };

    const nutrients = calculateSelectedEasyFoodNutrients(
        candidate,
        {
            sourceType: "food",
            sourceId: 100,
            quantity: 60,
        },
    );

    assert.equal(nutrients?.[0].amount, 110.4);
});

function createCandidate(
    input: Pick<
        EasyFoodCandidate,
        | "sourceId"
        | "displayName"
        | "searchKeywords"
        | "priority"
        | "isActive"
    >,
): EasyFoodCandidate {
    return {
        sourceType: "serving_preset",
        sourceId: input.sourceId,
        displayName: input.displayName,
        description: null,
        sourceDescription: "テスト用の根拠",
        sourceUrl: null,
        sourceCheckedAt: "2026-10-26",
        searchKeywords: input.searchKeywords,
        unitLabel: "1個",
        priority: input.priority,
        isActive: input.isActive,
        servingChoices: [],
        components: [],
        nutrients: [],
    };
}

test("一致方法と優先度に従って検索結果を最大5件に並べる", () => {
    const candidates: EasyFoodCandidate[] = [
        createCandidate({
            sourceId: 1,
            displayName: "納豆",
            searchKeywords: ["なっとう"],
            priority: 50,
            isActive: true,
        }),
        createCandidate({
            sourceId: 2,
            displayName: "納豆ご飯",
            searchKeywords: [],
            priority: 100,
            isActive: true,
        }),
        createCandidate({
            sourceId: 3,
            displayName: "糸引き納豆",
            searchKeywords: ["納豆"],
            priority: 90,
            isActive: true,
        }),
        createCandidate({
            sourceId: 4,
            displayName: "国産大豆の納豆",
            searchKeywords: [],
            priority: 200,
            isActive: true,
        }),
        createCandidate({
            sourceId: 5,
            displayName: "干し納豆",
            searchKeywords: [],
            priority: 20,
            isActive: true,
        }),
        createCandidate({
            sourceId: 6,
            displayName: "納豆巻き",
            searchKeywords: [],
            priority: 10,
            isActive: true,
        }),
        createCandidate({
            sourceId: 7,
            displayName: "納豆",
            searchKeywords: [],
            priority: 999,
            isActive: false,
        }),
        createCandidate({
            sourceId: 8,
            displayName: "豆腐",
            searchKeywords: [],
            priority: 999,
            isActive: true,
        }),
    ];

    const results = rankEasyFoodCandidates(
        "　納豆　",
        candidates,
    );

    assert.deepEqual(
        results.map((candidate) => candidate.sourceId),
        [3, 1, 2, 6, 4],
    );
});

test("複数の構成食品から主要栄養素を合計できる", () => {
    const nutrients = calculateEasyFoodNutrients([
        {
            foodId: 1,
            foodCode: "TEST001",
            name: "食品A",
            amountG: 150,
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
            foodId: 2,
            foodCode: "TEST002",
            name: "食品B",
            amountG: 50,
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
                    code: "fat",
                    name: "脂質",
                    unit: "g",
                    displayOrder: 8,
                    amountPer100g: 4,
                    valueStatus: "measured",
                },
            ],
        },
    ]);

    assert.deepEqual(nutrients, [
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

test("全材料で欠損している栄養素を0と判定しない", () => {
    const nutrients = calculateEasyFoodNutrients([
        {
            foodId: 1,
            foodCode: "TEST001",
            name: "食品A",
            amountG: 100,
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
    ]);

    assert.deepEqual(nutrients, [
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

test("空白だけの検索語では候補を返さない", () => {
    const results = rankEasyFoodCandidates(
        "　  　",
        [
            createCandidate({
                sourceId: 1,
                displayName: "納豆",
                searchKeywords: [],
                priority: 100,
                isActive: true,
            }),
        ],
    );

    assert.deepEqual(results, []);
});

test("全角英字と大文字小文字を区別せず検索できる", () => {
    const results = rankEasyFoodCandidates(
        "　ＣＵＲＲＹ　",
        [
            createCandidate({
                sourceId: 1,
                displayName: "Curry Rice",
                searchKeywords: [],
                priority: 100,
                isActive: true,
            }),
        ],
    );

    assert.deepEqual(
        results.map((candidate) => candidate.sourceId),
        [1],
    );
});

test("一致方法と優先度が同じ候補は元の順序を維持する", () => {
    const results = rankEasyFoodCandidates(
        "納豆",
        [
            createCandidate({
                sourceId: 20,
                displayName: "食品A",
                searchKeywords: ["納豆"],
                priority: 100,
                isActive: true,
            }),
            createCandidate({
                sourceId: 10,
                displayName: "食品B",
                searchKeywords: ["納豆"],
                priority: 100,
                isActive: true,
            }),
        ],
    );

    assert.deepEqual(
        results.map((candidate) => candidate.sourceId),
        [20, 10],
    );
});

test("Supabaseの標準量データを画面用候補へ変換できる", () => {
    const candidate = mapPresetRecordToCandidate({
        id: 11,
        display_name: "納豆",
        search_keywords: ["納豆", "なっとう"],
        default_amount_g: 45,
        unit_label: "1パック",
        priority: 90,
        source_description: "農林水産省の資料を参考に設定",
        source_url: "https://example.com/natto",
        source_checked_at: "2026-10-26",
        is_active: true,
        food_serving_options: [
            {
                id: 202,
                display_name: "2パック（90g）",
                amount_g: 90,
                display_order: 1,
            },
            {
                id: 201,
                display_name: "1パック（45g）",
                amount_g: 45,
                display_order: 0,
            },
        ],
        foods: {
            id: 101,
            food_code: "04046",
            name: "糸引き納豆",
            food_nutrients: [
                {
                    amount: 184,
                    value_status: "measured",
                    nutrients: {
                        code: "energy_kcal",
                        name: "エネルギー",
                        unit: "kcal",
                        display_order: 2,
                        is_primary: true,
                    },
                },
                {
                    amount: 9.5,
                    value_status: "measured",
                    nutrients: {
                        code: "dietary_fiber",
                        name: "食物繊維総量",
                        unit: "g",
                        display_order: 12,
                        is_primary: false,
                    },
                },
            ],
        },
    });

    assert.equal(candidate.sourceType, "serving_preset");
    assert.equal(candidate.sourceId, 11);
    assert.equal(candidate.displayName, "納豆");
    assert.equal(candidate.description, null);
    assert.equal(
        candidate.sourceDescription,
        "農林水産省の資料を参考に設定",
    );
    assert.equal(candidate.sourceUrl, "https://example.com/natto");
    assert.equal(candidate.sourceCheckedAt, "2026-10-26");

    assert.deepEqual(
        candidate.servingChoices.map((choice) => ({
            id: choice.id,
            label: choice.label,
        })),
        [
            {
                id: 201,
                label: "1パック（45g）",
            },
            {
                id: 202,
                label: "2パック（90g）",
            },
        ],
    );

    assert.equal(candidate.components[0].amountG, 45);

    // 184kcal × 45g ÷ 100g = 82.8kcal
    assert.deepEqual(candidate.nutrients, [
        {
            code: "energy_kcal",
            name: "エネルギー",
            unit: "kcal",
            displayOrder: 2,
            amount: 82.8,
            hasMissingValue: false,
            hasKnownValue: true,
        },
    ]);
});

test("Supabaseの標準レシピを材料と栄養値を持つ候補へ変換できる", () => {
    const candidate = mapRecipeRecordToCandidate({
        id: 21,
        display_name: "テスト料理",
        search_keywords: ["料理"],
        unit_label: "1食",
        description: "NutriAI標準レシピ",
        priority: 80,
        source_description: "公的資料と一般的なレシピを参考に設定",
        source_url: "https://example.com/curry",
        source_checked_at: "2026-10-26",
        is_active: true,
        standard_recipe_items: [
            {
                amount_g: 50,
                display_order: 1,
                foods: {
                    id: 102,
                    food_code: "TEST002",
                    name: "食品B",
                    food_nutrients: [
                        {
                            amount: 200,
                            value_status: "measured",
                            nutrients: {
                                code: "energy_kcal",
                                name: "エネルギー",
                                unit: "kcal",
                                display_order: 2,
                                is_primary: true,
                            },
                        },
                        {
                            amount: 4,
                            value_status: "measured",
                            nutrients: {
                                code: "fat",
                                name: "脂質",
                                unit: "g",
                                display_order: 8,
                                is_primary: true,
                            },
                        },
                    ],
                },
            },
            {
                amount_g: 100,
                display_order: 0,
                foods: {
                    id: 101,
                    food_code: "TEST001",
                    name: "食品A",
                    food_nutrients: [
                        {
                            amount: 100,
                            value_status: "measured",
                            nutrients: {
                                code: "energy_kcal",
                                name: "エネルギー",
                                unit: "kcal",
                                display_order: 2,
                                is_primary: true,
                            },
                        },
                        {
                            amount: null,
                            value_status: "not_measured",
                            nutrients: {
                                code: "fat",
                                name: "脂質",
                                unit: "g",
                                display_order: 8,
                                is_primary: true,
                            },
                        },
                    ],
                },
            },
        ],
    });

    assert.equal(candidate.sourceType, "standard_recipe");
    assert.equal(candidate.sourceId, 21);
    assert.equal(candidate.displayName, "テスト料理");
    assert.equal(candidate.description, "NutriAI標準レシピ");
    assert.equal(
        candidate.sourceDescription,
        "公的資料と一般的なレシピを参考に設定",
    );
    assert.equal(candidate.sourceUrl, "https://example.com/curry");
    assert.equal(candidate.sourceCheckedAt, "2026-10-26");
    assert.deepEqual(candidate.servingChoices, []);

    // DBから逆順で届いてもdisplay_order順へ並べる。
    assert.deepEqual(
        candidate.components.map((component) => component.foodCode),
        ["TEST001", "TEST002"],
    );

    assert.deepEqual(
        candidate.components.map((component) => component.amountG),
        [100, 50],
    );

    assert.deepEqual(candidate.nutrients, [
        {
            code: "energy_kcal",
            name: "エネルギー",
            unit: "kcal",
            displayOrder: 2,
            amount: 200,
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

test("空白だけの検索語ではDB検索を行わず空配列を返す", async () => {
    const results = await searchEasyFoods("　  　");

    assert.deepEqual(results, []);
});

test("標準量では量候補IDを指定できる", () => {
    assert.equal(
        validateMealEntrySelection({
            sourceType: "serving_preset",
            sourceId: 10,
            servingOptionId: 20,
            quantity: 1,
        }),
        null,
    );
});

test("不正な量候補IDを拒否する", () => {
    for (const servingOptionId of [
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
    ]) {
        assert.notEqual(
            validateMealEntrySelection({
                sourceType: "serving_preset",
                sourceId: 10,
                servingOptionId,
                quantity: 1,
            }),
            null,
        );
    }
});

test("詳細食品や標準料理には量候補IDを指定できない", () => {
    for (const sourceType of [
        "food",
        "standard_recipe",
    ] as const) {
        assert.notEqual(
            validateMealEntrySelection({
                sourceType,
                sourceId: 10,
                servingOptionId: 20,
                quantity: 1,
            }),
            null,
        );
    }
});
