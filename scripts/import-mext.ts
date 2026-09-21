import {
    parseNutrientValue,
    type NutrientValueStatus,
} from "./mext-value";
import ExcelJS from "exceljs";

import { NUTRIENT_DEFINITIONS } from "./mext-nutrients";

const SHEET_NAME = "表全体";
const FIRST_DATA_ROW = 13;

function getCellText(row: ExcelJS.Row, columnNumber: number) {
    return row.getCell(columnNumber).text.trim();
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

    const foodNutrients = foods.flatMap((food) => {
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
}

main().catch((error: unknown) => {
    console.log("Excelの読み込みに失敗しました");
    if(error instanceof Error) {
        console.error(error.message);
    }

    process.exitCode = 1;
});
