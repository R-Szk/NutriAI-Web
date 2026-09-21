export function selectFoodByCode<T extends { foodCode: string }>(foods: T[], foodCode: string): T {
    const food = foods.find((item) => item.foodCode === foodCode);

    if (!food) {
        throw new Error(`食品コードが見つかりません: ${foodCode}`);
    }

    return food;
}