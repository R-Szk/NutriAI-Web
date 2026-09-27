/** 検索語の前後にある入力上不要な空白を取り除く。 */
export function normalizeSearchQuery(query: string) {
    return query.trim();
}

/** 画面の文字列を正の摂取量へ変換し、不正値はnullで返す。 */
export function parseIntakeAmount(value: string) {
    const amount = Number(value);

    if (value.trim() === "" || !Number.isFinite(amount) || amount <= 0) {
        return null;
    }

    return amount;
}

/** 100g当たりの栄養値を、実際の摂取グラム数へ比例換算する。 */
export function calculateNutrientAmount(
    nutrientAmountPer100g: number,
    intakeAmountInGrams: number,
) {
    return (nutrientAmountPer100g * intakeAmountInGrams / 100);
}
