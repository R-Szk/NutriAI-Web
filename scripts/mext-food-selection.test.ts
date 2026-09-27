/** 食品コードによる単一食品選択の仕様を固定するテスト。 */
import assert from "node:assert/strict";
import test from "node:test";

import { selectFoodByCode } from "./mext-food-selection";

test("指定した食品コードの食品を取得できる", () => {
  const foods = [
    { foodCode: "01001", name: "アマランサス　玄穀" },
    { foodCode: "01002", name: "あわ　精白粒" },
  ];

  const result = selectFoodByCode(foods, "01001");

  assert.deepEqual(result, {
    foodCode: "01001",
    name: "アマランサス　玄穀",
  });
});
