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