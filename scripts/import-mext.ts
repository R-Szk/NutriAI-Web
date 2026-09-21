import {
    parseNutrientValue,
    type NutrientValueStatus,
} from "./mext-value";
import ExcelJS from "exceljs";

import { NUTRIENT_DEFINITIONS } from "./mext-nutrients";

import { getFoodGroupName } from "./mext-food-groups";
import { createAdminClient } from "./supabase-admin";

import { selectFoodByCode } from "./mext-food-selection";

const SHEET_NAME = "表全体";
const FIRST_DATA_ROW = 13;

const APPLY_FOODS_FLAG = "--apply-foods";
const BATCH_SIZE = 500;
const SOURCE = "MEXT";
const SOURCE_VERSION = "八訂増補2023年（2026年3月27日更新）";

const FOOD_CODE_OPTION = "--food-code";

const APPLY_FOOD_NUTRIENTS_FLAG = "--apply-food-nutrients";
const APPLY_ALL_FOOD_NUTRIENTS_FLAG = "--apply-all-food-nutrients";

const SELECT_PAGE_SIZE = 1000;

function getCellText(row: ExcelJS.Row, columnNumber: number) {
    return row.getCell(columnNumber).text.trim();
}

function splitIntoBatches<T>(items: T[], batchSize:number) {
    const batches: T[][] = [];

    for (let index = 0; index < items.length; index += batchSize) {
        batches.push(items.slice(index, index + batchSize));
    }

    return batches;
}

async function main() {
    const sourcePath = process.argv[2];
    if(!sourcePath) {
        throw new Error("Excelファイルのパスを指定してください");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(sourcePath);

    const worksheet = workbook.getWorksheet(SHEET_NAME);
    if(!worksheet) {
        throw new Error(`シート「${SHEET_NAME}」が見つかりません`);
    }

    for(const nutrient of NUTRIENT_DEFINITIONS) {
        const actualSourceCode = getCellText(
            worksheet.getRow(12),
            nutrient.column,
        );

        if(actualSourceCode !== nutrient.sourceCode) {
            throw new Error(
                `${nutrient.name}の列が想定と異なります。` +
                    `期待値: ${nutrient.sourceCode}, 実際: ${actualSourceCode}`,
            );
        }
    }

    const foods = [];
    for (
        let rowNumber = FIRST_DATA_ROW;
        rowNumber <= worksheet.rowCount;
        rowNumber++
    ) {
        const row = worksheet.getRow(rowNumber);

        const foodGroupCode = getCellText(row, 1);
        const foodCode = getCellText(row, 2);
        const name = getCellText(row, 4);

        if(!foodCode || !name) {
            continue;
        }

        foods.push({
            rowNumber,
            foodGroupCode,
            foodCode,
            name,
        });
    }

    console.log(`シート名: ${worksheet.name}`);
    console.log(`最終行: ${worksheet.rowCount}`);
    console.log(`食品件数: ${foods.length}`);
    console.table(foods.slice(0, 3));

    const foodCodeOptionIndex = process.argv.indexOf(FOOD_CODE_OPTION);
    const selectedFoodCode = foodCodeOptionIndex === -1
        ? null
        : process.argv[foodCodeOptionIndex + 1];

    if (foodCodeOptionIndex !== -1 && !selectedFoodCode) {
        throw new Error("--food-code の後に食品コードを指定してください");
    }

    const shouldApplyFoods = process.argv.includes(
        APPLY_FOODS_FLAG,
    );

    if (shouldApplyFoods) {
        const foodRecords = foods.map((food) => ({
            food_code: food.foodCode,
            name: food.name,
            food_group_code: food.foodGroupCode,
            food_group_name: getFoodGroupName(food.foodGroupCode),
            source: SOURCE,
            source_version: SOURCE_VERSION,
        }));

        const batches = splitIntoBatches(
            foodRecords,
            BATCH_SIZE,
        );

        const supabase = createAdminClient();

        for (const [index, batch] of batches.entries()) {
            const { error } = await supabase
                .from("foods")
                .upsert(batch, {
                    onConflict: "food_code",
                });

            if (error) {
                throw new Error(
                    `食品の登録に失敗しました` +
                        ` (${index + 1}/${batches.length}) : ` + error.message,
                );
            }

            console.log(
                `食品を登録しました: ${index + 1}/${batches.length}`,
            );
        }

        console.log(`食品を${foodRecords.length}件登録しました`);
        return;
    }

    const targetFoods = selectedFoodCode
        ? [selectFoodByCode(foods, selectedFoodCode)]
        : foods;

    const foodNutrients = targetFoods.flatMap((food) => {
        const row = worksheet.getRow(food.rowNumber);

        return NUTRIENT_DEFINITIONS.map((nutrient) => {
            const rawValue = getCellText(row, nutrient.column);
            const parsedValue = parseNutrientValue(rawValue);

            return {
                foodCode: food.foodCode,
                nutrientCode: nutrient.code,
                nutrientName: nutrient.name,
                amount: parsedValue.amount,
                valueStatus: parsedValue.valueStatus,
                rawValue: parsedValue.rawValue,
                unit: nutrient.unit,
            }
        });
    });

    console.log(`栄養値件数: ${foodNutrients.length}`);
    console.table(foodNutrients.slice(0, 12));

    const statusCounts: Record<NutrientValueStatus, number> = {
        measured: 0,
        estimated: 0,
        zero: 0,
        trace: 0,
        estimated_trace: 0,
        not_measured: 0,
        missing: 0,
        reference: 0,
    };

    for(const foodNutrient of foodNutrients) {
        statusCounts[foodNutrient.valueStatus]++;
    }

    console.table(statusCounts);

    const shouldApplyFoodNutrients = process.argv.includes(APPLY_FOOD_NUTRIENTS_FLAG);

    const shouldApplyAllFoodNutrients = process.argv.includes(APPLY_ALL_FOOD_NUTRIENTS_FLAG);

    if (!shouldApplyFoodNutrients && !shouldApplyAllFoodNutrients) {
        return;
    }

    if (shouldApplyFoodNutrients && shouldApplyAllFoodNutrients) {
        throw new Error(
            "1食品登録と全件登録は同時に指定できません",
        );
    }

    if (shouldApplyFoodNutrients && !selectedFoodCode) {
        throw new Error(
            "--apply-food-nutrientsには--food-codeの指定が必要です",
        );
    }

    if (shouldApplyAllFoodNutrients && selectedFoodCode) {
        throw new Error(
            "--apply-all-food-nutrientsでは--food-codeを指定しないでください",
        );
    }

    const supabase = createAdminClient();

    const foodIdByCode = new Map<string, number>();

    if (selectedFoodCode) {
        const { data: foodRecord, error: foodError } = await supabase
            .from("foods")
            .select("id, food_code")
            .eq("food_code", selectedFoodCode)
            .single();

        if (foodError) {
            throw new Error(`食品IDの取得に失敗しました: ${foodError.message}`);
        }

        foodIdByCode.set(foodRecord.food_code, foodRecord.id);
    } else {
        for (let from = 0; ; from += SELECT_PAGE_SIZE) {
            const { data: foodRecords, error: foodError } =
                await supabase
                    .from("foods")
                    .select("id, food_code")
                    .eq("source", SOURCE)
                    .order("id")
                    .range(from, from + SELECT_PAGE_SIZE - 1);

            if (foodError) {
                throw new Error(`食品IDの取得に失敗しました: ${foodError.message}`);
            }

            for (const foodRecord of foodRecords) {
                foodIdByCode.set(foodRecord.food_code, foodRecord.id);
            }

            if (foodRecords.length < SELECT_PAGE_SIZE) {
                break;
            }
        }
    }

    if (foodIdByCode.size !== targetFoods.length) {
        throw new Error(
            `食品IDの件数が一致しません。` +
            `期待値: ${targetFoods.length}, ` +
            `実際: ${foodIdByCode.size}`
        );
    }

    const nutrientCodes = NUTRIENT_DEFINITIONS.map((nutrient) => nutrient.code);

    const { data: nutrientRecords, error: nutrientError } = await supabase
        .from("nutrients")
        .select("id, code")
        .in("code", nutrientCodes);

    if (nutrientError) {
        throw new Error(
            `栄養素IDの取得に失敗しました: ${nutrientError.message}`,
        );
    }

    const nutrientIdByCode = new Map(
        nutrientRecords.map((nutrient) => [
            nutrient.code,
            nutrient.id,
        ]),
    );

    const databaseRecords = foodNutrients.map((foodNutrient) => {
        const foodId = foodIdByCode.get(foodNutrient.foodCode);

        if(!foodId) {
            throw new Error(`食品IDが見つかりません: ${foodNutrient.foodCode}`);
        }

        const nutrientId = nutrientIdByCode.get(
            foodNutrient.nutrientCode,
        );

        if (!nutrientId) {
            throw new Error(
                `栄養素IDが見つかりません: ${foodNutrient.nutrientCode}`,
            );
        }

        return {
            food_id: foodId,
            nutrient_id: nutrientId,
            amount: foodNutrient.amount,
            value_status: foodNutrient.valueStatus,
            raw_value: foodNutrient.rawValue,
        };
    });

    const databaseBatches = splitIntoBatches(databaseRecords, BATCH_SIZE);

    for (const [index, batch] of databaseBatches.entries()) {
        const { error: upsertError } = await supabase
            .from("food_nutrients")
            .upsert(batch, {
                onConflict: "food_id,nutrient_id",
            });

        if (upsertError) {
            throw new Error(
            `栄養値の登録に失敗しました` +
                `（${index + 1}/${databaseBatches.length}）: ` +
                upsertError.message,
            );
        }

        console.log(
            `栄養値を登録しました: ` +
            `${index + 1}/${databaseBatches.length}`,
        );
    }

    if (selectedFoodCode) {
        console.log(
            `${selectedFoodCode}の栄養値を` +
            `${databaseRecords.length}件登録しました`,
        );
        } else {
        console.log(
            `全食品の栄養値を` +
            `${databaseRecords.length}件登録しました`,
        );
    }
}

main().catch((error: unknown) => {
    console.log("Excelの読み込みに失敗しました");
    if(error instanceof Error) {
        console.error(error.message);
    }

    process.exitCode = 1;
});
