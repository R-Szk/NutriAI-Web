# NutriAI 食事記録・匿名認証 設計

## 目的

食品検索で選んだ食品と摂取量を、朝食・昼食・夕食・間食としてSupabaseへ保存する。ブラウザを再読み込みしても同じ匿名ユーザーの記録を復元でき、選択日の記録と栄養合計を表示できるようにする。

Phase 1ではログイン画面を作らず、Supabaseの匿名認証を利用する。他ユーザーの食事記録はRow Level Security（RLS）で分離する。

## スコープ

- Supabase匿名認証によるユーザー識別
- `meals` と `meal_items` の作成
- 記録日と食事区分の選択
- 食事と食品の2段階upsert
- 選択日の食事記録の再取得
- 食品成分データからの都度計算
- 選択日の主要栄養素合計

次の項目は今回の対象外とする。

- メール・SNSログイン画面
- 匿名ユーザーから通常ユーザーへのアカウント連携UI
- 食事写真、メモ、レシピ
- 計算済み栄養値のスナップショット保存
- PostgreSQL関数によるトランザクション化

## データモデル

### `meals`

1ユーザーの1日・1食事区分を表す。

| 列 | 型 | 制約・用途 |
|---|---|---|
| `id` | `bigint` | identity、主キー |
| `user_id` | `uuid` | `auth.users(id)` への外部キー、`auth.uid()` を既定値にする |
| `meal_date` | `date` | 記録対象の日付 |
| `meal_type` | `text` | `breakfast` / `lunch` / `dinner` / `snack` |
| `created_at` | `timestamptz` | 作成日時 |
| `updated_at` | `timestamptz` | 更新日時 |

`(user_id, meal_date, meal_type)` に一意制約を付ける。同じ日の同じ食事区分へ食品を追加した場合は、既存の `meal` を再利用する。

### `meal_items`

食事に含まれる食品と摂取量を表す。

| 列 | 型 | 制約・用途 |
|---|---|---|
| `id` | `bigint` | identity、主キー |
| `meal_id` | `bigint` | `meals(id)` への外部キー |
| `food_id` | `bigint` | `foods(id)` への外部キー |
| `amount_g` | `numeric` | 0より大きい摂取量 |
| `created_at` | `timestamptz` | 作成日時 |
| `updated_at` | `timestamptz` | 更新日時 |

`(meal_id, food_id)` に一意制約を付ける。同じ食事へ同じ食品を再保存した場合、別行を作らず `amount_g` を新しい値へ置き換える。

`meals` を削除した場合は、関連する `meal_items` を `ON DELETE CASCADE` で削除する。食品マスタを誤って消さないよう、`meal_items.food_id` には `ON DELETE RESTRICT` を使用する。

### インデックス

- `meal_items(food_id)`

`meals(user_id, meal_date, meal_type)` と `meal_items(meal_id, food_id)` の一意制約によるインデックスは、先頭列を使う日別取得と食事項目の結合にも利用できる。重複する追加インデックスは作らず、食品側から食事記録を参照する場合に備えて `meal_items(food_id)` だけを追加する。

### 更新日時

`updated_at` はPostgreSQLトリガーで更新する。クライアントが更新日時を設定する必要はない。

## 食事区分

DBには表示言語に依存しない英語コードを保存する。

| DB値 | 日本語表示 |
|---|---|
| `breakfast` | 朝食 |
| `lunch` | 昼食 |
| `dinner` | 夕食 |
| `snack` | 間食 |

TypeScriptでは文字列リテラルのunion型として扱い、表示用の対応表を別に持つ。

## 匿名認証

Supabase DashboardでAnonymous Sign-Insを有効にする。

ブラウザでページを開いたとき、次の順に処理する。

1. 現在のセッションを取得する。
2. セッションがなければ `signInAnonymously()` を実行する。
3. 取得したユーザーIDを保存処理と取得処理に利用する。
4. 認証処理中は保存操作を無効化する。
5. 認証失敗時はエラーを表示し、DB書き込みを行わない。

匿名ユーザーもSupabase上では `authenticated` ロールとして扱われる。セッションはブラウザ側のSupabaseクライアントで保持し、再読み込み後に復元する。

## RLS

`meals` と `meal_items` でRLSを有効にし、`authenticated` ロールだけに必要な権限を付与する。

### `meals`

- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: 既存行と更新後の行の両方で `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

`user_id` の既定値を `auth.uid()` にするが、RLSでも所有者を必ず検証する。

### `meal_items`

親の `meals` を `EXISTS` で確認し、その `user_id` が `auth.uid()` と一致する場合だけSELECT・INSERT・UPDATE・DELETEを許可する。

食品マスタ3テーブルは、現在の読み取り専用ポリシーを維持する。

## 日付

記録日の初期値はブラウザのローカル日付にする。ユーザーは `input[type="date"]` で過去日を含む別の日付へ変更できる。

UTC基準の `toISOString()` は深夜帯に日付がずれる可能性があるため使用しない。`getFullYear()`、`getMonth()`、`getDate()` からローカルの `YYYY-MM-DD` を生成する純粋関数を作る。

選択した日付は保存、記録一覧、1日合計の共通条件として利用する。

## 保存UI

栄養計算が完了した後に、次を表示する。

- 記録日（初期値は今日、変更可能）
- 食事区分（朝食・昼食・夕食・間食）
- 保存ボタン
- 保存中表示
- 成功またはエラーメッセージ

食品未選択、摂取量未確定、日付未入力、食事区分未選択、匿名認証未完了のいずれかに該当する場合は保存しない。

## 保存フロー

保存はブラウザ用Supabaseクライアントから2回のupsertで行う。

1. 現在の匿名ユーザーを確認する。
2. `meals` を `(user_id, meal_date, meal_type)` でupsertする。
3. upsert結果から `meals.id` を取得する。
4. `meal_items` を `(meal_id, food_id)` でupsertする。
5. `amount_g` を現在の摂取量で置き換える。
6. 保存成功後、選択日の食事記録を再取得する。

`meals` のupsertに失敗した場合は `meal_items` へ進まない。`meal_items` のupsertに失敗すると食品のない `meal` が残る可能性があるが、再実行で同じ `meal` を再利用できるため、Phase 1では許容する。原子的な保存が必要になった場合はPostgreSQL関数とRPCへ移行する。

## 記録取得と栄養計算

選択日の `meals` を現在のユーザーに限定して取得し、`meal_items`、`foods`、`food_nutrients`、`nutrients` を関連付ける。

各栄養量は次の式で都度計算する。

```text
100g当たりの栄養値 × amount_g ÷ 100
```

食事区分ごとの記録と、選択日全体の主要栄養素合計を表示する。計算値は内部では丸めず、表示時だけ桁数を整える。

性能が問題になった場合は、インデックス、キャッシュ、ビュー、マテリアライズドビュー、計算値スナップショットの順で必要性を検討する。

## エラー処理

- 匿名認証失敗: 保存を無効化し、認証エラーを表示する。
- 食事upsert失敗: 食品保存へ進まず、再試行可能なエラーを表示する。
- 食品upsert失敗: エラーを表示し、同じ入力で再試行可能にする。
- 記録取得失敗: 保存済み入力は維持し、一覧取得エラーを表示する。
- 不正な日付、食事区分、摂取量: Supabaseへ送信する前に拒否する。

## テストと確認

### 自動テスト

- ローカル日付を `YYYY-MM-DD` へ変換できる。
- 食事区分コードと日本語ラベルが対応する。
- 不正な日付、食事区分、摂取量を保存前に拒否する。
- 栄養量を摂取量に応じて計算できる。

### Supabaseでの確認

- 匿名ユーザーAが自分の `meals` と `meal_items` を作成・取得・更新できる。
- 匿名ユーザーBがユーザーAの記録を取得・変更できない。
- 同じ日・食事区分の保存で `meals` が重複しない。
- 同じ食事・食品の再保存で `meal_items.amount_g` が置き換わる。

### ブラウザでの確認

- 初回アクセスで匿名セッションが作られる。
- 食品を食事区分と日付付きで保存できる。
- ページ再読み込み後も記録が残る。
- 過去日を選び、その日の記録を追加・更新できる。
- 選択日の主要栄養素合計が正しい。

## 実装順序

1. `meals` / `meal_items` のmigrationとRLSを作成する。
2. Supabase Dashboardで匿名認証を有効にする。
3. ブラウザで匿名セッションを作成・復元する。
4. ローカル日付関数と食事区分型をテスト駆動で作る。
5. 記録日・食事区分・保存ボタンを追加する。
6. `meals` と `meal_items` のupsertを実装する。
7. 選択日の食事記録を取得・表示する。
8. 選択日の主要栄養素を合計表示する。
