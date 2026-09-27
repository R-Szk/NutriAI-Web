/** 文部科学省データで使用する栄養素定義をSupabaseへ登録するスクリプト。 */
import { NUTRIENT_DEFINITIONS } from "./mext-nutrients";
import { createAdminClient } from "./supabase-admin";

const APPLY_FLAG = "--apply";

async function main() {
    const nutrients = NUTRIENT_DEFINITIONS.map((nutrient) => ({
        code: nutrient.code,
        name: nutrient.name,
        unit: nutrient.unit,
        category: nutrient.category,
        display_order: nutrient.displayOrder,
        is_primary: nutrient.isPrimary,
    }));

    const shouldApply = process.argv.includes(APPLY_FLAG);

    // 誤操作によるDB更新を防ぐため、--applyがない場合は必ずdry-runにする。
    if (!shouldApply) {
        console.log("dry-runのためDBには登録しません");
        console.log(`登録予定の栄養素: ${nutrients.length}件`);
        console.table(nutrients.slice(0, 10));
        return;
    }

    const supabase = createAdminClient();

    // codeを自然キーとして、再実行時は既存定義を更新する。
    const { data, error } = await supabase
        .from("nutrients")
        .upsert(nutrients, {
            onConflict: "code",
        })
        .select("id, code");
    
    if (error) {
        throw new Error(
            `栄養素の登録に失敗しました: ${error.message}`,
        );
    }

    console.log(`栄養素を${data.length}件登録しました`);
}

main().catch((error: unknown) => {
    console.error("栄養素の取り込みに失敗しました");

    if (error instanceof Error) {
        console.error(error.message);
    }

    process.exitCode = 1;
});
