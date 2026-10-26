-- 日常的な分量で選べる単品食品と、複数食品から成る標準料理を管理する。
-- 栄養値はこのマスターへ複製せず、foods / food_nutrientsを正として都度計算する。
BEGIN;

-- SQLレビュー用チェックリスト:
-- [x] 4テーブルにPKを設定する。
-- [x] 単品と料理からfoodsへのFKは、利用中の食品を消さないようON DELETE RESTRICTとする。
-- [x] 子の量候補と料理材料は、親削除時にON DELETE CASCADEで削除する。
-- [x] 重量は正数、priorityとdisplay_orderは0以上に限定する。
-- [x] 同一親内の表示順と、同一レシピ内の食品重複を禁止する。
-- [x] 親マスターにis_active、出典、確認日、created_at、updated_atを持たせる。
-- [x] 検索キーワードと有効項目の優先順にインデックスを設定する。
-- [x] 4テーブルでRLSを有効にし、anon/authenticatedへSELECTだけを許可する。

-- 単一の文科省食品に、利用者向けの名称と標準量を与える。
CREATE TABLE public.food_serving_presets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug = BTRIM(slug) AND slug <> ''),
    food_id BIGINT NOT NULL
        REFERENCES public.foods(id)
        ON DELETE RESTRICT,
    display_name TEXT NOT NULL
        CHECK (display_name = BTRIM(display_name) AND display_name <> ''),
    search_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
        CHECK (ARRAY_POSITION(search_keywords, NULL) IS NULL),
    default_amount_g NUMERIC NOT NULL CHECK (default_amount_g > 0),
    unit_label TEXT NOT NULL
        CHECK (unit_label = BTRIM(unit_label) AND unit_label <> ''),
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
    source_description TEXT NOT NULL
        CHECK (source_description = BTRIM(source_description) AND source_description <> ''),
    source_url TEXT CHECK (source_url IS NULL OR BTRIM(source_url) <> ''),
    source_checked_at DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 小盛り・普通盛り・大盛りなど、presetに紐づく固定重量の候補。
CREATE TABLE public.food_serving_options (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    preset_id BIGINT NOT NULL
        REFERENCES public.food_serving_presets(id)
        ON DELETE CASCADE,
    display_name TEXT NOT NULL
        CHECK (display_name = BTRIM(display_name) AND display_name <> ''),
    amount_g NUMERIC NOT NULL CHECK (amount_g > 0),
    display_order INTEGER NOT NULL CHECK (display_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (preset_id, display_name),
    UNIQUE (preset_id, display_order)
);

-- カレーライスなど、複数食品で構成するNutriAI標準レシピ。
CREATE TABLE public.standard_recipes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug = BTRIM(slug) AND slug <> ''),
    display_name TEXT NOT NULL
        CHECK (display_name = BTRIM(display_name) AND display_name <> ''),
    search_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
        CHECK (ARRAY_POSITION(search_keywords, NULL) IS NULL),
    unit_label TEXT NOT NULL
        CHECK (unit_label = BTRIM(unit_label) AND unit_label <> ''),
    description TEXT NOT NULL
        CHECK (description = BTRIM(description) AND description <> ''),
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
    source_description TEXT NOT NULL
        CHECK (source_description = BTRIM(source_description) AND source_description <> ''),
    source_url TEXT CHECK (source_url IS NULL OR BTRIM(source_url) <> ''),
    source_checked_at DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 標準レシピ1食分を構成する食品と、その使用重量。
CREATE TABLE public.standard_recipe_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipe_id BIGINT NOT NULL
        REFERENCES public.standard_recipes(id)
        ON DELETE CASCADE,
    food_id BIGINT NOT NULL
        REFERENCES public.foods(id)
        ON DELETE RESTRICT,
    amount_g NUMERIC NOT NULL CHECK (amount_g > 0),
    display_order INTEGER NOT NULL CHECK (display_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (recipe_id, food_id),
    UNIQUE (recipe_id, display_order)
);

-- 配列の完全一致検索と、有効な候補の優先順取得を支援する。
CREATE INDEX food_serving_presets_search_keywords_idx
ON public.food_serving_presets
USING GIN (search_keywords);

CREATE INDEX food_serving_presets_active_priority_idx
ON public.food_serving_presets (priority DESC, display_name)
WHERE is_active;

CREATE INDEX standard_recipes_search_keywords_idx
ON public.standard_recipes
USING GIN (search_keywords);

CREATE INDEX standard_recipes_active_priority_idx
ON public.standard_recipes (priority DESC, display_name)
WHERE is_active;

-- 親を起点とした取得はUNIQUEインデックスで支援される。
-- 逆方向の参照確認用に、foods側の外部キー列だけを追加で索引化する。
CREATE INDEX food_serving_presets_food_id_idx
ON public.food_serving_presets (food_id);

CREATE INDEX standard_recipe_items_food_id_idx
ON public.standard_recipe_items (food_id);

-- 既存の共通trigger関数を利用し、更新日時をDB側で管理する。
CREATE TRIGGER food_serving_presets_set_updated_at
BEFORE UPDATE ON public.food_serving_presets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER food_serving_options_set_updated_at
BEFORE UPDATE ON public.food_serving_options
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER standard_recipes_set_updated_at
BEFORE UPDATE ON public.standard_recipes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER standard_recipe_items_set_updated_at
BEFORE UPDATE ON public.standard_recipe_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- カタログは全利用者が読めるが、ブラウザから変更できない読み取り専用とする。
ALTER TABLE public.food_serving_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_serving_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_recipe_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.food_serving_presets,
    public.food_serving_options,
    public.standard_recipes,
    public.standard_recipe_items
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.food_serving_presets,
    public.food_serving_options,
    public.standard_recipes,
    public.standard_recipe_items
TO anon, authenticated;

-- 将来権限構成が変わっても、ブラウザロールがidentityを直接採番できないようにする。
REVOKE ALL ON SEQUENCE
    public.food_serving_presets_id_seq,
    public.food_serving_options_id_seq,
    public.standard_recipes_id_seq,
    public.standard_recipe_items_id_seq
FROM PUBLIC, anon, authenticated;

CREATE POLICY "Public read access for food serving presets"
ON public.food_serving_presets
FOR SELECT
TO anon, authenticated
USING (TRUE);

CREATE POLICY "Public read access for food serving options"
ON public.food_serving_options
FOR SELECT
TO anon, authenticated
USING (TRUE);

CREATE POLICY "Public read access for standard recipes"
ON public.standard_recipes
FOR SELECT
TO anon, authenticated
USING (TRUE);

CREATE POLICY "Public read access for standard recipe items"
ON public.standard_recipe_items
FOR SELECT
TO anon, authenticated
USING (TRUE);

COMMIT;
