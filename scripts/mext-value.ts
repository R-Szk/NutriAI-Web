/** 食品成分表に記載された数値と特殊記号を、DB保存用の値と状態へ変換する。 */
export type NutrientValueStatus =
  | "measured"
  | "estimated"
  | "zero"
  | "trace"
  | "estimated_trace"
  | "not_measured"
  | "missing"
  | "reference";

type ParsedNutrientValue = {
  amount: number | null;
  valueStatus: NutrientValueStatus;
  rawValue: string;
};

export function parseNutrientValue(
  rawValue: string,
): ParsedNutrientValue {
  const normalizedValue = rawValue.trim();

  // 空欄・参照・未測定・微量は数値変換より先に、表記ごとの意味を確定する。
  if (normalizedValue === "") {
    return {
      amount: null,
      valueStatus: "missing",
      rawValue: normalizedValue,
    };
  }

  if (normalizedValue === "*") {
    return {
      amount: null,
      valueStatus: "reference",
      rawValue: normalizedValue,
    };
  }

  if (normalizedValue === "-") {
    return {
      amount: null,
      valueStatus: "not_measured",
      rawValue: normalizedValue,
    };
  }

  if (normalizedValue === "Tr") {
    return {
      amount: 0,
      valueStatus: "trace",
      rawValue: normalizedValue,
    };
  }

  if (normalizedValue === "(Tr)") {
    return {
      amount: 0,
      valueStatus: "estimated_trace",
      rawValue: normalizedValue,
    };
  }

  // †は数値そのものではなく注記記号なので、rawValueには残しつつ計算時だけ除く。
  const valueWithoutNote = normalizedValue.endsWith("†")
    ? normalizedValue.slice(0, -1)
    : normalizedValue;

  const isEstimated =
    valueWithoutNote.startsWith("(") &&
    valueWithoutNote.endsWith(")");

  const numericText = isEstimated
    ? valueWithoutNote.slice(1, -1)
    : valueWithoutNote;

  const amount = Number(numericText);

  if (!Number.isFinite(amount)) {
    throw new Error(`栄養値を数値に変換できません: ${rawValue}`);
  }

  return {
    amount,
    valueStatus: isEstimated
      ? "estimated"
      : amount === 0
        ? "zero"
        : "measured",
    rawValue: normalizedValue,
  };
}
