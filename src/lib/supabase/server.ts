/** Server Componentやサーバー処理から、公開用キーで読み取り接続するクライアント。 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
}
