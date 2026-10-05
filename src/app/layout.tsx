import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "保険のお問い合わせデモ | AI Gateway + Jev",
  description: "合成データを使ったオフライン優先の保険問い合わせフローのデモです。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
