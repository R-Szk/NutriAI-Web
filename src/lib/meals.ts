/** DBに保存する言語非依存コードと、画面に表示する日本語の対応表。 */
export const MEAL_TYPE_LABELS = {
    breakfast: "朝食",
    lunch: "昼食",
    dinner: "夕食",
    snack: "間食",
} as const;

export type MealType = keyof typeof MEAL_TYPE_LABELS;

export type MealRecordInput = {
    userId: string;
    mealDate: string;
    mealType: MealType;
    foodId: number;
    amountG: number;
};

/** Supabaseへ送る前に、食事記録の必須値と値域を検証する。正常時はnullを返す。 */
export function validateMealRecordInput(input: MealRecordInput): string | null {
    if (input.userId.trim() === "") {
        return "ユーザー情報を確認できません";
    }

    // 形式だけでなく、2月29日などが実在する暦日かも後段で比較する。
    const dateMatch = input.mealDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
        return "正しい日付を入力してください";
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const date = new Date(year, month - 1, day);

    const isValidDate = date.getFullYear() === year &&
                        date.getMonth() === month - 1 &&
                        date.getDate() === day;
    if(!isValidDate) {
        return "正しい日付を入力してください";
    }

    if(!isMealType(input.mealType)) {
        return "正しい食事区分を選択してください";
    }

    if (!Number.isInteger(input.foodId) || input.foodId <= 0) {
        return "食品を選択してください";
    }

    if (!Number.isFinite(input.amountG) || input.amountG <= 0) {
        return "0より大きい摂取量を入力してください";
    }

    return null;
}

/** 外部入力の文字列をMealTypeへ安全に絞り込む型ガード。 */
export function isMealType(value: string): value is MealType {
    return Object.hasOwn(MEAL_TYPE_LABELS, value);
}

/** UTCへ変換せず、利用者のローカル日付をHTML date用文字列へ変換する。 */
export function getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}
