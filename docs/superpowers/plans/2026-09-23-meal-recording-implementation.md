# NutriAI 食事記録・匿名認証 Implementation Plan

> **実装時の必須スキル:** `superpowers:test-driven-development` で各機能を小さく実装し、完了前に `superpowers:verification-before-completion` で検証する。

**Goal:** 選択した食品と摂取量を日付・食事区分付きで保存し、再読み込み後も選択日の記録と主要栄養素合計を復元できるようにする。

**Architecture:** Supabase匿名認証でユーザーを識別し、`meals` と `meal_items` をブラウザから2段階でupsertする。クライアント側ではダッシュボードが日付・認証・再取得の契機を共有し、食品検索、保存フォーム、日別記録表示を分離する。栄養量は食品成分値と摂取量から取得時に計算する。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Supabase Auth/PostgreSQL/RLS、Node.js test runner、Tailwind CSS

**Spec:** [`docs/superpowers/specs/2026-09-23-meal-recording-design.md`](../specs/2026-09-23-meal-recording-design.md)

## Global Constraints

- 主要な学習対象であるSQL、React、TypeScript、Supabase操作は、一度に完成コードを渡さず、ユーザーが小さな単位で記述してからレビューする。
- ユーザーが明示的に許可するまで、実装ファイルを自動変更しない。
- 各コミットは候補として示すだけにし、ユーザーからコミット指示があった時だけ実行する。
- `.env.local` とSupabase Secret KeyをGitへ追加しない。ブラウザではpublishable keyだけを使う。
- Next.jsのコードを変更する直前に、対象APIの現行ドキュメントを `node_modules/next/dist/docs/` で再確認する。
- DBの内部値は `breakfast | lunch | dinner | snack`、画面表示は `朝食 | 昼食 | 夕食 | 間食` とする。
- ローカル日付の生成に `toISOString()` を使わない。
- 栄養計算結果はDBへ複製せず、`food_nutrients.amount × meal_items.amount_g ÷ 100` で都度計算する。

## File and Interface Map

| ファイル | 役割・主な公開インターフェース |
|---|---|
| `supabase/migrations/20260923000000_create_meal_tables.sql` | `meals`、`meal_items`、制約、更新時刻トリガー、RLS、権限 |
| `src/lib/meals.ts` | `MealType`、表示ラベル、日付生成、保存入力検証、日別合計計算 |
| `src/lib/meals.test.ts` | 食事区分、日付、入力検証、栄養合計の単体テスト |
| `src/hooks/use-anonymous-session.ts` | 匿名セッションの復元・作成と認証状態 |
| `src/lib/supabase/meal-records.ts` | 食事の2段階upsertと選択日の関連データ取得 |
| `src/components/nutrition-dashboard.tsx` | 選択日、匿名ユーザー、再取得番号を共有する親コンポーネント |
| `src/components/food-search.tsx` | 既存の検索・選択・摂取量計算。確定した食品と摂取量を保存フォームへ渡す |
| `src/components/meal-save-form.tsx` | 食事区分選択、保存状態、保存処理 |
| `src/components/daily-meal-records.tsx` | 選択日の記録を食事区分別に表示し、主要栄養素を合計 |
| `src/app/page.tsx` | `NutritionDashboard` を配置するServer Component |

## Review Focus

実装レビューでは、特に次の失敗モードを確認する。

1. 日付境界: 日本時間の深夜に、UTC変換によって前日または翌日へずれないこと。
2. 所有権: 匿名ユーザーAが、ユーザーBの `meals` / `meal_items` を取得・更新・削除できないこと。
3. upsert競合: 同じ日・食事区分、または同じ食事・食品を再保存しても行が増えず、摂取量だけが置き換わること。
4. 状態の陳腐化: 食品や摂取量を変更した後、以前の計算結果を誤って保存できないこと。
5. NULLと特殊値: `not_measured` など `amount IS NULL` の成分を0として合計せず、「データ無し」と数値0を区別すること。

---

## Task 1: `meals` / `meal_items` のmigrationとRLS

**Files:**

- Create: `supabase/migrations/20260923000000_create_meal_tables.sql`
- Reference: `supabase/migrations/20260906000000_create_food_tables.sql`
- Reference: `docs/superpowers/specs/2026-09-23-meal-recording-design.md`

- [ ] **Step 1: 既存migrationの命名、権限、RLS形式を確認する**

Run:

```bash
sed -n '1,280p' supabase/migrations/20260906000000_create_food_tables.sql
```

Expected: `public` スキーマ、RLS、既存の食品テーブル名と主キー型を確認できる。

- [ ] **Step 2: テーブルと制約を書く**

次の構造をユーザーがmigrationへ記述する。

```sql
BEGIN;

CREATE TABLE public.meals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (
    meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, meal_date, meal_type)
);

CREATE TABLE public.meal_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meal_id BIGINT NOT NULL
    REFERENCES public.meals(id) ON DELETE CASCADE,
  food_id BIGINT NOT NULL
    REFERENCES public.foods(id) ON DELETE RESTRICT,
  amount_g NUMERIC NOT NULL CHECK (amount_g > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meal_id, food_id)
);

CREATE INDEX meal_items_food_id_idx
  ON public.meal_items(food_id);
```

- [ ] **Step 3: `updated_at` トリガーを書く**

```sql
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
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER meal_items_set_updated_at
BEFORE UPDATE ON public.meal_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 4: RLSと権限を書く**

`meals` は `auth.uid() = user_id`、`meal_items` は所有する親食事の存在を `EXISTS` で判定する。SELECT / INSERT / UPDATE / DELETEを別ポリシーにして、更新には `USING` と `WITH CHECK` の両方を書く。

```sql
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meals, public.meal_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.meals, public.meal_items TO authenticated;
GRANT USAGE, SELECT
  ON SEQUENCE public.meals_id_seq, public.meal_items_id_seq TO authenticated;

CREATE POLICY "Users can select own meals"
ON public.meals FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own meals"
ON public.meals FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own meals"
ON public.meals FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own meals"
ON public.meals FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

`meal_items` の各ポリシーでは、操作対象に応じて次の所有権式を `USING` または `WITH CHECK` に入れる。

```sql
EXISTS (
  SELECT 1
  FROM public.meals
  WHERE meals.id = meal_items.meal_id
    AND meals.user_id = (SELECT auth.uid())
)
```

最後に `COMMIT;` を書く。

- [ ] **Step 5: SQL Editorで実行し、構造を検証する**

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('meals', 'meal_items')
ORDER BY table_name;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('meals', 'meal_items')
ORDER BY tablename, cmd;
```

Expected: 2テーブルと、それぞれ4操作分のポリシーが表示される。

- [ ] **Step 6: 品質確認と承認後のコミット候補**

Run:

```bash
npm run lint
git diff --check
```

Commit candidate: `feat: add meal recording schema and RLS`

---

## Task 2: 食事区分・ローカル日付・入力検証をTDDで作る

**Files:**

- Create: `src/lib/meals.test.ts`
- Create: `src/lib/meals.ts`

- [ ] **Step 1: 食事区分と日付の失敗するテストを書く**

最低限、次をテストする。

```ts
assert.equal(MEAL_TYPE_LABELS.breakfast, "朝食");
assert.equal(MEAL_TYPE_LABELS.snack, "間食");
assert.equal(getLocalDateString(new Date(2026, 8, 3)), "2026-09-03");
assert.equal(isMealType("lunch"), true);
assert.equal(isMealType("朝食"), false);
```

Run:

```bash
node --import tsx --test src/lib/meals.test.ts
```

Expected: モジュールまたは関数が未実装のためFAIL。

- [ ] **Step 2: 最小実装でテストを通す**

公開インターフェースは次とする。

```ts
export const MEAL_TYPE_LABELS = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
} as const;

export type MealType = keyof typeof MEAL_TYPE_LABELS;

export function isMealType(value: string): value is MealType;
export function getLocalDateString(date: Date): string;
```

日付は `getFullYear()`、`getMonth() + 1`、`getDate()` と `padStart(2, "0")` で組み立てる。

- [ ] **Step 3: 保存入力検証の失敗するテストを書く**

```ts
type MealRecordInput = {
  userId: string;
  mealDate: string;
  mealType: MealType;
  foodId: number;
  amountG: number;
};
```

有効入力は `null`、空ユーザーID、不正日付、範囲外の食事区分、0以下・非有限の摂取量、不正な食品IDは日本語エラー文字列を返す仕様にする。`2026-02-29` のような実在しない日付も拒否する。

- [ ] **Step 4: `validateMealRecordInput` を最小実装する**

```ts
export function validateMealRecordInput(
  input: MealRecordInput,
): string | null;
```

文字列形式だけでなく、年月日を `new Date(year, month - 1, day)` に入れ、取り出した年月日が一致するか確認する。

- [ ] **Step 5: テストとlintを通す**

```bash
node --import tsx --test src/lib/meals.test.ts
npm run lint
```

Expected: 全テストPASS、lintエラーなし。

Commit candidate: `test: add meal domain rules`

---

## Task 3: Supabase匿名認証を有効化してセッションを扱う

**Files:**

- Create: `src/hooks/use-anonymous-session.ts`
- Reference: `src/lib/supabase/client.ts`
- Modify later through Task 4: `src/components/nutrition-dashboard.tsx`

- [ ] **Step 1: Dashboardで匿名認証を有効にする**

Supabase Dashboardの Authentication 設定でAnonymous Sign-Insを有効化する。メールログイン等はこの段階では変更しない。

- [ ] **Step 2: フックの返り値を定義する**

```ts
type AnonymousSessionState = {
  userId: string | null;
  isAuthLoading: boolean;
  authError: string | null;
};

export function useAnonymousSession(): AnonymousSessionState;
```

- [ ] **Step 3: セッション復元・作成処理を書く**

`useEffect` 内で以下を順に行う。

1. `supabase.auth.getSession()`
2. セッションがあれば `session.user.id` を保存
3. なければ `supabase.auth.signInAnonymously()`
4. unmount後にstateを更新しないようcleanupフラグを使う
5. 失敗時は `authError` を設定し、`userId` は `null` のままにする

- [ ] **Step 4: lintとブラウザで認証状態を確認する**

```bash
npm run lint
```

ブラウザの開発者ツールで、初回表示後にSupabaseのauthセッションが保存され、再読み込み後も同じuser IDになることを確認する。user IDやトークンを画面・ログへ恒常的に表示しない。

Commit candidate: `feat: add anonymous Supabase session`

---

## Task 4: 日付を共有するダッシュボードへ分割する

**Files:**

- Create: `src/components/nutrition-dashboard.tsx`
- Modify: `src/components/food-search.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: `NutritionDashboard` の責務とprops境界を書く**

親が次のstateを持つ。

```ts
const [mealDate, setMealDate] = useState(() =>
  getLocalDateString(new Date()),
);
const [refreshVersion, setRefreshVersion] = useState(0);
const auth = useAnonymousSession();
```

画面上部に `input type="date"` を置き、同じ `mealDate` を保存フォームと日別一覧へ渡す。保存成功時は `setRefreshVersion((value) => value + 1)` を呼ぶ。

- [ ] **Step 2: `FoodSearch` のpropsを追加する**

```ts
type FoodSearchProps = {
  mealDate: string;
  userId: string | null;
  isAuthLoading: boolean;
  authError: string | null;
  onMealSaved: () => void;
};
```

この段階では保存処理をまだ接続せず、既存の検索・選択・計算が壊れていないことを優先する。

- [ ] **Step 3: `page.tsx` を薄くする**

`page.tsx` は見出しと `<NutritionDashboard />` の配置だけを担当する。Server Componentのまま維持する。

- [ ] **Step 4: 回帰確認する**

```bash
node --import tsx --test src/lib/food-search.test.ts src/lib/meals.test.ts
npm run lint
npm run build -- --webpack
```

Expected: 自動テスト、lint、buildが成功する。ブラウザで食品検索、選択解除、100g/150g計算が従来どおり動く。

Commit candidate: `refactor: add nutrition dashboard state`

---

## Task 5: 2段階upsertと保存フォームを実装する

**Files:**

- Create: `src/lib/supabase/meal-records.ts`
- Create: `src/components/meal-save-form.tsx`
- Modify: `src/components/food-search.tsx`
- Test: `src/lib/meals.test.ts`

- [ ] **Step 1: 保存用データアクセス関数の契約を書く**

```ts
type SaveMealItemInput = MealRecordInput;

type SaveMealItemResult = {
  mealId: number;
  mealItemId: number;
};

export async function saveMealItem(
  input: SaveMealItemInput,
): Promise<SaveMealItemResult>;
```

関数の入口で `validateMealRecordInput` を呼び、不正入力ならDBアクセス前に例外にする。

- [ ] **Step 2: `meals` のupsertを書く**

```ts
.from("meals")
.upsert(
  {
    user_id: input.userId,
    meal_date: input.mealDate,
    meal_type: input.mealType,
  },
  { onConflict: "user_id,meal_date,meal_type" },
)
.select("id")
.single();
```

エラーならそこで中断する。取得した `id` を次のupsertに渡す。

- [ ] **Step 3: `meal_items` のupsertを書く**

```ts
.from("meal_items")
.upsert(
  {
    meal_id: mealId,
    food_id: input.foodId,
    amount_g: input.amountG,
  },
  { onConflict: "meal_id,food_id" },
)
.select("id")
.single();
```

同じ食事・食品なら `amount_g` が置き換わることが重要である。

- [ ] **Step 4: `MealSaveForm` を作る**

```ts
type MealSaveFormProps = {
  userId: string | null;
  mealDate: string;
  foodId: number;
  amountG: number;
  isAuthLoading: boolean;
  authError: string | null;
  onSaved: () => void;
};
```

内部stateは `mealType`、`isSaving`、`saveMessage`。食事区分は `MEAL_TYPE_LABELS` から選択肢を生成する。認証中、認証失敗、保存中は保存ボタンを無効にする。

- [ ] **Step 5: 確定した摂取量だけを保存フォームへ渡す**

`FoodSearch` に `confirmedAmountG: number | null` を追加する。

- 計算成功時だけ `intakeAmount` を設定する。
- 食品変更、選択解除、検索再実行、摂取量入力変更、計算失敗では `null` に戻す。
- `selectedFood`、`confirmedAmountG`、計算結果が揃った時だけ `MealSaveForm` を表示する。

これにより、表示中の計算結果と入力欄の値がずれた状態で保存されることを防ぐ。

- [ ] **Step 6: ブラウザでupsertを検証する**

1. 2026-09-23・朝食・アマランサス100gを保存する。
2. 同じ条件で150gを保存する。
3. Table EditorまたはSQLで `meals` が1件、該当 `meal_items` が1件、`amount_g = 150` であることを確認する。

```sql
SELECT m.meal_date, m.meal_type, f.food_code, mi.amount_g
FROM public.meals AS m
JOIN public.meal_items AS mi ON mi.meal_id = m.id
JOIN public.foods AS f ON f.id = mi.food_id
WHERE m.meal_date = DATE '2026-09-23';
```

- [ ] **Step 7: 自動検証する**

```bash
node --import tsx --test src/lib/food-search.test.ts src/lib/meals.test.ts
npm run lint
npm run build -- --webpack
```

Commit candidate: `feat: save foods to meal records`

---

## Task 6: 選択日の食事記録を取得・表示する

**Files:**

- Modify: `src/lib/supabase/meal-records.ts`
- Create: `src/components/daily-meal-records.tsx`
- Modify: `src/components/nutrition-dashboard.tsx`

- [ ] **Step 1: 取得結果の型と関数契約を書く**

```ts
type DailyMealItem = {
  id: number;
  amountG: number;
  food: {
    id: number;
    foodCode: string;
    name: string;
  };
  nutrients: Array<{
    code: string;
    name: string;
    unit: string;
    displayOrder: number;
    amountPer100g: number | null;
    valueStatus: string;
  }>;
};

type DailyMeal = {
  id: number;
  mealType: MealType;
  items: DailyMealItem[];
};

export async function fetchDailyMeals(
  userId: string,
  mealDate: string,
): Promise<DailyMeal[]>;
```

- [ ] **Step 2: 関連データを取得する**

`meals` を `user_id` と `meal_date` で絞り、`meal_items`、`foods`、`food_nutrients`、`nutrients` をnested selectする。`nutrients.is_primary = true` の成分だけを戻り値へ整形し、`display_order` 順に並べる。

RLSが本当の境界だが、問い合わせ条件にも `user_id` を明示して、不要な行を要求しない。

- [ ] **Step 3: `DailyMealRecords` を作る**

```ts
type DailyMealRecordsProps = {
  userId: string | null;
  mealDate: string;
  refreshVersion: number;
};
```

`userId`、`mealDate`、`refreshVersion` が変わったら再取得する。古いリクエストがunmount後や日付変更後にstateを書き換えないようcleanupフラグを使う。ロード中、0件、取得失敗を別々に表示する。

- [ ] **Step 4: 食事区分別に表示する**

表示順は `breakfast → lunch → dinner → snack`。各食品について食品名、摂取量、主要栄養値を表示する。`amountPer100g === null` は0にせず「データ無し」と表示する。

- [ ] **Step 5: 保存後・日付変更・再読み込みを確認する**

1. 保存直後に同日の一覧が更新される。
2. 別の日付を選ぶとその日の記録へ切り替わる。
3. 元の日付へ戻すと記録が復元される。
4. ページ再読み込み後も同じ匿名セッションの記録が表示される。

- [ ] **Step 6: 品質確認する**

```bash
node --import tsx --test src/lib/food-search.test.ts src/lib/meals.test.ts
npm run lint
npm run build -- --webpack
```

Commit candidate: `feat: display daily meal records`

---

## Task 7: 1日の主要栄養素合計とRLS分離を検証する

**Files:**

- Modify: `src/lib/meals.test.ts`
- Modify: `src/lib/meals.ts`
- Modify: `src/components/daily-meal-records.tsx`
- Update: `docs/phase1-progress.md`
- Update: `README.md`

- [ ] **Step 1: 日別合計の失敗するテストを書く**

テストデータにエネルギー、たんぱく質、脂質、炭水化物を含め、複数の食事・食品の値が合算されることを確認する。`amountPer100g: null` は数値へ加えず、その栄養素にデータ欠損があったことを別フラグで残す。

```ts
type DailyNutrientTotal = {
  code: string;
  name: string;
  unit: string;
  amount: number;
  hasMissingValue: boolean;
};

export function calculateDailyNutrientTotals(
  meals: DailyMeal[],
): DailyNutrientTotal[];
```

- [ ] **Step 2: 最小実装で合計テストを通す**

各数値は既存の `calculateNutrientAmount` と同じ式で計算する。内部では丸めず、画面表示時だけ桁数を整える。

- [ ] **Step 3: 主要栄養素合計を表示する**

`DailyMealRecords` の先頭または末尾に、エネルギー、たんぱく質、脂質、炭水化物の合計を表示する。欠損を含む栄養素には、合計が既知データ分のみであることを分かる形で示す。

- [ ] **Step 4: 匿名ユーザー間のRLSを確認する**

通常ウィンドウをユーザーA、別プロファイルまたはプライベートウィンドウをユーザーBとして使う。

1. Aで記録を保存する。
2. Bで同じ日付を開いてもAの記録が表示されない。
3. BのセッションからAのIDを指定してSELECT/UPDATEしても対象行が返らず、変更されない。
4. Aへ戻ると記録が維持されている。

管理用Secret KeyはRLSを迂回するため、この確認には使用しない。

- [ ] **Step 5: Phase 1文書を更新する**

`docs/phase1-progress.md` にmigration、匿名認証、保存、日別表示、合計、検証結果を追記する。`README.md` のPhase 1チェック項目を実績に合わせて更新する。

- [ ] **Step 6: 最終検証する**

```bash
node --import tsx --test \
  scripts/mext-value.test.ts \
  scripts/mext-food-selection.test.ts \
  src/lib/food-search.test.ts \
  src/lib/meals.test.ts
npm run lint
npm run build -- --webpack
git diff --check
git status --short
```

Expected: 全テストPASS、lint・build・diff check成功。`.env.local` が追跡対象に含まれない。

Commit candidate: `feat: complete daily meal tracking`

## Completion Criteria

- 匿名セッションが作成・復元される。
- 選択日と食事区分を指定して食品・摂取量を保存できる。
- 同じ食品の再保存は行を増やさず摂取量を置き換える。
- 過去日の登録・表示ができる。
- 再読み込み後も記録が残る。
- 選択日の食事区分別記録と主要栄養素合計が正しい。
- RLSで匿名ユーザー間のデータが分離される。
- 自動テスト、lint、production buildが成功する。
