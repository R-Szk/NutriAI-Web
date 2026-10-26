-- 利用者が選んだ表示単位と、栄養計算用の構成食品を分離して保存する。
BEGIN;

-- 利用者が記録した「食品・標準量・標準料理」の1件を表す。
CREATE TABLE public.meal_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    meal_id BIGINT NOT NULL
        REFERENCES public.meals(id)
        ON DELETE CASCADE,
    display_name TEXT NOT NULL
        CHECK (display_name = BTRIM(display_name) AND display_name <> ''),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_label TEXT NOT NULL
        CHECK (unit_label = BTRIM(unit_label) AND unit_label <> ''),
    source_type TEXT NOT NULL
        CHECK (source_type IN ('food', 'serving_preset', 'standard_recipe')),
    food_id BIGINT
        REFERENCES public.foods(id)
        ON DELETE RESTRICT,
    serving_preset_id BIGINT
        REFERENCES public.food_serving_presets(id)
        ON DELETE RESTRICT,
    standard_recipe_id BIGINT
        REFERENCES public.standard_recipes(id)
        ON DELETE RESTRICT,
    legacy_meal_item_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- source_typeに対応する参照先だけを1つ設定する。
    CHECK (
        (
            source_type = 'food'
            AND food_id IS NOT NULL
            AND serving_preset_id IS NULL
            AND standard_recipe_id IS NULL
        )
        OR
        (
            source_type = 'serving_preset'
            AND food_id IS NULL
            AND serving_preset_id IS NOT NULL
            AND standard_recipe_id IS NULL
        )
        OR
        (
            source_type = 'standard_recipe'
            AND food_id IS NULL
            AND serving_preset_id IS NULL
            AND standard_recipe_id IS NOT NULL
        )
    ),

    -- 詳細食品はグラム、presetとrecipeは個数として上限を分ける。
    CHECK (
        (source_type = 'food' AND quantity <= 10000)
        OR
        (source_type IN ('serving_preset', 'standard_recipe') AND quantity <= 100)
    )
);

-- 1件の記録を栄養計算へ展開した、食品ごとの実重量。
CREATE TABLE public.meal_entry_components (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    meal_entry_id BIGINT NOT NULL
        REFERENCES public.meal_entries(id)
        ON DELETE CASCADE,
    food_id BIGINT NOT NULL
        REFERENCES public.foods(id)
        ON DELETE RESTRICT,
    amount_g NUMERIC NOT NULL CHECK (amount_g > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (meal_entry_id, food_id)
);

CREATE INDEX meal_entries_meal_id_idx
ON public.meal_entries(meal_id);

CREATE INDEX meal_entries_food_id_idx
ON public.meal_entries(food_id)
WHERE food_id IS NOT NULL;

CREATE INDEX meal_entries_serving_preset_id_idx
ON public.meal_entries(serving_preset_id)
WHERE serving_preset_id IS NOT NULL;

CREATE INDEX meal_entries_standard_recipe_id_idx
ON public.meal_entries(standard_recipe_id)
WHERE standard_recipe_id IS NOT NULL;

CREATE INDEX meal_entry_components_food_id_idx
ON public.meal_entry_components(food_id);

CREATE TRIGGER meal_entries_set_updated_at
BEFORE UPDATE ON public.meal_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER meal_entry_components_set_updated_at
BEFORE UPDATE ON public.meal_entry_components
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 記録は所有者だけが参照でき、entryの削除時はcomponentsもcascade削除される。
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_entry_components ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.meal_entries,
    public.meal_entry_components
FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE
ON TABLE public.meal_entries
TO authenticated;

GRANT SELECT
ON TABLE public.meal_entry_components
TO authenticated;

REVOKE ALL ON SEQUENCE
    public.meal_entries_id_seq,
    public.meal_entry_components_id_seq
FROM PUBLIC, anon, authenticated;

CREATE POLICY "Users can select own meal entries"
ON public.meal_entries
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.meals
        WHERE meals.id = meal_entries.meal_id
          AND meals.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can delete own meal entries"
ON public.meal_entries
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.meals
        WHERE meals.id = meal_entries.meal_id
          AND meals.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can select own meal entry components"
ON public.meal_entry_components
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.meal_entries
        JOIN public.meals
          ON meals.id = meal_entries.meal_id
        WHERE meal_entries.id = meal_entry_components.meal_entry_id
          AND meals.user_id = (SELECT auth.uid())
    )
);

-- 指定されたsourceをDB内のマスターから安全に展開し、1トランザクションで保存する。
CREATE OR REPLACE FUNCTION public.save_meal_entry(
    p_meal_date DATE,
    p_meal_type TEXT,
    p_source_type TEXT,
    p_source_id BIGINT,
    p_quantity NUMERIC
)
RETURNS TABLE (
    meal_id BIGINT,
    meal_entry_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_meal_id BIGINT;
    v_meal_entry_id BIGINT;
    v_display_name TEXT;
    v_unit_label TEXT;
    v_default_amount_g NUMERIC;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '認証されたユーザーが必要です'
            USING ERRCODE = '42501';
    END IF;

    IF p_meal_date IS NULL THEN
        RAISE EXCEPTION '食事日を指定してください'
            USING ERRCODE = '22023';
    END IF;

    IF p_meal_type IS NULL
       OR p_meal_type NOT IN ('breakfast', 'lunch', 'dinner', 'snack') THEN
        RAISE EXCEPTION '食事区分が不正です'
            USING ERRCODE = '22023';
    END IF;

    IF p_source_type IS NULL
       OR p_source_type NOT IN ('food', 'serving_preset', 'standard_recipe') THEN
        RAISE EXCEPTION '記録元の種類が不正です'
            USING ERRCODE = '22023';
    END IF;

    IF p_source_id IS NULL OR p_source_id <= 0 THEN
        RAISE EXCEPTION '記録元のIDが不正です'
            USING ERRCODE = '22023';
    END IF;

    IF p_quantity IS NULL
       OR p_quantity::TEXT IN ('NaN', 'Infinity', '-Infinity')
       OR p_quantity <= 0 THEN
        RAISE EXCEPTION '数量は有限の正数を指定してください'
            USING ERRCODE = '22023';
    END IF;

    IF p_source_type = 'food' AND p_quantity > 10000 THEN
        RAISE EXCEPTION '食品の摂取量は10000g以下にしてください'
            USING ERRCODE = '22023';
    END IF;

    IF p_source_type IN ('serving_preset', 'standard_recipe')
       AND p_quantity > 100 THEN
        RAISE EXCEPTION '標準量・標準料理の数量は100以下にしてください'
            USING ERRCODE = '22023';
    END IF;

    -- 表示情報と構成食品はクライアント入力ではなく、DBマスターから取得する。
    IF p_source_type = 'food' THEN
        SELECT foods.name, 'g'
        INTO v_display_name, v_unit_label
        FROM public.foods
        WHERE foods.id = p_source_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION '指定された食品が見つかりません'
                USING ERRCODE = '22023';
        END IF;
    ELSIF p_source_type = 'serving_preset' THEN
        SELECT
            food_serving_presets.display_name,
            food_serving_presets.unit_label,
            food_serving_presets.default_amount_g
        INTO
            v_display_name,
            v_unit_label,
            v_default_amount_g
        FROM public.food_serving_presets
        WHERE food_serving_presets.id = p_source_id
          AND food_serving_presets.is_active;

        IF NOT FOUND THEN
            RAISE EXCEPTION '指定された標準量が見つからないか、無効です'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        SELECT
            standard_recipes.display_name,
            standard_recipes.unit_label
        INTO
            v_display_name,
            v_unit_label
        FROM public.standard_recipes
        WHERE standard_recipes.id = p_source_id
          AND standard_recipes.is_active;

        IF NOT FOUND THEN
            RAISE EXCEPTION '指定された標準料理が見つからないか、無効です'
                USING ERRCODE = '22023';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.standard_recipe_items
            WHERE standard_recipe_items.recipe_id = p_source_id
        ) THEN
            RAISE EXCEPTION '指定された標準料理には材料がありません'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    -- 1ユーザー・日付・食事区分のmealを取得し、なければ作成する。
    INSERT INTO public.meals (
        user_id,
        meal_date,
        meal_type
    )
    VALUES (
        v_user_id,
        p_meal_date,
        p_meal_type
    )
    ON CONFLICT (user_id, meal_date, meal_type)
    DO UPDATE SET updated_at = NOW()
    RETURNING meals.id INTO v_meal_id;

    IF p_source_type = 'food' THEN
        INSERT INTO public.meal_entries (
            meal_id,
            display_name,
            quantity,
            unit_label,
            source_type,
            food_id
        )
        VALUES (
            v_meal_id,
            v_display_name,
            p_quantity,
            v_unit_label,
            p_source_type,
            p_source_id
        )
        RETURNING meal_entries.id INTO v_meal_entry_id;

        INSERT INTO public.meal_entry_components (
            meal_entry_id,
            food_id,
            amount_g
        )
        VALUES (
            v_meal_entry_id,
            p_source_id,
            p_quantity
        );
    ELSIF p_source_type = 'serving_preset' THEN
        INSERT INTO public.meal_entries (
            meal_id,
            display_name,
            quantity,
            unit_label,
            source_type,
            serving_preset_id
        )
        VALUES (
            v_meal_id,
            v_display_name,
            p_quantity,
            v_unit_label,
            p_source_type,
            p_source_id
        )
        RETURNING meal_entries.id INTO v_meal_entry_id;

        INSERT INTO public.meal_entry_components (
            meal_entry_id,
            food_id,
            amount_g
        )
        SELECT
            v_meal_entry_id,
            food_serving_presets.food_id,
            v_default_amount_g * p_quantity
        FROM public.food_serving_presets
        WHERE food_serving_presets.id = p_source_id;
    ELSE
        INSERT INTO public.meal_entries (
            meal_id,
            display_name,
            quantity,
            unit_label,
            source_type,
            standard_recipe_id
        )
        VALUES (
            v_meal_id,
            v_display_name,
            p_quantity,
            v_unit_label,
            p_source_type,
            p_source_id
        )
        RETURNING meal_entries.id INTO v_meal_entry_id;

        -- 同じ食品が複数行に現れる将来のデータにも備え、食品ごとに集約する。
        INSERT INTO public.meal_entry_components (
            meal_entry_id,
            food_id,
            amount_g
        )
        SELECT
            v_meal_entry_id,
            standard_recipe_items.food_id,
            SUM(standard_recipe_items.amount_g) * p_quantity
        FROM public.standard_recipe_items
        WHERE standard_recipe_items.recipe_id = p_source_id
        GROUP BY standard_recipe_items.food_id;
    END IF;

    RETURN QUERY
    SELECT v_meal_id, v_meal_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_meal_entry(DATE, TEXT, TEXT, BIGINT, NUMERIC)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_meal_entry(DATE, TEXT, TEXT, BIGINT, NUMERIC)
TO authenticated;

-- 旧meal_itemsを、新しいentryとcomponentへ1対1で移行する。
-- legacy_meal_item_idの一意制約により、このINSERT部分は再実行しても重複しない。
INSERT INTO public.meal_entries (
    meal_id,
    display_name,
    quantity,
    unit_label,
    source_type,
    food_id,
    legacy_meal_item_id,
    created_at,
    updated_at
)
SELECT
    meal_items.meal_id,
    foods.name,
    meal_items.amount_g,
    'g',
    'food',
    meal_items.food_id,
    meal_items.id,
    meal_items.created_at,
    meal_items.updated_at
FROM public.meal_items
JOIN public.foods
  ON foods.id = meal_items.food_id
ON CONFLICT (legacy_meal_item_id) DO NOTHING;

INSERT INTO public.meal_entry_components (
    meal_entry_id,
    food_id,
    amount_g,
    created_at,
    updated_at
)
SELECT
    meal_entries.id,
    meal_items.food_id,
    meal_items.amount_g,
    meal_items.created_at,
    meal_items.updated_at
FROM public.meal_items
JOIN public.meal_entries
  ON meal_entries.legacy_meal_item_id = meal_items.id
ON CONFLICT (meal_entry_id, food_id)
DO UPDATE SET
    amount_g = EXCLUDED.amount_g,
    updated_at = EXCLUDED.updated_at;

-- 件数だけでなく、meal・food・重量が同一であることも検証する。
DO $$
DECLARE
    v_old_count BIGINT;
    v_matching_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_old_count
    FROM public.meal_items;

    SELECT COUNT(*)
    INTO v_matching_count
    FROM public.meal_items
    JOIN public.meal_entries
      ON meal_entries.legacy_meal_item_id = meal_items.id
     AND meal_entries.meal_id = meal_items.meal_id
     AND meal_entries.source_type = 'food'
     AND meal_entries.food_id = meal_items.food_id
     AND meal_entries.quantity = meal_items.amount_g
    JOIN public.meal_entry_components
      ON meal_entry_components.meal_entry_id = meal_entries.id
     AND meal_entry_components.food_id = meal_items.food_id
     AND meal_entry_components.amount_g = meal_items.amount_g;

    IF v_matching_count <> v_old_count THEN
        RAISE EXCEPTION
            '旧食事記録の移行検証に失敗しました: old=%, matched=%',
            v_old_count,
            v_matching_count;
    END IF;
END;
$$;

COMMIT;
