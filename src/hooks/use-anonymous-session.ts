"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AnonymousSessionState = {
    userId: string | null;
    isAuthLoading: boolean;
    authError: string | null;
};

let sessionInitializationPromise: Promise<string> | null = null;

async function getOrCreateAnonymousUserId(): Promise<string> {
  if (sessionInitializationPromise) {
    return sessionInitializationPromise;
  }

  sessionInitializationPromise = (async () => {
    const supabase = createClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (session) {
      return session.user.id;
    }

    const { data, error } =
      await supabase.auth.signInAnonymously();

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("匿名ユーザーを作成できませんでした");
    }

    return data.user.id;
  })();

  try {
    return await sessionInitializationPromise;
  } finally {
    sessionInitializationPromise = null;
  }
}

export function useAnonymousSession(): AnonymousSessionState {
    const [userId, setUserId] = useState<string | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function initializeSession() {
            try {
                const anonymousUserId = await getOrCreateAnonymousUserId();

                if (isMounted) {
                    setUserId(anonymousUserId);
                }
            } catch (error) {
                if (isMounted) {
                    setAuthError(
                        error instanceof Error ? error.message : "匿名認証に失敗しました"
                    );
                }
            } finally {
                if (isMounted) {
                    setIsAuthLoading(false);
                }
            }
        }

        void initializeSession();

        return () => { isMounted = false; };
    }, []);

    return { userId, isAuthLoading, authError };
}