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
            <h2 className="text-xl font-bold">{mealDate}の食事記録</h2>

            <div className="relative mt-4 space-y-6 pl-6">
                <div
                    className="absolute bottom-0 left-2 top-0 w-px bg-green-200"
                    aria-hidden="true"
                />

                {timeline.map((entry) => (
                    <div className="relative" key={entry.mealType}>
                        <div
                            className="absolute -left-6 top-5 h-4 w-4 rounded-full border-2 border-green-700 bg-white"
                            aria-hidden="true"
                        />

                        <MealSection entry={entry} mealDate={mealDate} />
                    </div>
                ))}
            </div>
        </section>
    );
}