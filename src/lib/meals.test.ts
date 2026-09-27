/** 食事区分、ローカル日付、保存前バリデーションの仕様を保証する。 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  getLocalDateString,
  isMealType,
  MEAL_TYPE_LABELS,
  type MealRecordInput,
  validateMealRecordInput,
} from "./meals";

test("食事区分コードを日本語表示へ変換できる", () => {
  assert.equal(MEAL_TYPE_LABELS.breakfast, "朝食");
  assert.equal(MEAL_TYPE_LABELS.lunch, "昼食");
  assert.equal(MEAL_TYPE_LABELS.dinner, "夕食");
  assert.equal(MEAL_TYPE_LABELS.snack, "間食");
});

test("有効な食事区分を判定できる", () => {
  assert.equal(isMealType("breakfast"), true);
  assert.equal(isMealType("lunch"), true);
  assert.equal(isMealType("dinner"), true);
  assert.equal(isMealType("snack"), true);
});

test("日本語や未定義の値を食事区分として認めない", () => {
  assert.equal(isMealType("朝食"), false);
  assert.equal(isMealType("brunch"), false);
  assert.equal(isMealType(""), false);
});

test("ローカル日付をYYYY-MM-DD形式に変換できる", () => {
  const date = new Date(2026, 8, 3);

  assert.equal(getLocalDateString(date), "2026-09-03");
});

// 各異常系ではこの正常値の一項目だけを変え、失敗原因を明確にする。
const validMealRecord: MealRecordInput = {
  userId: "test-user-id",
  mealDate: "2026-09-24",
  mealType: "breakfast",
  foodId: 1,
  amountG: 150,
};

test("正しい食事記録は保存可能と判定する", () => {
  assert.equal(validateMealRecordInput(validMealRecord), null);
});

test("ユーザーIDが空の食事記録を拒否する", () => {
  const result = validateMealRecordInput({
    ...validMealRecord,
    userId: " ",
  });

  assert.equal(typeof result, "string");
});

test("存在しない日付を拒否する", () => {
  const result = validateMealRecordInput({
    ...validMealRecord,
    mealDate: "2026-02-29",
  });

  assert.equal(typeof result, "string");
});

test("未定義の食事区分を拒否する", () => {
  const result = validateMealRecordInput({
    ...validMealRecord,
    mealType: "brunch" as MealRecordInput["mealType"],
  });

  assert.equal(typeof result, "string");
});

test("不正な食品IDを拒否する", () => {
  const result = validateMealRecordInput({
    ...validMealRecord,
    foodId: 0,
  });

  assert.equal(typeof result, "string");
});

test("0以下または有限でない摂取量を拒否する", () => {
  assert.equal(
    typeof validateMealRecordInput({
      ...validMealRecord,
      amountG: 0,
    }),
    "string",
  );

  assert.equal(
    typeof validateMealRecordInput({
      ...validMealRecord,
      amountG: Number.NaN,
    }),
    "string",
  );
});
