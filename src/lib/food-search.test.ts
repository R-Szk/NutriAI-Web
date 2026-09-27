/** 食品検索入力、摂取量入力、100g当たり栄養値の比例計算を検証する。 */
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSearchQuery, parseIntakeAmount, calculateNutrientAmount } from "./food-search";

test("検索語の前後の空白を取り除く", () => {
    const result = normalizeSearchQuery(" りんご ");

    assert.equal(result, "りんご");
});

test("正の数を摂取量として変換できる", () => {
    assert.equal(parseIntakeAmount("150"), 150);
    assert.equal(parseIntakeAmount("100.5"), 100.5);
});

test("不正な摂取量はnullになる", () => {
    assert.equal(parseIntakeAmount(""), null);
    assert.equal(parseIntakeAmount("0"), null);
    assert.equal(parseIntakeAmount("-1"), null);
    assert.equal(parseIntakeAmount("abc"), null);
    assert.equal(parseIntakeAmount("Infinity"), null);
});

test("150g分のエネルギーを計算できる", () => {
  assert.equal(
    calculateNutrientAmount(343, 150),
    514.5,
  );
});

test("50g分のたんぱく質を計算できる", () => {
  assert.equal(
    calculateNutrientAmount(12.7, 50),
    6.35,
  );
});
