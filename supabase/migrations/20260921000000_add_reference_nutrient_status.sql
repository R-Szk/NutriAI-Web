BEGIN;

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