import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "メールチケット管理",
  description: "Gmail の問い合わせをチケットとして整理し、誰が返信したかを追跡します",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
