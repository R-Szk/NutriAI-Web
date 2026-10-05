# NutriAI

NutriAIは、食事と栄養を記録するWebアプリです。

食品を検索して摂取量を入力すると、食品データベースに基づいて栄養量を計算し、1日の食事と栄養バランスを確認できるアプリを目指しています。

## プロジェクト方針

栄養値はAIに推測させず、食品データベースの値を正として扱います。

Phase 1では、文部科学省の「日本食品標準成分表（八訂）増補2023年」を使用します。AIは将来的に、計算済みの食事・栄養データに対する不足栄養素の分析や食事提案などに利用する予定です。

## Phase 1の目標

以下の流れを完成させます。

1. 食品を検索する
2. 食品を選択する
3. 摂取量を入力する
4. 栄養量を計算する
5. 朝食・昼食・夕食・間食として保存する
6. 1日の栄養合計を表示する
7. ページを再読み込みしても記録が残るようにする

## 使用技術

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- PostgreSQL

将来的にPWAへ対応する予定です。

## セットアップ

### 1. 依存パッケージをインストールする

```bash
npm install
```

### 2. 環境変数を設定する

プロジェクト直下に`.env.local`を作成し、Supabaseプロジェクトの値を設定します。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

`.env.local`には認証情報が含まれるため、Gitへコミットしないでください。

### 3. 開発サーバーを起動する

```bash
npm run dev
```

ブラウザで[http://localhost:3000](http://localhost:3000)を開きます。

## コマンド

```bash
# 開発サーバーを起動
npm run dev

# ESLintを実行
npm run lint

# 本番用にビルド
npm run build

# ビルドしたアプリを起動
npm run start
```

## データベース

現在は、食品と栄養素を管理する以下のテーブルを使用しています。

- `foods`：食品の基本情報
- `nutrients`：栄養素の種類と単位
- `food_nutrients`：食品100g当たりの栄養値

データベースの変更履歴は`supabase/migrations`に保存します。

## ドキュメント

- [Phase 1 開発進捗](docs/phase1-progress.md)
- [食事記録・匿名認証 設計](docs/superpowers/specs/2026-09-23-meal-recording-design.md)

## 現在の開発状況

- [x] Next.js・TypeScriptの初期設定
- [x] Supabaseへの接続
- [x] 食品・栄養素テーブルの作成
- [x] 文部科学省データの取り込み
- [x] 食品検索と食品選択
- [x] 摂取量に応じた栄養計算
- [x] 日付・食事区分付きの食事記録保存
- [x] 選択日の食事記録と栄養合計表示
- [x] ページ再読み込み後の記録復元
