/** 食品追加画面のURL検証と遷移先URLの生成を保証する。 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardHref,
  buildRecordHref,
  parseMealNavigationContext,
} from "./meal-navigation";

test("有効な日付と食事区分を受け取れる", () => {
  assert.deepEqual(
    parseMealNavigationContext("2026-10-10", "breakfast"),
    {
      mealDate: "2026-10-10",
      mealType: "breakfast",
    },
  );
});

test("不正な日付を拒否する", () => {
  assert.equal(
    parseMealNavigationContext("2026-02-30", "breakfast"),
    null,
  );
  assert.equal(
    parseMealNavigationContext(["2026-10-10"], "breakfast"),
    null,
  );
  assert.equal(
    parseMealNavigationContext(undefined, "breakfast"),
    null,
  );
});

test("不正な食事区分を拒否する", () => {
  assert.equal(
    parseMealNavigationContext("2026-10-10", "朝食"),
    null,
  );
  assert.equal(
    parseMealNavigationContext("2026-10-10", "brunch"),
    null,
  );
  assert.equal(
    parseMealNavigationContext("2026-10-10", ["breakfast"]),
    null,
  );
  assert.equal(
    parseMealNavigationContext("2026-10-10", undefined),
    null,
  );
});

test("食品追加画面のURLを生成できる", () => {
  assert.equal(
    buildRecordHref("2026-10-10", "lunch"),
    "/record?date=2026-10-10&mealType=lunch",
  );
});

test("選択日を維持したダッシュボードURLを生成できる", () => {
  assert.equal(
    buildDashboardHref("2026-10-10"),
    "/?date=2026-10-10",
  );
});