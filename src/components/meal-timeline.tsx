/** 朝食から間食までの4区分を、記録の有無にかかわらず時系列表示する。 */
import type { DailyMeal } from "@/lib/supabase/meal-records";
import { createMealTimeline } from "@/lib/meal-timeline";
import MealSection from "./meal-section";

type MealTimelineProps = {
  meals: DailyMeal[];
  mealDate: string;
};

export default function MealTimeline({
    meals,
    mealDate,
}: MealTimelineProps) {
    const timeline = createMealTimeline(meals);

    return (
        <section className="mt-8">
            <p className="text-sm font-medium text-green-800">食事タイムライン</p>
            <h2 className="mt-1 text-xl font-bold">{mealDate}の食事記録</h2>

            <div className="relative mt-5 space-y-5 pl-7">
                <div
                    className="absolute bottom-0 left-2 top-0 w-0.5 rounded-full bg-green-200"
                    aria-hidden="true"
                />

                {timeline.map((entry) => (
                    <div className="relative" key={entry.mealType}>
                        <div
                            className="absolute -left-7 top-5 h-5 w-5 rounded-full border-4 border-green-100 bg-green-700"
                            aria-hidden="true"
                        />

                        <MealSection entry={entry} mealDate={mealDate} />
                    </div>
                ))}
            </div>
        </section>
    );
}