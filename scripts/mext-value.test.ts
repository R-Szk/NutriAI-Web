import assert from "node:assert/strict";
import test from "node:test";

import { parseNutrientValue } from "./mext-value";

const cases = [
  {
    input: "12.3",
    expected: {
      amount: 12.3,
      valueStatus: "measured",
      rawValue: "12.3",
    },
  },
  {
    input: "(12.3)",
    expected: {
      amount: 12.3,
      valueStatus: "estimated",
      rawValue: "(12.3)",
    },
  },
  {
    input: "0",
    expected: {
      amount: 0,
      valueStatus: "zero",
      rawValue: "0",
    },
  },
  {
    input: "(0)",
    expected: {
      amount: 0,
      valueStatus: "estimated",
      rawValue: "(0)",
    },
  },
  {
    input: "Tr",
    expected: {
      amount: 0,
      valueStatus: "trace",
      rawValue: "Tr",
    },
  },
  {
    input: "(Tr)",
    expected: {
      amount: 0,
      valueStatus: "estimated_trace",
      rawValue: "(Tr)",
    },
  },
  {
    input: "-",
    expected: {
      amount: null,
      valueStatus: "not_measured",
      rawValue: "-",
    },
  },
  {
    input: "",
    expected: {
      amount: null,
      valueStatus: "missing",
      rawValue: "",
    },
  },
] as const;

for (const testCase of cases) {
  test(`「${testCase.input}」を変換できる`, () => {
    const result = parseNutrientValue(testCase.input);

    assert.deepEqual(result, testCase.expected);
  });
}

test("注記記号付きの数値を測定値として変換できる", () => {
  const result = parseNutrientValue("20.3†");

  assert.deepEqual(result, {
    amount: 20.3,
    valueStatus: "measured",
    rawValue: "20.3†",
  });
});

test("別章参照をreferenceとして変換できる", () => {
  const result = parseNutrientValue("*");

  assert.deepEqual(result, {
    amount: null,
    valueStatus: "reference",
    rawValue: "*",
  });
});