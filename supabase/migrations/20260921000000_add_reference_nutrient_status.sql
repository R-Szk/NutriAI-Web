-- 食品成分表の「別章参照」を欠損と区別して保存できるよう、許容状態を拡張する。
BEGIN;

-- CHECK制約は直接編集できないため、旧制約を削除して同名で再作成する。
ALTER TABLE public.food_nutrients
DROP CONSTRAINT food_nutrients_value_status_check;

ALTER TABLE public.food_nutrients
ADD CONSTRAINT food_nutrients_value_status_check
CHECK (
  value_status IN (
    'measured',
    'estimated',
    'zero',
    'trace',
    'estimated_trace',
    'not_measured',
    'missing',
    'reference'
  )
);

COMMIT;
