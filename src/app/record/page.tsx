/** URLの日付と食事区分を検証し、食品追加画面を表示する。 */
import Link from "next/link";
import FoodRecording from "@/components/food-recording";
import { parseMealNavigationContext } from "@/lib/meal-navigation";

export default async function RecordPages({searchParams}: PageProps<"/record">) {
    const {
        date,
        mealType,
    } = await searchParams;
    
    const context = parseMealNavigationContext(
        date,
        mealType,
    );

    if (!context) {
        return (
            <main className="min-h-screen p-8">
                <h1 className="text-2xl font-bold">追加先を確認できません</h1>

                <p className="mt-2 text-gray-600">ダッシュボードから日付と食事区分を選び直してください。</p>

                <Link
                    className="mt-6 inline-flex rounded bg-green-700 px-4 py-2 text-white"
                    href="/"
                >
                    ダッシュボードへ戻る
                </Link>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-8">
            <FoodRecording
                mealDate={context.mealDate}
                mealType={context.mealType}
            />
        </main>
    );
}