/** NutriAIのトップページ。状態を持つ処理はClient Componentへ委譲する。 */
import NutritionDashboard from "@/components/nutrition-dashboard";
import { isMealDate } from "@/lib/meals";

export default async function Home({searchParams}: PageProps<"/">) {
  const { date } = await searchParams;

  const initialMealDate =
    typeof date === "string" && isMealDate(date) ? date : undefined;

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">NutriAI</h1>
      <p className="mt-2 text-gray-600">食事と栄養を記録する</p>

      <NutritionDashboard initialMealDate={initialMealDate}/>
    </main>
  );
}
