export function normalizeSearchQuery(query: string) {
    return query.trim();
}

export function parseIntakeAmount(value: string) {
    const amount = Number(value);

    if (value.trim() === "" || !Number.isFinite(amount) || amount <= 0) {
        return null;
    }

    return amount;
}

export function calculateNutrientAmount(
    nutrientAmountPer100g: number,
    intakeAmountInGrams: number,
) {
    return (nutrientAmountPer100g * intakeAmountInGrams / 100);
}