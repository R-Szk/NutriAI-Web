-- 承認済みの単品8件、量候補16件、標準料理3件、料理材料19件を投入する。
-- identity IDは環境ごとに異なるため、foods.food_codeと各マスターのslugで解決する。
BEGIN;

-- 必要な文科省食品が1件でも不足していれば、欠落したseedを作らず全体を中止する。
DO $$
DECLARE
    v_missing_codes TEXT[];
BEGIN
    SELECT ARRAY_AGG(required_code ORDER BY required_code)
    INTO v_missing_codes
    FROM UNNEST(
        ARRAY[
            '01026', '01088', '02017', '03003', '04033', '04046',
            '06153', '06214', '07107', '09040', '11075', '11221',
            '12004', '13003', '13025', '14006', '16001', '16025',
            '17007', '17021', '17051', '17120'
        ]::TEXT[]
    ) AS required_foods(required_code)
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.foods
        WHERE foods.food_code = required_foods.required_code
    );

    IF v_missing_codes IS NOT NULL THEN
        RAISE EXCEPTION
            '初期カタログに必要な食品コードがありません: %',
            ARRAY_TO_STRING(v_missing_codes, ', ');
    END IF;
END;
$$;

-- 単品食品。栄養値は保存せず、参照食品と標準重量だけを保持する。
INSERT INTO public.food_serving_presets (
    slug,
    food_id,
    display_name,
    search_keywords,
    default_amount_g,
    unit_label,
    priority,
    source_description,
    source_url,
    source_checked_at,
    is_active
)
SELECT
    seed.slug,
    foods.id,
    seed.display_name,
    seed.search_keywords,
    seed.default_amount_g,
    seed.unit_label,
    seed.priority,
    seed.source_description,
    seed.source_url,
    DATE '2026-10-26',
    TRUE
FROM (
    VALUES
        (
            'rice', '01088', 'ご飯',
            ARRAY['ご飯', 'ごはん', '白米', '米']::TEXT[],
            150::NUMERIC, '普通盛り1膳', 100,
            '農林水産省SV早見表のご飯Mを標準量とする。',
            'https://www.maff.go.jp/j/syokuiku/zissen_navi/balance/chart.html'
        ),
        (
            'natto', '04046', '納豆',
            ARRAY['納豆', 'なっとう']::TEXT[],
            45::NUMERIC, '1パック', 90,
            'タカノフーズの栄養説明で使用される1パック45gを標準量とする。',
            'https://www.takanofoods.co.jp/fun/nattoeiyo/'
        ),
        (
            'shokupan-6-slice', '01026', '食パン',
            ARRAY['食パン', 'パン', 'トースト', '6枚切り']::TEXT[],
            60::NUMERIC, '6枚切り1枚', 80,
            '農林水産省SV早見表の6枚切り食パン60gを標準量とする。',
            'https://www.maff.go.jp/j/syokuiku/zissen_navi/balance/chart.html'
        ),
        (
            'silken-tofu', '04033', '絹ごし豆腐',
            ARRAY['豆腐', 'とうふ', '絹', '冷奴']::TEXT[],
            150::NUMERIC, '冷奴1人分', 70,
            '農林水産省SV早見表の冷奴（絹ごし豆腐150g）を標準量とする。',
            'https://www.maff.go.jp/j/syokuiku/zissen_navi/balance/chart.html'
        ),
        (
            'egg', '12004', '卵',
            ARRAY['卵', 'たまご', '生卵']::TEXT[],
            50::NUMERIC, '1個（可食部）', 60,
            '農林水産省SV早見表の目玉焼きにある卵50gを1個分の目安とする。',
            'https://www.maff.go.jp/j/syokuiku/zissen_navi/balance/chart.html'
        ),
        (
            'banana', '07107', 'バナナ',
            ARRAY['バナナ']::TEXT[],
            100::NUMERIC, '1本分の目安（可食部）', 50,
            '農林水産省資料の果物100g（バナナ1本）を標準量とする。',
            'https://www.maff.go.jp/j/council/seisaku/kazyu/h26_3/pdf/07_data6-1.pdf'
        ),
        (
            'milk', '13003', '牛乳',
            ARRAY['牛乳', 'ミルク']::TEXT[],
            200::NUMERIC, 'コップ1杯', 40,
            '農林水産省SV早見表の牛乳200gを標準量とする。',
            'https://www.maff.go.jp/j/syokuiku/zissen_navi/balance/chart.html'
        ),
        (
            'plain-yogurt', '13025', 'プレーンヨーグルト',
            ARRAY['ヨーグルト', 'プレーンヨーグルト']::TEXT[],
            100::NUMERIC, '100g', 30,
            '商品差を考慮し、入力しやすい100gをNutriAIの標準量とする。',
            'https://www.maff.go.jp/j/syokuiku/kaigi/attach/pdf/r01_03-7.pdf'
        )
) AS seed(
    slug,
    food_code,
    display_name,
    search_keywords,
    default_amount_g,
    unit_label,
    priority,
    source_description,
    source_url
)
JOIN public.foods
  ON foods.food_code = seed.food_code
ON CONFLICT (slug)
DO UPDATE SET
    food_id = EXCLUDED.food_id,
    display_name = EXCLUDED.display_name,
    search_keywords = EXCLUDED.search_keywords,
    default_amount_g = EXCLUDED.default_amount_g,
    unit_label = EXCLUDED.unit_label,
    priority = EXCLUDED.priority,
    source_description = EXCLUDED.source_description,
    source_url = EXCLUDED.source_url,
    source_checked_at = EXCLUDED.source_checked_at,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 対象presetの量候補を承認済みの一覧へ揃える。
DELETE FROM public.food_serving_options
WHERE preset_id IN (
    SELECT id
    FROM public.food_serving_presets
    WHERE slug IN (
        'rice',
        'natto',
        'shokupan-6-slice',
        'silken-tofu',
        'egg',
        'banana',
        'milk',
        'plain-yogurt'
    )
);

INSERT INTO public.food_serving_options (
    preset_id,
    display_name,
    amount_g,
    display_order
)
SELECT
    presets.id,
    seed.display_name,
    seed.amount_g,
    seed.display_order
FROM (
    VALUES
        ('rice', '小盛り（100g）', 100::NUMERIC, 0),
        ('rice', '普通盛り（150g）', 150::NUMERIC, 1),
        ('rice', '大盛り（200g）', 200::NUMERIC, 2),
        ('natto', '1パック（45g）', 45::NUMERIC, 0),
        ('natto', '2パック（90g）', 90::NUMERIC, 1),
        ('shokupan-6-slice', '1枚（60g）', 60::NUMERIC, 0),
        ('shokupan-6-slice', '2枚（120g）', 120::NUMERIC, 1),
        ('silken-tofu', '100g', 100::NUMERIC, 0),
        ('silken-tofu', '冷奴1人分（150g）', 150::NUMERIC, 1),
        ('egg', '1個（可食部50g）', 50::NUMERIC, 0),
        ('egg', '2個（可食部100g）', 100::NUMERIC, 1),
        ('banana', '1本分（可食部100g）', 100::NUMERIC, 0),
        ('banana', '2本分（可食部200g）', 200::NUMERIC, 1),
        ('milk', '100g', 100::NUMERIC, 0),
        ('milk', 'コップ1杯（200g）', 200::NUMERIC, 1),
        ('plain-yogurt', '100g', 100::NUMERIC, 0)
) AS seed(preset_slug, display_name, amount_g, display_order)
JOIN public.food_serving_presets AS presets
  ON presets.slug = seed.preset_slug;

-- 標準料理。source_urlには主となるレシピを保存し、補助出典は説明へ記録する。
INSERT INTO public.standard_recipes (
    slug,
    display_name,
    search_keywords,
    unit_label,
    description,
    priority,
    source_description,
    source_url,
    source_checked_at,
    is_active
)
VALUES
    (
        'curry-rice',
        'カレーライス',
        ARRAY['カレー', 'カレーライス']::TEXT[],
        '標準1皿',
        'NutriAI標準レシピ。商品や家庭の作り方により栄養値は変わる。',
        100,
        'ハウス食品の基本レシピを1皿分へ換算し、農林水産省SV早見表のご飯200gと日清オイリオの油重量換算を使用。',
        'https://housefoods.jp/data/curryhouse/cook/basic.html',
        DATE '2026-10-26',
        TRUE
    ),
    (
        'tofu-wakame-miso-soup',
        '豆腐とわかめのみそ汁',
        ARRAY['みそ汁', '味噌汁', '豆腐', 'わかめ']::TEXT[],
        '1杯',
        'NutriAI標準レシピ。長ねぎ少々と水は栄養計算へ含めない。',
        90,
        'マルコメの基本レシピを1人分へ換算し、豆腐重量はキッコーマン公式レシピを参考にした。',
        'https://www.marukome.co.jp/recipe/basic/01/',
        DATE '2026-10-26',
        TRUE
    ),
    (
        'oyakodon',
        '親子丼',
        ARRAY['親子丼', 'おやこどん', '丼']::TEXT[],
        '1杯',
        'NutriAI標準レシピ。三つ葉は重量が確定できないため栄養計算へ含めない。',
        80,
        '農林水産省の2人分レシピを1人分へ換算し、ご飯量はSV早見表、調味料重量は味の素パークの目安量を使用。',
        'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/34_12_tokyo.html',
        DATE '2026-10-26',
        TRUE
    )
ON CONFLICT (slug)
DO UPDATE SET
    display_name = EXCLUDED.display_name,
    search_keywords = EXCLUDED.search_keywords,
    unit_label = EXCLUDED.unit_label,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    source_description = EXCLUDED.source_description,
    source_url = EXCLUDED.source_url,
    source_checked_at = EXCLUDED.source_checked_at,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 対象料理の材料を承認済みの一覧へ揃える。
DELETE FROM public.standard_recipe_items
WHERE recipe_id IN (
    SELECT id
    FROM public.standard_recipes
    WHERE slug IN (
        'curry-rice',
        'tofu-wakame-miso-soup',
        'oyakodon'
    )
);

INSERT INTO public.standard_recipe_items (
    recipe_id,
    food_id,
    amount_g,
    display_order
)
SELECT
    recipes.id,
    foods.id,
    seed.amount_g,
    seed.display_order
FROM (
    VALUES
        ('curry-rice', '01088', 200::NUMERIC, 0),
        ('curry-rice', '11075', 41.6667::NUMERIC, 1),
        ('curry-rice', '06153', 66.6667::NUMERIC, 2),
        ('curry-rice', '02017', 38.3333::NUMERIC, 3),
        ('curry-rice', '06214', 16.6667::NUMERIC, 4),
        ('curry-rice', '17051', 19.1667::NUMERIC, 5),
        ('curry-rice', '14006', 2.3333::NUMERIC, 6),
        ('tofu-wakame-miso-soup', '04033', 50::NUMERIC, 0),
        ('tofu-wakame-miso-soup', '09040', 1::NUMERIC, 1),
        ('tofu-wakame-miso-soup', '17120', 16::NUMERIC, 2),
        ('oyakodon', '01088', 200::NUMERIC, 0),
        ('oyakodon', '11221', 75::NUMERIC, 1),
        ('oyakodon', '06153', 50::NUMERIC, 2),
        ('oyakodon', '12004', 50::NUMERIC, 3),
        ('oyakodon', '17021', 50::NUMERIC, 4),
        ('oyakodon', '17007', 10.5::NUMERIC, 5),
        ('oyakodon', '16001', 1.25::NUMERIC, 6),
        ('oyakodon', '03003', 2.25::NUMERIC, 7),
        ('oyakodon', '16025', 4.5::NUMERIC, 8)
) AS seed(recipe_slug, food_code, amount_g, display_order)
JOIN public.standard_recipes AS recipes
  ON recipes.slug = seed.recipe_slug
JOIN public.foods
  ON foods.food_code = seed.food_code;

-- 件数と参照整合性をmigration内でも検証する。
DO $$
DECLARE
    v_preset_count BIGINT;
    v_option_count BIGINT;
    v_recipe_count BIGINT;
    v_recipe_item_count BIGINT;
    v_orphan_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_preset_count
    FROM public.food_serving_presets
    WHERE slug IN (
        'rice', 'natto', 'shokupan-6-slice', 'silken-tofu',
        'egg', 'banana', 'milk', 'plain-yogurt'
    );

    SELECT COUNT(*)
    INTO v_option_count
    FROM public.food_serving_options
    JOIN public.food_serving_presets
      ON food_serving_presets.id = food_serving_options.preset_id
    WHERE food_serving_presets.slug IN (
        'rice', 'natto', 'shokupan-6-slice', 'silken-tofu',
        'egg', 'banana', 'milk', 'plain-yogurt'
    );

    SELECT COUNT(*)
    INTO v_recipe_count
    FROM public.standard_recipes
    WHERE slug IN ('curry-rice', 'tofu-wakame-miso-soup', 'oyakodon');

    SELECT COUNT(*)
    INTO v_recipe_item_count
    FROM public.standard_recipe_items
    JOIN public.standard_recipes
      ON standard_recipes.id = standard_recipe_items.recipe_id
    WHERE standard_recipes.slug IN (
        'curry-rice', 'tofu-wakame-miso-soup', 'oyakodon'
    );

    SELECT
        (
            SELECT COUNT(*)
            FROM public.food_serving_options
            LEFT JOIN public.food_serving_presets
              ON food_serving_presets.id = food_serving_options.preset_id
            WHERE food_serving_presets.id IS NULL
        )
        +
        (
            SELECT COUNT(*)
            FROM public.standard_recipe_items
            LEFT JOIN public.standard_recipes
              ON standard_recipes.id = standard_recipe_items.recipe_id
            LEFT JOIN public.foods
              ON foods.id = standard_recipe_items.food_id
            WHERE standard_recipes.id IS NULL
               OR foods.id IS NULL
        )
    INTO v_orphan_count;

    IF v_preset_count <> 8
       OR v_option_count <> 16
       OR v_recipe_count <> 3
       OR v_recipe_item_count <> 19
       OR v_orphan_count <> 0 THEN
        RAISE EXCEPTION
            '初期カタログの検証に失敗しました: presets=%, options=%, recipes=%, items=%, orphans=%',
            v_preset_count,
            v_option_count,
            v_recipe_count,
            v_recipe_item_count,
            v_orphan_count;
    END IF;
END;
$$;

COMMIT;
