import { createClient } from "@/lib/supabase/server";

type FoodWithNutrients = {
  food_code: string;
  name: string;
  food_nutrients: {
    amount: number | null;
    value_status: string;
    nutrients: {
      code: string;
      name: string;
      unit: string;
      display_order: number;
    };
  }[];
};

export default async function Home() {
  const supabase = createClient();

  const { data: food, error } = await supabase
    .from("foods")
    .select(`
      food_code,
      name,
      food_nutrients (
        amount,
        value_status,
        nutrients (
          code,
          name,
          unit,
          display_order
        )
      )`)
    .eq("food_code", "TEST001")
    .single()
    .overrideTypes<FoodWithNutrients, { merge: false }>();

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">NutriAI</h1>
      <p className="mt-2 text-gray-600">食事と栄養を記録する</p>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Supabase接続確認</h2>

        {error ? (
          <p className="mt-2 text-red-600">
            食品の取得に失敗しました：{error.message}
          </p>
        ) : (
          <div className="mt-2">
            <p>
              {food.food_code}：{food.name}
            </p>

            <ul className="mt-4 space-y-2">
              {food.food_nutrients
                .sort(
                  (a, b) =>
                    a.nutrients.display_order - b.nutrients.display_order,
                )
                .map((foodNutrient) => (
                  <li key={foodNutrient.nutrients.code}>
                    {foodNutrient.nutrients.name}：{foodNutrient.amount}
                    {foodNutrient.nutrients.unit}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
