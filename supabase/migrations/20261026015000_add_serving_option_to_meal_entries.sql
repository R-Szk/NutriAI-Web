-- プリセットの固定量候補を、表示名と正確な重量を保ったまま保存できるようにする。
BEGIN;

ALTER TABLE public.meal_entries
ADD COLUMN serving_option_id BIGINT
    REFERENCES public.food_serving_options(id)
    ON DELETE SET NULL;

ALTER TABLE public.meal_entries
ADD CONSTRAINT meal_entries_serving_option_source_check
CHECK (
    serving_option_id IS NULL
    OR source_type = 'serving_preset'
);

CREATE INDEX meal_entries_serving_option_id_idx
ON public.meal_entries(serving_option_id)
WHERE serving_option_id IS NOT NULL;

-- 量候補IDを受け取る6引数版。未指定時は既存の5引数版へ処理を委譲する。
CREATE OR REPLACE FUNCTION public.save_meal_entry(
    p_meal_date DATE,
    p_meal_type TEXT,
    p_source_type TEXT,
    p_source_id BIGINT,
    p_quantity NUMERIC,
    p_serving_option_id BIGINT
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
    v_amount_g NUMERIC;
    v_food_id BIGINT;
BEGIN
    -- 量候補なしの保存は、検証済みの既存RPCをそのまま利用する。
    IF p_serving_option_id IS NULL THEN
        RETURN QUERY
        SELECT *
        FROM public.save_meal_entry(
            p_meal_date,
            p_meal_type,
            p_source_type,
            p_source_id,
            p_quantity
        );
        RETURN;
    END IF;

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

    IF p_source_type IS DISTINCT FROM 'serving_preset' THEN
        RAISE EXCEPTION '量候補は標準量にだけ指定できます'
            USING ERRCODE = '22023';
    END IF;

    IF p_source_id IS NULL OR p_source_id <= 0 THEN
        RAISE EXCEPTION '記録元のIDが不正です'
            USING ERRCODE = '22023';
    END IF;

    IF p_serving_option_id <= 0 THEN
        RAISE EXCEPTION '量候補のIDが不正です'
            USING ERRCODE = '22023';
    END IF;

    IF p_quantity IS NULL
       OR p_quantity::TEXT IN ('NaN', 'Infinity', '-Infinity')
       OR p_quantity <= 0
       OR p_quantity > 100 THEN
        RAISE EXCEPTION '標準量の数量は0より大きく100以下にしてください'
            USING ERRCODE = '22023';
    END IF;

    -- optionが指定されたpresetに属することをJOIN条件で検証する。
    SELECT
        food_serving_presets.display_name,
        food_serving_options.display_name,
        food_serving_options.amount_g,
        food_serving_presets.food_id
    INTO
        v_display_name,
        v_unit_label,
        v_amount_g,
        v_food_id
    FROM public.food_serving_presets
    JOIN public.food_serving_options
      ON food_serving_options.preset_id = food_serving_presets.id
    WHERE food_serving_presets.id = p_source_id
      AND food_serving_presets.is_active
      AND food_serving_options.id = p_serving_option_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '指定された量候補が標準量に存在しません'
            USING ERRCODE = '22023';
    END IF;

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

    INSERT INTO public.meal_entries (
        meal_id,
        display_name,
        quantity,
        unit_label,
        source_type,
        serving_preset_id,
        serving_option_id
    )
    VALUES (
        v_meal_id,
        v_display_name,
        p_quantity,
        v_unit_label,
        p_source_type,
        p_source_id,
        p_serving_option_id
    )
    RETURNING meal_entries.id INTO v_meal_entry_id;

    INSERT INTO public.meal_entry_components (
        meal_entry_id,
        food_id,
        amount_g
    )
    VALUES (
        v_meal_entry_id,
        v_food_id,
        v_amount_g * p_quantity
    );

    RETURN QUERY
    SELECT v_meal_id, v_meal_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_meal_entry(
    DATE,
    TEXT,
    TEXT,
    BIGINT,
    NUMERIC,
    BIGINT
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_meal_entry(
    DATE,
    TEXT,
    TEXT,
    BIGINT,
    NUMERIC,
    BIGINT
)
TO authenticated;

COMMIT;
