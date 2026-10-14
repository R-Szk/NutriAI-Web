# NutriAI Mobile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1の機能を維持したまま、栄養サマリーと食事タイムラインを中心とするスマートフォン向けダッシュボードと、独立した食品追加画面を構築する。

**Architecture:** `/`は日別データを一度だけ取得して栄養サマリーと4区分のタイムラインへ渡すClient Component中心のダッシュボードとする。`/record`はServer ComponentでNext.js 16の非同期`searchParams`を検証し、Client Componentへ確定済みの日付と食事区分を渡す。画面間は`Link`で移動し、保存成功後だけ`useRouter().replace()`で対象日のダッシュボードへ戻す。

**Tech Stack:** Next.js 16.3.3 App Router、React 19.2.8、TypeScript、Tailwind CSS 4、Supabase、Node.js test runner

**Spec:** `docs/superpowers/specs/2026-10-10-mobile-dashboard-design.md`

## Global Constraints

- スマートフォン表示を基準とし、最小幅320px程度で横スクロールを発生させない。
- 栄養目標の仮データや仮の進捗率は実装しない。
- 朝食、昼食、夕食、間食は記録の有無にかかわらず常に表示する。
- 現在の検索、栄養計算、匿名認証、Supabase保存処理を再利用する。
- 食品データベースを栄養値の正とし、AIに栄養値を生成させない。
- Next.jsの実装前に`node_modules/next/dist/docs/`の該当ガイドを参照する。
- ユーザーの明示的な依頼なしにGit commitやpushを実行しない。各コミット手順は承認待ちのチェックポイントとする。

## Review Focus

- `date`が配列、空文字、不正形式、存在しない暦日の場合は保存画面を有効にしない。Task 1でテストする。
- `mealType`が配列、日本語、未定義コードの場合は保存画面を有効にしない。Task 1でテストする。
- DBに一部の食事区分しか存在しなくても、重複なしで4区分を固定順に生成する。Task 2でテストする。
- 過去日から食品を追加して保存した場合、その日付を保ってダッシュボードへ戻る。Task 5でURL生成テストと手動確認を行う。
- 320px幅、長い食品名、通信中、通信失敗、空状態でも操作対象や文言が画面外へはみ出さない。Task 6で手動確認する。

---

## File Structure

### Create

- `src/app/record/page.tsx`: URLパラメーターを検証し、食品追加画面の入口を提供するServer Component。
- `src/components/food-recording.tsx`: 匿名認証と保存後の遷移を管理する食品追加画面のClient Component。
- `src/components/daily-nutrition-summary.tsx`: 計算済みの日別栄養合計を表示するPresentational Component。
- `src/components/meal-timeline.tsx`: 4区分の食事を時系列表示するPresentational Component。
- `src/components/meal-section.tsx`: 1食事区分の空状態、食品、追加リンクを表示するPresentational Component。
- `src/hooks/use-daily-meals.ts`: 選択日の日別記録取得、読み込み、エラー状態を管理するhook。
- `src/lib/meal-navigation.ts`: クエリ値の検証と画面遷移URLの生成を行う純粋関数。
- `src/lib/meal-navigation.test.ts`: 不正URL値と日付維持を検証するテスト。
- `src/lib/meal-timeline.ts`: DB取得結果から固定4区分を生成する純粋関数。
- `src/lib/meal-timeline.test.ts`: 固定順、空区分、既存記録の対応を検証するテスト。

### Modify

- `src/app/page.tsx`: URLの日付を検証し、ダッシュボードの初期日付として渡す。
- `src/app/globals.css`: 背景色、文字色、フォーカス表示など最低限の全体スタイルを追加する。
- `src/components/nutrition-dashboard.tsx`: 日別データを一度取得し、サマリーとタイムラインへ渡す親へ整理する。
- `src/components/food-search.tsx`: 確定済みの食事区分を受け取り、専用画面内で検索から保存までを行う。
- `src/components/meal-save-form.tsx`: 食事区分選択を削除し、追加元から受け取った食事区分へ保存する。
- `src/lib/meals.ts`: 日付検証処理を再利用できる型ガードとして公開する。
- `src/lib/meals.test.ts`: 公開した日付検証の境界値を追加検証する。
- `docs/phase1-progress.md`: UI再構成後の画面構成と検証結果を追記する。

### Remove after replacement

- `src/components/daily-meal-records.tsx`: hook、栄養サマリー、タイムラインへの移行完了後に削除する。

---

### Task 1: Navigation Parameter Validation

**Files:**
- Create: `src/lib/meal-navigation.ts`
- Create: `src/lib/meal-navigation.test.ts`
- Modify: `src/lib/meals.ts`
- Modify: `src/lib/meals.test.ts`

**Interfaces:**
- Consumes: `MealType`、`isMealType(value: string): value is MealType`、既存の日付検証規則。
- Produces: `isMealDate(value: string): boolean`、`parseMealNavigationContext(date: string | string[] | undefined, mealType: string | string[] | undefined): { mealDate: string; mealType: MealType } | null`、`buildRecordHref(mealDate: string, mealType: MealType): string`、`buildDashboardHref(mealDate: string): string`。

- [ ] **Step 1: `isMealDate`の失敗テストを追加する**

  `src/lib/meals.test.ts`で`2026-10-10`を`true`、`2026-02-30`、`2026-1-1`、空文字を`false`と期待する。

- [ ] **Step 2: 日付テストが未定義で失敗することを確認する**

  Run: `node --import tsx --test src/lib/meals.test.ts`

  Expected: `isMealDate`が未定義またはexportされていないためFAIL。

- [ ] **Step 3: `isMealDate(value: string): boolean`を実装する**

  `validateMealRecordInput`内の日付形式・実在日判定をこの関数へ集約し、既存のエラーメッセージと挙動を維持する。

- [ ] **Step 4: 日付テストと既存の食事入力テストを通す**

  Run: `node --import tsx --test src/lib/meals.test.ts`

  Expected: PASS。

- [ ] **Step 5: ナビゲーション関数の失敗テストを書く**

  `src/lib/meal-navigation.test.ts`で次を固定する。

  - 正常な日付と`breakfast`からcontextを返す。
  - 不正日付、配列の日付、未定義の食事区分、日本語の食事区分、配列の食事区分は`null`。
  - `buildRecordHref("2026-10-10", "lunch")`は`/record?date=2026-10-10&mealType=lunch`。
  - `buildDashboardHref("2026-10-10")`は`/?date=2026-10-10`。

- [ ] **Step 6: ナビゲーションテストが未実装で失敗することを確認する**

  Run: `node --import tsx --test src/lib/meal-navigation.test.ts`

  Expected: 対象関数が未定義のためFAIL。

- [ ] **Step 7: 4つの純粋関数を最小実装する**

  外部入力は必ず`isMealDate`と`isMealType`を通す。URLは固定されたアプリ内パスと検証済み値だけから生成する。

- [ ] **Step 8: Task 1のテストを通す**

  Run: `node --import tsx --test src/lib/meals.test.ts src/lib/meal-navigation.test.ts`

  Expected: PASS。

- [ ] **Step 9: コミット承認を確認する**

  承認された場合のみ、`feat: add meal navigation validation`としてコミットする。

---

### Task 2: Fixed Four-Meal Timeline Model

**Files:**
- Create: `src/lib/meal-timeline.ts`
- Create: `src/lib/meal-timeline.test.ts`

**Interfaces:**
- Consumes: `DailyMeal`、`MealType`、`MEAL_TYPE_LABELS`。
- Produces: `MealTimelineEntry = { mealType: MealType; label: string; meal: DailyMeal | null }`、`createMealTimeline(meals: DailyMeal[]): MealTimelineEntry[]`。

- [ ] **Step 1: タイムラインの失敗テストを書く**

  空配列から朝食、昼食、夕食、間食の4件が固定順で生成され、すべて`meal: null`になることを期待する。昼食だけを渡した場合は昼食entryだけが元の`DailyMeal`を持ち、他の3件は`null`になることも期待する。

- [ ] **Step 2: 未実装による失敗を確認する**

  Run: `node --import tsx --test src/lib/meal-timeline.test.ts`

  Expected: `createMealTimeline`が未定義のためFAIL。

- [ ] **Step 3: `createMealTimeline`を最小実装する**

  順序は`breakfast`、`lunch`、`dinner`、`snack`に固定し、入力配列の順序には依存しない。想定外の重複があっても最初の1件だけを各区分へ対応させる。

- [ ] **Step 4: タイムラインテストを通す**

  Run: `node --import tsx --test src/lib/meal-timeline.test.ts`

  Expected: PASS。

- [ ] **Step 5: コミット承認を確認する**

  承認された場合のみ、`feat: add fixed meal timeline model`としてコミットする。

---

### Task 3: Daily Data Ownership and Nutrition Summary

**Files:**
- Create: `src/hooks/use-daily-meals.ts`
- Create: `src/components/daily-nutrition-summary.tsx`
- Modify: `src/components/nutrition-dashboard.tsx`

**Interfaces:**
- Consumes: `fetchDailyMeals(userId: string, mealDate: string): Promise<DailyMeal[]>`、`calculateDailyNutrientTotals(items: DailyMealItem[]): DailyNutrientTotal[]`。
- Produces: `useDailyMeals(userId: string | null, mealDate: string): { meals: DailyMeal[]; isLoading: boolean; loadError: string | null }`、`DailyNutritionSummary({ totals }: { totals: DailyNutrientTotal[] })`、`NutritionDashboard({ initialMealDate }: { initialMealDate?: string })`。

- [ ] **Step 1: `useDailyMeals`へ既存の取得処理を移す**

  `DailyMealRecords`の`useEffect`と状態管理を移し、ユーザーまたは日付が変わったときだけ再取得する。アンマウント後にstateを更新しない既存の防御を維持する。

- [ ] **Step 2: 栄養サマリー表示を分離する**

  `DailyNutritionSummary`はデータ取得を行わず、`totals`だけを受け取る。0件、既知値、一部欠損、全件欠損の既存表示規則を維持する。

- [ ] **Step 3: `NutritionDashboard`を日別データの所有者にする**

  任意の`initialMealDate?: string`をpropsで受け取り、未指定なら既存どおりブラウザのローカル日付で初期化する。認証後にhookを呼び、同じ`meals`から栄養合計を一度計算してサマリーへ渡す。食品検索はこの段階ではまだ削除せず、Task 5まで動作を維持する。

- [ ] **Step 4: 純粋関数テストと静的検査を実行する**

  Run: `node --import tsx --test src/lib/daily-nutrition.test.ts && npm run lint`

  Expected: 既存テストとESLintがPASS。

- [ ] **Step 5: ブラウザで既存表示が退行していないことを確認する**

  選択日変更、読み込み表示、エラー表示、栄養合計を確認する。

- [ ] **Step 6: コミット承認を確認する**

  承認された場合のみ、`refactor: separate daily meal data and summary`としてコミットする。

---

### Task 4: Meal Timeline Components

**Files:**
- Create: `src/components/meal-timeline.tsx`
- Create: `src/components/meal-section.tsx`
- Modify: `src/components/nutrition-dashboard.tsx`
- Remove: `src/components/daily-meal-records.tsx`

**Interfaces:**
- Consumes: `createMealTimeline(meals: DailyMeal[]): MealTimelineEntry[]`、`buildRecordHref(mealDate: string, mealType: MealType): string`、`calculateNutrientAmount`。
- Produces: `MealTimeline({ meals, mealDate }: { meals: DailyMeal[]; mealDate: string })`、`MealSection({ entry, mealDate }: { entry: MealTimelineEntry; mealDate: string })`。

- [ ] **Step 1: `MealSection`を作成する**

  食事区分名、登録食品、摂取量、主要栄養素を表示する。空の区分には「まだ記録がありません」を表示する。追加操作は`buildRecordHref`を使った`Link`とし、対象区分が文言でも分かるようにする。

- [ ] **Step 2: `MealTimeline`を作成する**

  `createMealTimeline`の4 entryを順に表示し、線とマーカーは`aria-hidden`の装飾として扱う。

- [ ] **Step 3: `NutritionDashboard`へタイムラインを接続する**

  loading、error、未認証の状態をタイムラインの前に表示する。データ取得成功後は記録0件でも4区分を表示する。

- [ ] **Step 4: 旧コンポーネントを削除する**

  `DailyMealRecords`への参照が0件になったことを`rg "DailyMealRecords" src`で確認してから削除する。

- [ ] **Step 5: テスト、lint、ブラウザ確認を行う**

  Run: `node --import tsx --test src/lib/meal-timeline.test.ts src/lib/daily-nutrition.test.ts && npm run lint`

  Expected: PASS。ブラウザでは4区分が常に固定順で表示される。

- [ ] **Step 6: コミット承認を確認する**

  承認された場合のみ、`feat: add daily meal timeline`としてコミットする。

---

### Task 5: Dedicated Food Recording Route

**Files:**
- Create: `src/app/record/page.tsx`
- Create: `src/components/food-recording.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/nutrition-dashboard.tsx`
- Modify: `src/components/food-search.tsx`
- Modify: `src/components/meal-save-form.tsx`

**Interfaces:**
- Consumes: Task 1のcontext解析・URL生成関数、`useAnonymousSession()`、`FoodSearch`、`saveMealItem`。
- Produces: `FoodRecording({ mealDate, mealType }: { mealDate: string; mealType: MealType })`、`FoodSearch`の追加props `mealType: MealType`、`MealSaveForm`の追加props `mealType: MealType`。

- [ ] **Step 1: Next.js 16のページpropsを再確認する**

  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`で`searchParams`がPromiseであることを確認する。

- [ ] **Step 2: `/record`のServer Componentを作成する**

  `PageProps<"/record">`の`searchParams`を`await`し、Task 1の関数で検証する。不正値では保存UIを表示せず、ダッシュボードへ戻って追加先を選び直す案内と`Link`を表示する。

- [ ] **Step 3: `FoodRecording`を作成する**

  匿名認証状態を管理し、確定済みの日付・食事区分とともに`FoodSearch`へ渡す。保存成功時は`router.replace(buildDashboardHref(mealDate))`を呼ぶ。

- [ ] **Step 4: 食事区分を追加元で固定する**

  `FoodSearch`から`MealSaveForm`へ`mealType`を渡す。`MealSaveForm`内の食事区分stateとselectを削除し、保存先の日付・区分を読み取り専用の文言として表示する。

- [ ] **Step 5: ダッシュボードから旧検索UIを外す**

  `NutritionDashboard`から`FoodSearch`と保存後再取得用stateを削除する。食品追加はタイムラインの`Link`だけを入口にする。

- [ ] **Step 6: `/`で戻り先の日付を復元する**

  `src/app/page.tsx`で非同期`searchParams`の`date`を検証する。正常値を`initialMealDate`へ渡し、不正値または未指定ではサーバー時刻を使わず、Client Component側のローカル日付初期化へフォールバックできるprops設計にする。

- [ ] **Step 7: 専用画面の一連の操作を確認する**

  朝食、昼食、夕食、間食の各リンクで対象表示が一致すること、過去日が維持されること、保存失敗時は入力画面に留まること、保存成功時は対象日のダッシュボードへ戻ることを確認する。

- [ ] **Step 8: テスト、lint、production buildを実行する**

  Run: `node --import tsx --test src/lib/meals.test.ts src/lib/meal-navigation.test.ts src/lib/meal-timeline.test.ts src/lib/daily-nutrition.test.ts src/lib/food-search.test.ts && npm run lint && npm run build -- --webpack`

  Expected: 全コマンドPASS。build結果に`/`と`/record`が含まれる。

- [ ] **Step 9: コミット承認を確認する**

  承認された場合のみ、`feat: add dedicated food recording page`としてコミットする。

---

### Task 6: Mobile-First Visual Styling and Accessibility

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`
- Modify: `src/app/record/page.tsx`
- Modify: `src/components/nutrition-dashboard.tsx`
- Modify: `src/components/daily-nutrition-summary.tsx`
- Modify: `src/components/meal-timeline.tsx`
- Modify: `src/components/meal-section.tsx`
- Modify: `src/components/food-recording.tsx`
- Modify: `src/components/food-search.tsx`
- Modify: `src/components/meal-save-form.tsx`

**Interfaces:**
- Consumes: Task 3から5で確定したpropsと画面構造。
- Produces: 320px以上を基準とするモバイルファーストUI。データや保存APIのinterfaceは変更しない。

- [ ] **Step 1: 共通ページ枠を整える**

  淡い背景、読みやすい文字色、スマホ向け左右余白、PC向け最大幅と中央寄せを設定する。ブラウザ標準のフォーカス表示を消さず、必要なら明瞭な`focus-visible`を追加する。

- [ ] **Step 2: 栄養サマリーをA案へ寄せる**

  エネルギーを主要情報として見せ、PFCを読み比べやすいカードへする。実績値だけを表示し、目標値や進捗率は追加しない。

- [ ] **Step 3: 食事タイムラインをC案へ寄せる**

  縦線、区分マーカー、カードの視覚的階層を加える。食品名が長くても追加ボタンや栄養値が押し出されないレイアウトにする。

- [ ] **Step 4: 食品追加画面を1列の操作フローへ整える**

  戻る、追加先、検索、結果、摂取量、栄養計算、保存の順序を明確にする。入力欄と主要ボタンはスマホでは原則全幅、タップ対象は十分な高さにする。

- [ ] **Step 5: 状態表示と支援技術向け属性を確認する**

  loading、空状態、入力エラー、通信エラー、保存中を区別する。フォームのlabel、選択結果の`aria-pressed`、装飾の`aria-hidden`、保存結果の通知方法を確認する。

- [ ] **Step 6: 主要ビューポートで手動確認する**

  320px、375px、430px、768px以上で確認する。長い食品名、記録0件、4区分すべてに記録あり、通信中、エラー文表示でも横スクロールや重なりがないことを確認する。

- [ ] **Step 7: コード品質を検証する**

  Run: `npm run lint && npm run build -- --webpack`

  Expected: PASS。

- [ ] **Step 8: コミット承認を確認する**

  承認された場合のみ、`style: redesign mobile nutrition dashboard`としてコミットする。

---

### Task 7: Full Regression Verification and Documentation

**Files:**
- Modify: `docs/phase1-progress.md`

**Interfaces:**
- Consumes: すべての実装済み画面、純粋関数、既存MEXT取り込みテスト。
- Produces: UI再構成後の検証記録と最新のプロジェクト進捗。

- [ ] **Step 1: 全Nodeテストを実行する**

  Run:

  ```bash
  node --import tsx --test \
    scripts/mext-value.test.ts \
    scripts/mext-food-selection.test.ts \
    src/lib/food-search.test.ts \
    src/lib/meals.test.ts \
    src/lib/daily-nutrition.test.ts \
    src/lib/meal-navigation.test.ts \
    src/lib/meal-timeline.test.ts
  ```

  Expected: 全テストPASS。

- [ ] **Step 2: lintとproduction buildを実行する**

  Run: `npm run lint && npm run build -- --webpack`

  Expected: 両方PASS。

- [ ] **Step 3: 実データによる回帰確認を行う**

  今日と過去日のそれぞれで、検索、選択、摂取量計算、4区分への保存、同一食品のupsert、再読み込み後の保持、栄養合計を確認する。

- [ ] **Step 4: ドキュメントを更新する**

  `docs/phase1-progress.md`へダッシュボードと食品追加画面の構成、追加テスト数、検証結果を追記し、古い「次の作業」を更新する。

- [ ] **Step 5: 最終差分を確認する**

  Run: `git diff --check && git status --short`

  Expected: 空白エラーがなく、意図したファイルだけが変更されている。

- [ ] **Step 6: 最終コミット・pushの承認を確認する**

  ユーザーが明示的に依頼した場合のみコミットし、その後pushも別途依頼範囲に含まれることを確認して実行する。
