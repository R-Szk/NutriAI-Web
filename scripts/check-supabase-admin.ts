import { createAdminClient } from "./supabase-admin";

const TABLES = [
    "foods",
    "nutrients",
    "food_nutrients",
] as const;

async function main() {
    const supabase = createAdminClient();

    for (const table of TABLES) {
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