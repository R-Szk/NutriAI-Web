/** NutriAIのトップページ。状態を持つ処理はClient Componentへ委譲する。 */
import NutritionDashboard from "@/components/nutrition-dashboard";
import { isMealDate } from "@/lib/meals";

export default async function Home({searchParams}: PageProps<"/">) {
  const { date } = await searchParams;

  const initialMealDate =
    typeof date === "string" && isMealDate(date) ? date : undefined;

    return (
      <main className="min-h-screen px-4 pb-12 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <header>
            <p className="text-sm font-semibold tracking-wide text-green-800">
              毎日の食事と栄養を記録
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              NutriAI
            </h1>
          </header>

          <NutritionDashboard
            initialMealDate={initialMealDate}
          />
        </div>
      </main>
    );
}
