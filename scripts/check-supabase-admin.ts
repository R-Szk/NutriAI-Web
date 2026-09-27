/** 管理者権限で主要3テーブルへ接続し、取り込み件数を確認する診断スクリプト。 */
import { createAdminClient } from "./supabase-admin";

const TABLES = [
    "foods",
    "nutrients",
    "food_nutrients",
] as const;

async function main() {
    const supabase = createAdminClient();

    for (const table of TABLES) {
        // 行データ自体は取得せず、正確な件数だけを問い合わせる。
        const { count, error } = await supabase
            .from(table)
            .select("*", {
                count: "exact",
                head: true,
            });
        
        if (error) {
            throw new Error(
                `${table}の件数取得に失敗しました: ${error.message}`,
            );
        }

        console.log(`${table}: ${count ?? 0}件`);
    }
}

main().catch((error: unknown) => {
    console.error("Supabaseの接続確認に失敗しました");

    if (error instanceof Error) {
        console.error(error.message);
    }

    process.exitCode = 1;
});
