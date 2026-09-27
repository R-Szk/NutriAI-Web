-- 匿名ユーザーごとの食事枠と、その中に含まれる食品・摂取量を保存する。
BEGIN;

-- 1ユーザー・1日・1食事区分を1行として扱う。
CREATE TABLE public.meals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, meal_date, meal_type)
);

-- 食事に含まれる食品。同じ食品の再保存はamount_gの置き換えに使う。
CREATE TABLE public.meal_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    meal_id BIGINT NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    food_id BIGINT NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
    amount_g NUMERIC NOT NULL CHECK (amount_g > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (meal_id, food_id)
);

-- 食品側から利用状況を調べる問い合わせを支援する。
CREATE INDEX meal_items_food_id_idx ON public.meal_items(food_id);

-- UPDATEのたびにupdated_atをDB側で更新し、クライアント時計に依存させない。
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER meals_set_updated_at
BEFORE UPDATE ON public.meals
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER meal_items_set_updated_at
BEFORE UPDATE ON public.meal_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 匿名認証ユーザーもauthenticatedロールになるため、所有者単位でRLSを適用する。
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meals, public.meal_items FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.meals, public.meal_items
TO authenticated;

GRANT USAGE, SELECT
ON SEQUENCE public.meals_id_seq, public.meal_items_id_seq
TO authenticated;

-- mealsはuser_idが現在の認証ユーザーと一致する行だけ操作できる。
CREATE POLICY "Users can select own meals"
ON public.meals
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own meals"
ON public.meals
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own meals"
ON public.meals
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own meals"
ON public.meals
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- meal_itemsにはuser_idがないため、親mealの所有者をEXISTSで検証する。
CREATE POLICY "Users can select own meal items"
ON public.meal_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.meals
    WHERE meals.id = meal_items.meal_id
      AND meals.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can insert own meal items"
ON public.meal_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.meals
    WHERE meals.id = meal_items.meal_id
      AND meals.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can update own meal items"
ON public.meal_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.meals
    WHERE meals.id = meal_items.meal_id
      AND meals.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.meals
    WHERE meals.id = meal_items.meal_id
      AND meals.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can delete own meal items"
ON public.meal_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.meals
    WHERE meals.id = meal_items.meal_id
      AND meals.user_id = (SELECT auth.uid())
  )
);

COMMIT;
