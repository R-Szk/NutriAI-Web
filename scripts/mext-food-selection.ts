/**
 * 食品コードが一致する食品を返す。
 * 見つからない場合は、誤ったコードのまま栄養値取込を続けないよう例外にする。
 */
export function selectFoodByCode<T extends { foodCode: string }>(foods: T[], foodCode: string): T {
    const food = foods.find((item) => item.foodCode === foodCode);

    if (!food) {
        throw new Error(`食品コードが見つかりません: ${foodCode}`);
    }

    return food;
}
