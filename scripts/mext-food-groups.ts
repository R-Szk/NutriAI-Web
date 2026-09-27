/** 文部科学省食品成分表の食品群コードを、日本語の食品群名へ変換する。 */
const FOOD_GROUP_NAMES: Record<string, string> = {
  "01": "穀類",
  "02": "いも及びでん粉類",
  "03": "砂糖及び甘味類",
  "04": "豆類",
  "05": "種実類",
  "06": "野菜類",
  "07": "果実類",
  "08": "きのこ類",
  "09": "藻類",
  "10": "魚介類",
  "11": "肉類",
  "12": "卵類",
  "13": "乳類",
  "14": "油脂類",
  "15": "菓子類",
  "16": "し好飲料類",
  "17": "調味料及び香辛料類",
  "18": "調理済み流通食品類",
};

export function getFoodGroupName(foodGroupCode: string) {
    const name = FOOD_GROUP_NAMES[foodGroupCode];

    // 未知コードを黙って保存せず、原本変更や読み取り列のずれを早期検出する。
    if (!name) {
        throw new Error(
            `未対応の食品群コードです: ${foodGroupCode}`,
        );
    }

    return name;
}
