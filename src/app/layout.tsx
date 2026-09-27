/** 全ページに共通するHTML構造、言語設定、メタデータを定義するルートレイアウト。 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriAI",
  description: "食事と栄養を記録するWebアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
