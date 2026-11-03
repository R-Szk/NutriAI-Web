"use client";

/** 標準量・数量・任意グラムを保存用の選択内容へ変換する。 */
import { type SubmitEvent, useState } from "react";
import {
  type EasyFoodCandidate,
  type MealEntrySelection,
  validateMealEntrySelection,
} from "@/lib/easy-foods";

type ServingSelectorProps = {
  candidate: EasyFoodCandidate;
  selection: MealEntrySelection | null;
  onChange: (selection: MealEntrySelection | null) => void;
};

function getTotalAmountG(candidate: EasyFoodCandidate): number {
  return candidate.components.reduce(
    (total, component) => total + component.amountG,
    0,
  );
}

export default function ServingSelector({
  candidate,
  selection,
  onChange,
}: ServingSelectorProps) {
  const [quantityText, setQuantityText] = useState("1");
  const [gramText, setGramText] = useState("");
  const [message, setMessage] = useState("");

  const totalAmountG = getTotalAmountG(candidate);
  const canUseCustomGrams =
    candidate.sourceType === "serving_preset"
    && candidate.components.length === 1;

  function selectDefaultServing() {
    const nextSelection: MealEntrySelection = {
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      quantity: 1,
    };

    onChange(nextSelection);
    setQuantityText("1");
    setGramText("");
    setMessage(`${candidate.unitLabel}を選択しました`);
  }

  function selectServingChoice(
    servingOptionId: number,
    label: string,
  ) {
    const nextSelection: MealEntrySelection = {
      sourceType: "serving_preset",
      sourceId: candidate.sourceId,
      servingOptionId,
      quantity: 1,
    };

    onChange(nextSelection);
    setQuantityText("1");
    setGramText("");
    setMessage(`${label}を選択しました`);
  }

  function handleQuantitySubmit(
    event: SubmitEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const quantity = Number(quantityText);

    const nextSelection: MealEntrySelection = {
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      quantity,
    };

    const validationError =
      validateMealEntrySelection(nextSelection);

    if (validationError) {
      onChange(null);
      setMessage(validationError);
      return;
    }

    onChange(nextSelection);
    setGramText("");
    setMessage(
      `${candidate.unitLabel} × ${quantity}で決定しました`,
    );
  }

  function handleGramSubmit(
    event: SubmitEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const component = candidate.components[0];

    if (!canUseCustomGrams || !component) {
      onChange(null);
      setMessage("この候補ではグラム指定できません");
      return;
    }

    const amountG = Number(gramText);

    const nextSelection: MealEntrySelection = {
      sourceType: "food",
      sourceId: component.foodId,
      quantity: amountG,
    };

    const validationError =
      validateMealEntrySelection(nextSelection);

    if (validationError) {
      onChange(null);
      setMessage(validationError);
      return;
    }

    onChange(nextSelection);
    setMessage(`${amountG}gで決定しました`);
  }

  const isDefaultSelected =
    selection?.sourceType === candidate.sourceType
    && selection.sourceId === candidate.sourceId
    && selection.servingOptionId === undefined
    && selection.quantity === 1;

  return (
    <section
      className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4"
      aria-labelledby="serving-selector-heading"
    >
      <h3
        className="font-bold"
        id="serving-selector-heading"
      >
        量を選択
      </h3>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {candidate.servingChoices.length === 0 && (
          <button
            aria-pressed={isDefaultSelected}
            className={[
              "min-h-12 rounded-xl border px-4 py-3 text-left",
              isDefaultSelected
                ? "border-green-700 bg-green-700 text-white"
                : "border-green-200 bg-white",
            ].join(" ")}
            onClick={selectDefaultServing}
            type="button"
          >
            <span className="block font-semibold">
              {candidate.unitLabel}
            </span>
            <span className="block text-sm opacity-80">
              {Math.round(totalAmountG)}g
            </span>
          </button>
        )}

        {candidate.servingChoices.map((choice) => {
          const isSelected =
            selection?.sourceType === "serving_preset"
            && selection.sourceId === candidate.sourceId
            && selection.servingOptionId === choice.id
            && selection.quantity === 1;

          return (
            <button
              aria-pressed={isSelected}
              className={[
                "min-h-12 rounded-xl border px-4 py-3 text-left",
                isSelected
                  ? "border-green-700 bg-green-700 text-white"
                  : "border-green-200 bg-white",
              ].join(" ")}
              key={choice.id}
              onClick={() =>
                selectServingChoice(choice.id, choice.label)
              }
              type="button"
            >
              <span className="block font-semibold">
                {choice.label}
              </span>
            </button>
          );
        })}
      </div>

      <form
        className="mt-4"
        onSubmit={handleQuantitySubmit}
      >
        <label
          className="block text-sm font-medium"
          htmlFor={`serving-quantity-${candidate.sourceType}-${candidate.sourceId}`}
        >
          {candidate.unitLabel}の数量
        </label>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4"
            id={`serving-quantity-${candidate.sourceType}-${candidate.sourceId}`}
            min="0.1"
            max="100"
            step="0.1"
            type="number"
            value={quantityText}
            onChange={(event) => {
              setQuantityText(event.target.value);

              // 入力が変わった時点で、古い確定値を保存不可にする。
              onChange(null);
              setMessage("");
            }}
          />

          <button
            className="h-12 shrink-0 rounded-xl bg-green-700 px-5 font-semibold text-white"
            type="submit"
          >
            数量を決定
          </button>
        </div>
      </form>

      {canUseCustomGrams && (
        <form
          className="mt-4 border-t border-green-200 pt-4"
          onSubmit={handleGramSubmit}
        >
          <label
            className="block text-sm font-medium"
            htmlFor={`custom-grams-${candidate.sourceId}`}
          >
            グラムで指定
          </label>

          <p className="mt-1 text-xs text-gray-600">
            グラム指定時は元の食品名で記録されます
          </p>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4"
              id={`custom-grams-${candidate.sourceId}`}
              min="0.1"
              max="10000"
              step="0.1"
              placeholder="例: 60"
              type="number"
              value={gramText}
              onChange={(event) => {
                setGramText(event.target.value);

                // 未確定の入力を保存しない。
                onChange(null);
                setMessage("");
              }}
            />

            <button
              className="h-12 shrink-0 rounded-xl border border-green-700 bg-white px-5 font-semibold text-green-800"
              type="submit"
            >
              gで決定
            </button>
          </div>
        </form>
      )}

      {message && (
        <p
          className="mt-3 text-sm"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}