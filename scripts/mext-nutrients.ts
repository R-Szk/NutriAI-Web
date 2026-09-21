export type NutrientDefinition = {
  column: number;
  sourceCode: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  displayOrder: number;
  isPrimary: boolean;
};

export const NUTRIENT_DEFINITIONS: NutrientDefinition[] = [
  { column: 6, sourceCode: "ENERC", code: "energy_kj", name: "エネルギー", unit: "kJ", category: "基本成分", displayOrder: 1, isPrimary: false },
  { column: 7, sourceCode: "ENERC_KCAL", code: "energy_kcal", name: "エネルギー", unit: "kcal", category: "基本成分", displayOrder: 2, isPrimary: true },
  { column: 8, sourceCode: "WATER", code: "water", name: "水分", unit: "g", category: "基本成分", displayOrder: 3, isPrimary: false },
  { column: 9, sourceCode: "PROTCAA", code: "protein_amino_acid_composition", name: "アミノ酸組成によるたんぱく質", unit: "g", category: "基本成分", displayOrder: 4, isPrimary: false },
  { column: 10, sourceCode: "PROT-", code: "protein", name: "たんぱく質", unit: "g", category: "基本成分", displayOrder: 5, isPrimary: true },
  { column: 11, sourceCode: "FATNLEA", code: "fat_triacylglycerol_equivalent", name: "脂肪酸のトリアシルグリセロール当量", unit: "g", category: "脂質", displayOrder: 6, isPrimary: false },
  { column: 12, sourceCode: "CHOLE", code: "cholesterol", name: "コレステロール", unit: "mg", category: "脂質", displayOrder: 7, isPrimary: false },
  { column: 13, sourceCode: "FAT-", code: "fat", name: "脂質", unit: "g", category: "基本成分", displayOrder: 8, isPrimary: true },
  { column: 14, sourceCode: "CHOAVLM", code: "available_carbohydrate_monosaccharide_equivalent", name: "利用可能炭水化物（単糖当量）", unit: "g", category: "炭水化物", displayOrder: 9, isPrimary: false },
  { column: 16, sourceCode: "CHOAVL", code: "available_carbohydrate_mass", name: "利用可能炭水化物（質量計）", unit: "g", category: "炭水化物", displayOrder: 10, isPrimary: false },
  { column: 17, sourceCode: "CHOAVLDF-", code: "available_carbohydrate_by_difference", name: "差引き法による利用可能炭水化物", unit: "g", category: "炭水化物", displayOrder: 11, isPrimary: false },
  { column: 19, sourceCode: "FIB-", code: "dietary_fiber", name: "食物繊維総量", unit: "g", category: "炭水化物", displayOrder: 12, isPrimary: false },
  { column: 20, sourceCode: "POLYL", code: "sugar_alcohol", name: "糖アルコール", unit: "g", category: "炭水化物", displayOrder: 13, isPrimary: false },
  { column: 21, sourceCode: "CHOCDF-", code: "carbohydrate", name: "炭水化物", unit: "g", category: "基本成分", displayOrder: 14, isPrimary: true },
  { column: 22, sourceCode: "OA", code: "organic_acid", name: "有機酸", unit: "g", category: "その他", displayOrder: 15, isPrimary: false },
  { column: 23, sourceCode: "ASH", code: "ash", name: "灰分", unit: "g", category: "基本成分", displayOrder: 16, isPrimary: false },
  { column: 24, sourceCode: "NA", code: "sodium", name: "ナトリウム", unit: "mg", category: "ミネラル", displayOrder: 17, isPrimary: false },
  { column: 25, sourceCode: "K", code: "potassium", name: "カリウム", unit: "mg", category: "ミネラル", displayOrder: 18, isPrimary: false },
  { column: 26, sourceCode: "CA", code: "calcium", name: "カルシウム", unit: "mg", category: "ミネラル", displayOrder: 19, isPrimary: false },
  { column: 27, sourceCode: "MG", code: "magnesium", name: "マグネシウム", unit: "mg", category: "ミネラル", displayOrder: 20, isPrimary: false },
  { column: 28, sourceCode: "P", code: "phosphorus", name: "リン", unit: "mg", category: "ミネラル", displayOrder: 21, isPrimary: false },
  { column: 29, sourceCode: "FE", code: "iron", name: "鉄", unit: "mg", category: "ミネラル", displayOrder: 22, isPrimary: false },
  { column: 30, sourceCode: "ZN", code: "zinc", name: "亜鉛", unit: "mg", category: "ミネラル", displayOrder: 23, isPrimary: false },
  { column: 31, sourceCode: "CU", code: "copper", name: "銅", unit: "mg", category: "ミネラル", displayOrder: 24, isPrimary: false },
  { column: 32, sourceCode: "MN", code: "manganese", name: "マンガン", unit: "mg", category: "ミネラル", displayOrder: 25, isPrimary: false },
  { column: 34, sourceCode: "ID", code: "iodine", name: "ヨウ素", unit: "μg", category: "ミネラル", displayOrder: 26, isPrimary: false },
  { column: 35, sourceCode: "SE", code: "selenium", name: "セレン", unit: "μg", category: "ミネラル", displayOrder: 27, isPrimary: false },
  { column: 36, sourceCode: "CR", code: "chromium", name: "クロム", unit: "μg", category: "ミネラル", displayOrder: 28, isPrimary: false },
  { column: 37, sourceCode: "MO", code: "molybdenum", name: "モリブデン", unit: "μg", category: "ミネラル", displayOrder: 29, isPrimary: false },
  { column: 38, sourceCode: "RETOL", code: "retinol", name: "レチノール", unit: "μg", category: "ビタミン", displayOrder: 30, isPrimary: false },
  { column: 39, sourceCode: "CARTA", code: "alpha_carotene", name: "α-カロテン", unit: "μg", category: "ビタミン", displayOrder: 31, isPrimary: false },
  { column: 40, sourceCode: "CARTB", code: "beta_carotene", name: "β-カロテン", unit: "μg", category: "ビタミン", displayOrder: 32, isPrimary: false },
  { column: 41, sourceCode: "CRYPXB", code: "beta_cryptoxanthin", name: "β-クリプトキサンチン", unit: "μg", category: "ビタミン", displayOrder: 33, isPrimary: false },
  { column: 42, sourceCode: "CARTBEQ", code: "beta_carotene_equivalent", name: "β-カロテン当量", unit: "μg", category: "ビタミン", displayOrder: 34, isPrimary: false },
  { column: 43, sourceCode: "VITA_RAE", code: "vitamin_a_retinol_activity_equivalent", name: "レチノール活性当量", unit: "μg", category: "ビタミン", displayOrder: 35, isPrimary: false },
  { column: 44, sourceCode: "VITD", code: "vitamin_d", name: "ビタミンD", unit: "μg", category: "ビタミン", displayOrder: 36, isPrimary: false },
  { column: 45, sourceCode: "TOCPHA", code: "alpha_tocopherol", name: "α-トコフェロール", unit: "mg", category: "ビタミン", displayOrder: 37, isPrimary: false },
  { column: 46, sourceCode: "TOCPHB", code: "beta_tocopherol", name: "β-トコフェロール", unit: "mg", category: "ビタミン", displayOrder: 38, isPrimary: false },
  { column: 47, sourceCode: "TOCPHG", code: "gamma_tocopherol", name: "γ-トコフェロール", unit: "mg", category: "ビタミン", displayOrder: 39, isPrimary: false },
  { column: 48, sourceCode: "TOCPHD", code: "delta_tocopherol", name: "δ-トコフェロール", unit: "mg", category: "ビタミン", displayOrder: 40, isPrimary: false },
  { column: 49, sourceCode: "VITK", code: "vitamin_k", name: "ビタミンK", unit: "μg", category: "ビタミン", displayOrder: 41, isPrimary: false },
  { column: 50, sourceCode: "THIA", code: "vitamin_b1", name: "ビタミンB1", unit: "mg", category: "ビタミン", displayOrder: 42, isPrimary: false },
  { column: 51, sourceCode: "RIBF", code: "vitamin_b2", name: "ビタミンB2", unit: "mg", category: "ビタミン", displayOrder: 43, isPrimary: false },
  { column: 52, sourceCode: "NIA", code: "niacin", name: "ナイアシン", unit: "mg", category: "ビタミン", displayOrder: 44, isPrimary: false },
  { column: 53, sourceCode: "NE", code: "niacin_equivalent", name: "ナイアシン当量", unit: "mg", category: "ビタミン", displayOrder: 45, isPrimary: false },
  { column: 54, sourceCode: "VITB6A", code: "vitamin_b6", name: "ビタミンB6", unit: "mg", category: "ビタミン", displayOrder: 46, isPrimary: false },
  { column: 55, sourceCode: "VITB12", code: "vitamin_b12", name: "ビタミンB12", unit: "μg", category: "ビタミン", displayOrder: 47, isPrimary: false },
  { column: 56, sourceCode: "FOL", code: "folate", name: "葉酸", unit: "μg", category: "ビタミン", displayOrder: 48, isPrimary: false },
  { column: 57, sourceCode: "PANTAC", code: "pantothenic_acid", name: "パントテン酸", unit: "mg", category: "ビタミン", displayOrder: 49, isPrimary: false },
  { column: 58, sourceCode: "BIOT", code: "biotin", name: "ビオチン", unit: "μg", category: "ビタミン", displayOrder: 50, isPrimary: false },
  { column: 59, sourceCode: "VITC", code: "vitamin_c", name: "ビタミンC", unit: "mg", category: "ビタミン", displayOrder: 51, isPrimary: false },
  { column: 60, sourceCode: "ALC", code: "alcohol", name: "アルコール", unit: "g", category: "その他", displayOrder: 52, isPrimary: false },
  { column: 61, sourceCode: "NACL_EQ", code: "salt_equivalent", name: "食塩相当量", unit: "g", category: "ミネラル", displayOrder: 53, isPrimary: false },
];
