# NutriAI かんたん食品・標準レシピ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 文科省食品データを計算根拠として維持しながら、標準量付きの食品と標準レシピを分かりやすく検索・記録できるようにする。

**Architecture:** 読み取り専用のかんたん食品・標準レシピマスターを既存の食品マスターへ関連付ける。利用者が記録した項目は `meal_entries`、計算用の構成食品は `meal_entry_components` に分離し、PostgreSQL RPCで原子的に保存する。検索画面はおすすめ候補を優先表示し、既存の文科省食品検索を詳細候補として残す。

**Tech Stack:** Next.js 16.3.3 App Router、React 19.2.8、TypeScript 5、Supabase/PostgreSQL、Tailwind CSS 4、Node.js test runner

**Spec:** `docs/superpowers/specs/2026-10-26-easy-food-and-standard-recipe-design.md`

## Global Constraints

- 栄養値は `foods` / `food_nutrients` を正とし、AIが生成しない。
- 標準量と標準レシピには根拠、参考URL、更新日時を記録する。
- 単位名だけで重量が決まらない場合はグラム数も表示する。
- 欠損栄養値をゼロとして扱わない。
- マスターは全利用者が読み取り可能、ブラウザからは変更不可とする。
- ユーザー記録は `auth.uid()` とRLSで分離する。
- 詳細食品のグラム数は `0 < quantity <= 10000`、プリセットと標準レシピの個数は `0 < quantity <= 100` に限定する。
- 旧 `meal_items` は切り替え直後に削除しない。
- 既存データ移行は再実行しても重複せず、変換不能時にデータを削除しない。
- Next.jsコードを変更するタスクでは、作業開始前に `node_modules/next/dist/docs/` の該当ガイドを確認する。
- ファイル編集、DB適用、Git commit、pushは、その段階で利用者から得た明示的な許可の範囲だけで行う。

## Review Focus

- 空文字・全角空白・大文字小文字を含む検索語でも、意図したおすすめが検索されること。
- 無効化されたプリセット、材料のないレシピ、削除済み参照を保存候補にしないこと。
- 数量0、負数、`NaN`、`Infinity`、極端に大きな数量をRPCとクライアントの両方で拒否すること。
- 一部栄養値が欠損した複数材料料理で、既知値を表示しつつ欠損フラグも維持すること。
- 同一食品を含む複数の記録が、互いに上書きされず別の `meal_entries` として残ること。

---

## File Structure

### Documentation and data provenance

- Create: `docs/data/easy-food-sources.md` — 初期食品・料理の重量、参照食品コード、出典、確認日を記録する。

### Database

- Create: `supabase/migrations/20261026000000_create_easy_food_catalog.sql` — プリセット、量候補、標準レシピ、材料、RLSを作る。
- Create: `supabase/migrations/20261026010000_create_meal_entries.sql` — 新しい食事記録、保存RPC、RLS、旧記録移行を作る。
- Create: `supabase/migrations/20261026020000_seed_easy_food_catalog.sql` — 承認済み初期データを食品コードで投入する。

### Domain and data access

- Create: `src/lib/easy-foods.ts` — おすすめ候補、量候補、選択内容の型と純粋な変換・検証関数を持つ。
- Create: `src/lib/easy-foods.test.ts` — 検索結果整形、数量変更、入力検証をテストする。
- Create: `src/lib/supabase/easy-foods.ts` — かんたん食品・標準レシピの検索と栄養取得を担当する。
- Modify: `src/lib/supabase/meal-records.ts` — RPC保存と新記録構造の日別取得へ切り替える。
- Modify: `src/lib/meals.ts` — 新しい保存入力の検証を追加する。
- Modify: `src/lib/meals.test.ts` — source、ID、数量の境界値をテストする。
- Modify: `src/lib/daily-nutrition.ts` — `meal_entry_components` を合計できる型へ対応する。
- Modify: `src/lib/daily-nutrition.test.ts` — 料理、重複食品、欠損値をテストする。

### UI

- Create: `src/components/easy-food-results.tsx` — おすすめ食品・料理の一覧を表示する。
- Create: `src/components/serving-selector.tsx` — 標準量、追加候補、数量を選択する。
- Modify: `src/components/food-search.tsx` — かんたん検索と詳細検索を調整し、選択状態を統合する。
- Modify: `src/components/meal-save-form.tsx` — 新しい保存入力をRPCへ渡す。
- Modify: `src/components/meal-section.tsx` — 利用者が選んだ表示名、数量、単位を表示する。

## Task 1: 初期データの根拠を確定する

**Files:**
- Create: `docs/data/easy-food-sources.md`

**Interfaces:**
- Consumes: 設計書の初期ラインナップ、Supabase上の `foods.food_code` と100g当たり栄養値。
- Produces: 各seed行に必要な `food_code`、表示名、検索語、標準重量、単位、出典、参考URL、確認日。料理については1食分の全材料と重量。

- [x] **Step 1: 現在の食品DBで候補食品を特定する**

  Supabaseを読み取り専用で検索し、ご飯、納豆、食パン、絹ごし豆腐、卵、バナナ、牛乳、ヨーグルト、および3料理の各材料について、採用候補の `food_code`、正式名、`energy_kcal` を一覧化する。

- [x] **Step 2: 標準重量とレシピの根拠を調査する**

  公的資料またはメーカー公式情報を優先する。商品差がある値は代表値であることを明記し、情報源のない推測値を採用しない。

- [x] **Step 3: `easy-food-sources.md`へ記録する**

  単品は `表示名 / food_code / 標準重量 / 単位 / 量候補 / 根拠 / URL / 確認日`、料理は `料理名 / 1食単位 / 材料food_code / 材料重量 / 根拠 / URL / 確認日` の表にする。

- [x] **Step 4: 計算結果を確認する**

  各単品と料理について、文科省データから算出したエネルギーを記載する。既知値だけで計算した場合や欠損がある場合は、その状態も記載する。

- [x] **Step 5: 利用者レビューを受ける**

  特に食パン、卵、バナナ、ヨーグルト、3料理の量とカロリーを提示し、seed作成前に承認を得る。

- [x] **Step 6: コミット候補を提示する**

  `docs/data/easy-food-sources.md` のdiffを説明し、明示的に依頼された場合だけ `docs: document easy food data sources` としてコミットする。

## Task 2: かんたん食品・標準レシピのマスターを作る

**Files:**
- Create: `supabase/migrations/20261026000000_create_easy_food_catalog.sql`

**Interfaces:**
- Consumes: Task 1の承認済み項目と既存 `foods(id)`。
- Produces: `food_serving_presets`、`food_serving_options`、`standard_recipes`、`standard_recipe_items`。

- [x] **Step 1: migrationの期待構造をSQLレビュー用チェックリストへ落とす**

  4テーブルのPK/FK、正数CHECK、表示順、`is_active`、出典列、更新日時、削除動作、検索用インデックス、RLS、権限を列挙する。

- [x] **Step 2: 4テーブルを作成する**

  `food_serving_presets` は `food_id`、`display_name`、`search_keywords text[]`、`default_amount_g`、`unit_label`、`priority`、出典、有効状態を持つ。`food_serving_options` は親preset、表示名、重量、表示順を持つ。`standard_recipes` は名称、検索語、単位、説明、優先度、出典、有効状態を持つ。`standard_recipe_items` はrecipe、food、1食分重量を持つ。

- [x] **Step 3: 制約とインデックスを追加する**

  重量と表示数量は0より大きくし、同一親内の表示順と同一レシピ内の食品重複を防ぐ。検索語と優先度を使う検索に必要なインデックスだけを追加する。

- [x] **Step 4: RLSと権限を追加する**

  `anon` と `authenticated` はSELECTのみ可能とし、INSERT/UPDATE/DELETEを付与しない。4テーブルすべてで公開読み取りポリシーを作る。

- [x] **Step 5: ローカルまたはSupabase SQL Editorでmigrationを検証する**

  期待結果: 4テーブルが作成され、認証ユーザーはSELECTでき、ブラウザ相当のロールではINSERTできない。負または0の重量はCHECK違反になる。

- [x] **Step 6: コミット候補を提示する**

  明示的に依頼された場合だけ `feat: add easy food catalog schema` としてコミットする。

## Task 3: 新しい食事記録と原子的な保存RPCを作る

**Files:**
- Create: `supabase/migrations/20261026010000_create_meal_entries.sql`

**Interfaces:**
- Consumes: Task 2の4マスター、既存 `meals`、`meal_items`、`foods`。
- Produces: `meal_entries`、`meal_entry_components`、`save_meal_entry(date,text,text,bigint,numeric)` RPC、既存行の移行結果。

- [x] **Step 1: 新テーブルの制約を定義する**

  `meal_entries` は `meal_id`、記録時点の `display_name`、`quantity`、`unit_label`、`source_type`、対応するnullable source ID、移行用 `legacy_meal_item_id` を持つ。`source_type` は `food` / `serving_preset` / `standard_recipe` のみ許可し、種類に対応するsource IDだけが設定されるCHECKを付ける。

- [x] **Step 2: 構成食品テーブルを定義する**

  `meal_entry_components` は `meal_entry_id`、`food_id`、`amount_g` を持ち、重量を正数に限定する。同一entry内で同一食品が複数回現れる場合は保存前に集約し、`(meal_entry_id, food_id)` を一意にする。

- [x] **Step 3: RLSと権限を実装する**

  親の `meals.user_id = auth.uid()` を `EXISTS` で確認し、自分のentryとcomponentだけを参照可能にする。`authenticated` へはentryのSELECT/DELETEとcomponentのSELECTだけを付与し、INSERT/UPDATEは付与しない。作成は保存RPCだけに限定し、entry削除時はcomponentsをcascade削除する。

- [x] **Step 4: `save_meal_entry` RPCを実装する**

  引数は `p_meal_date date`、`p_meal_type text`、`p_source_type text`、`p_source_id bigint`、`p_quantity numeric`。戻り値は `meal_id bigint` と `meal_entry_id bigint`。関数内で `auth.uid()`、日付、食事区分、数量、sourceの有効性を検証する。詳細食品の数量はグラムとして10000以下、preset/recipeの数量は個数として100以下にする。`SECURITY DEFINER` と空の `search_path` を設定し、`PUBLIC` から実行権限を剥奪して `authenticated` だけへ付与する。

- [x] **Step 5: source別の構成食品生成を実装する**

  `food` は数量をグラムとして1 componentを作る。`serving_preset` は標準重量へ数量を掛ける。`standard_recipe` は全材料重量へ数量を掛ける。表示名と単位はDBマスターから取得し、クライアント入力を信用しない。

- [x] **Step 6: 旧記録を新構造へ移行する**

  `meal_items` 1行から `source_type = 'food'` のentryと1 componentを作る。`legacy_meal_item_id` の一意制約で再実行時の重複を防ぐ。移行前後の件数、food ID、重量が一致しなければmigrationを失敗させる。

- [x] **Step 7: SQLでRPCとRLSを検証する**

  正常系3 source、無効source、無効数量、材料なしレシピ、他ユーザー参照、同一食品を含む別entry、途中エラーのロールバックを確認する。

- [x] **Step 8: 移行前後の栄養合計を比較する**

  既存データがある日付について、旧 `meal_items` と新componentsから計算した主要栄養素が一致するSQLを実行する。

- [x] **Step 9: コミット候補を提示する**

  明示的に依頼された場合だけ `feat: add composite meal entry storage` としてコミットする。

## Task 4: 承認済み初期データを投入する

**Files:**
- Create: `supabase/migrations/20261026020000_seed_easy_food_catalog.sql`

**Interfaces:**
- Consumes: Task 1の確定値、Task 2のマスター。
- Produces: 8単品、各量候補、3標準料理と全材料。

- [ ] **Step 1: seedをfood code基準で作る**

  環境ごとに異なるidentity IDを直書きせず、`foods.food_code` からIDを解決する。参照食品が一つでも存在しなければ、静かに欠落させずmigrationを失敗させる。

- [ ] **Step 2: 再実行可能にする**

  安定したslugまたは一意キーを各マスターに持たせ、upsertまたは競合処理で重複を防ぐ。既存ユーザー記録は変更しない。

- [ ] **Step 3: seed件数と参照整合性を検証する**

  期待結果: 単品8件、料理3件、Task 1で承認された量候補・材料件数と一致し、孤立行が0件である。

- [ ] **Step 4: 算出カロリーをTask 1の表と比較する**

  SQLで各代表量と1皿分の `energy_kcal` を算出し、丸め前の値が出典文書の計算値と一致することを確認する。

- [ ] **Step 5: コミット候補を提示する**

  明示的に依頼された場合だけ `feat: seed initial easy foods and recipes` としてコミットする。

## Task 5: かんたん食品ドメインと検索データ層を作る

**Files:**
- Create: `src/lib/easy-foods.ts`
- Create: `src/lib/easy-foods.test.ts`
- Create: `src/lib/supabase/easy-foods.ts`

**Interfaces:**
- Consumes: Task 2のマスターと既存 `calculateNutrientAmount`。
- Produces: `EasyFoodCandidate`、`ServingChoice`、`MealEntrySelection`、`validateMealEntrySelection()`、`scaleServingComponents()`、`searchEasyFoods(query)`。

- [ ] **Step 1: 失敗するドメインテストを書く**

  次を検証する: presetとrecipeの候補整形、優先度順、数量2で全componentが2倍、0/負数/非有限/上限超過の拒否、欠損値フラグの維持。

- [ ] **Step 2: テストが失敗することを確認する**

  Run: `node --import tsx --test src/lib/easy-foods.test.ts`

  Expected: FAIL because exports are not implemented.

- [ ] **Step 3: 型と純粋関数を実装する**

  `validateMealEntrySelection(selection: MealEntrySelection): string | null` と `scaleServingComponents(components, quantity)` を実装する。詳細食品は10000g以下、preset/recipeは100個以下というRPCと同じ上限を適用する。

- [ ] **Step 4: 純粋関数テストを通す**

  Run: `node --import tsx --test src/lib/easy-foods.test.ts`

  Expected: all tests PASS.

- [ ] **Step 5: `searchEasyFoods(query: string)`を実装する**

  有効なpresetとrecipeだけを検索し、標準量または1食分の主要栄養素、量候補、構成食品を返す。検索語はtrimし、空なら空配列を返す。結果は完全一致、prefix一致、部分一致、priorityの順で安定ソートし、最大5件に制限する。

- [ ] **Step 6: Review Focusの検索条件をテストする**

  空文字、全角空白、英字の大文字小文字、無効化項目、同順位候補を固定fixtureで検証する。DB取得と順位付けを分離し、順位付けは純粋関数としてテストする。

- [ ] **Step 7: lintと関連テストを実行する**

  Run: `node --import tsx --test src/lib/easy-foods.test.ts src/lib/food-search.test.ts && npm run lint`

  Expected: tests PASS and ESLint reports no errors.

- [ ] **Step 8: コミット候補を提示する**

  明示的に依頼された場合だけ `feat: add easy food search domain` としてコミットする。

## Task 6: 保存・取得・日次集計を新構造へ切り替える

**Files:**
- Modify: `src/lib/meals.ts`
- Modify: `src/lib/meals.test.ts`
- Modify: `src/lib/supabase/meal-records.ts`
- Modify: `src/lib/daily-nutrition.ts`
- Modify: `src/lib/daily-nutrition.test.ts`

**Interfaces:**
- Consumes: Task 3のRPC、Task 5の `MealEntrySelection`。
- Produces: `saveMealEntry(input)`、新しい `DailyMealEntry` / `DailyMealComponent`、component基準の `calculateDailyNutrientTotals()`。

- [ ] **Step 1: 新保存入力の失敗テストを書く**

  日付、食事区分、source type、source ID、数量の正常系と境界値を `meals.test.ts` に追加する。

- [ ] **Step 2: 日次集計の失敗テストを書く**

  一つの料理に複数components、同じfoodを含む別entry、一部欠損、全欠損を `daily-nutrition.test.ts` に追加する。

- [ ] **Step 3: テストが失敗することを確認する**

  Run: `node --import tsx --test src/lib/meals.test.ts src/lib/daily-nutrition.test.ts`

  Expected: FAIL on new interfaces.

- [ ] **Step 4: `saveMealEntry(input)`を実装する**

  RPCへ日付、食事区分、source type、source ID、数量だけを渡す。user IDはクライアントからRPC引数へ渡さず、DBの `auth.uid()` に委ねる。

- [ ] **Step 5: `fetchDailyMeals()`を新構造へ切り替える**

  `meals -> meal_entries -> meal_entry_components -> foods -> food_nutrients -> nutrients` を取得し、表示用entryと計算用componentsを分けたcamelCase型へ変換する。

- [ ] **Step 6: 日次集計をcomponents基準へ変更する**

  entryの表示数量ではなく各componentの `amountG` から栄養値を換算する。既知値と欠損値のフラグを従来どおり維持する。

- [ ] **Step 7: 全関連テストを通す**

  Run: `node --import tsx --test src/lib/meals.test.ts src/lib/daily-nutrition.test.ts src/lib/meal-timeline.test.ts`

  Expected: all tests PASS.

- [ ] **Step 8: コミット候補を提示する**

  明示的に依頼された場合だけ `refactor: use composite meal entries` としてコミットする。

## Task 7: おすすめ検索と標準量選択UIを作る

**Files:**
- Create: `src/components/easy-food-results.tsx`
- Create: `src/components/serving-selector.tsx`
- Modify: `src/components/food-search.tsx`
- Modify: `src/components/meal-save-form.tsx`

**Interfaces:**
- Consumes: Task 5の候補・量選択型と `searchEasyFoods()`、Task 6の `saveMealEntry()`。
- Produces: おすすめ最大5件、量候補、折りたたみ詳細検索、統一保存操作。

- [ ] **Step 1: Next.js 16の該当ガイドを読む**

  `node_modules/next/dist/docs/` からApp Router、Client Components、フォームイベントに関するガイドを確認し、非推奨APIを使わない。

- [ ] **Step 2: `EasyFoodResults`を実装する**

  候補名、標準単位、グラム数、主要カロリー、「約」表示、選択状態を表示する。選択状態は色だけでなく `aria-pressed` でも伝える。

- [ ] **Step 3: `ServingSelector`を実装する**

  固定量候補、パック等の数量、任意グラム入力を扱う。入力変更時は古い計算結果と保存可能状態を無効化する。

- [ ] **Step 4: `FoodSearch`を検索オーケストレーターへ変更する**

  一回の検索操作でおすすめと既存MEXT候補を取得する。おすすめを先に表示し、詳細候補は件数付きの開閉領域へ置く。検索失敗時は入力語を維持する。

- [ ] **Step 5: 根拠と料理内訳を確認できる表示を追加する**

  おすすめ候補の詳細を開くと、標準量の根拠、参考URL、標準料理の構成材料と重量を確認できるようにする。通常状態では検索結果を圧迫しない折りたたみ表示にする。

- [ ] **Step 6: `MealSaveForm`を新保存入力へ変更する**

  food IDとamountだけでなく、確定したsource type、source ID、数量を受け取り `saveMealEntry()` を呼ぶ。認証準備中、無効入力、保存中は送信不可にする。

- [ ] **Step 7: スマートフォンで操作確認する**

  「納豆」「ご飯」「カレー」で、検索、候補選択、量変更、解除、保存を確認する。320px幅で横スクロール、文字やタップ対象の重なりがないことを確認する。

- [ ] **Step 8: lintとbuildを実行する**

  Run: `npm run lint && npm run build -- --webpack`

  Expected: no ESLint errors or warnings; production build succeeds.

- [ ] **Step 9: コミット候補を提示する**

  明示的に依頼された場合だけ `feat: add easy food search experience` としてコミットする。

## Task 8: ダッシュボード表示を料理単位へ切り替える

**Files:**
- Modify: `src/components/meal-section.tsx`
- Modify: `src/components/daily-nutrition-summary.tsx` only if its input type requires adjustment.

**Interfaces:**
- Consumes: Task 6の `DailyMealEntry` とcomponent集計結果。
- Produces: 「納豆 1パック」「カレーライス 1皿」という利用者単位の表示。

- [ ] **Step 1: entry単位の表示へ変更する**

  entry名、数量、単位を主表示にし、MEXT food codeや材料一覧は通常表示から外す。単位が `g` の詳細食品は従来どおりグラムを表示する。

- [ ] **Step 2: entryごとの主要栄養素をcomponentsから集計する**

  一つの料理内で全componentsを合計し、欠損を含む場合は既知値と注意表示を両立する。

- [ ] **Step 3: 重複食品を含む別entryを確認する**

  同じ食事区分に「ご飯150g」と「カレーライス1皿」を保存し、別々の項目として表示され、両方が日次合計へ入ることを確認する。

- [ ] **Step 4: 過去日・再読み込みを確認する**

  保存後、再読み込み、別日への移動、元の日への復帰で表示と合計が維持されることを確認する。

- [ ] **Step 5: 全自動検証を実行する**

  Run: `node --import tsx --test scripts/mext-value.test.ts scripts/mext-food-selection.test.ts src/lib/food-search.test.ts src/lib/meals.test.ts src/lib/meal-navigation.test.ts src/lib/meal-timeline.test.ts src/lib/daily-nutrition.test.ts src/lib/easy-foods.test.ts && npm run lint && npm run build -- --webpack`

  Expected: all tests PASS, ESLint clean, production build succeeds.

- [ ] **Step 6: コミット候補を提示する**

  明示的に依頼された場合だけ `feat: display meals as recorded entries` としてコミットする。

## Task 9: Supabaseと本番環境で受け入れ確認する

**Files:**
- Modify: `docs/phase1-progress.md` — 機能、migration適用、検証結果、残課題を記録する。

**Interfaces:**
- Consumes: Tasks 1–8の完成物。
- Produces: RLS、移行、ブラウザ、本番の受け入れ結果。

- [ ] **Step 1: migration適用前のバックアップ情報を確認する**

  既存 `meals` / `meal_items` の件数と主要な検算結果を保存する。破壊的な旧テーブル削除は行わない。

- [ ] **Step 2: migrationを順番に適用する**

  catalog、meal entries、seedの順で適用し、各段階で制約、件数、RLSを確認する。

- [ ] **Step 3: 匿名ユーザー2人でRLSを確認する**

  ユーザーAが自分の記録を保存・取得でき、ユーザーBがAのentryとcomponentsを取得・変更できないことを確認する。

- [ ] **Step 4: 受け入れシナリオを確認する**

  納豆1パック、ご飯量変更、カレー1皿、詳細MEXT食品、過去日保存、再読み込み、欠損値表示を確認する。

- [ ] **Step 5: Vercelへ反映する前にローカル最終検証する**

  Task 8 Step 5と同じ全自動検証を再実行し、working treeの意図しない変更と秘密情報の追跡がないことを確認する。

- [ ] **Step 6: 進捗文書を更新する**

  実装内容、データ根拠、適用したmigration、検証結果、旧 `meal_items` を残している理由、将来タスクを記録する。

- [ ] **Step 7: 最終コミット・push候補を提示する**

  利用者の明示的な依頼を受けてから、残りの承認済み変更をコミットしてpushする。
