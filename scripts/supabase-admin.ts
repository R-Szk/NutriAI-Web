import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
        throw new Error("SUPABASE_URLが設定されていません");
    }

    if (!secretKey) {
        throw new Error("SUPABASE_SECRET_KEYが設定されていません");
    }

    return createClient(supabaseUrl, secretKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
}