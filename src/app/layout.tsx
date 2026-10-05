import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Gateway + Jev insurance demo",
  description: "Offline-only synthetic preview of an insurance inquiry workflow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
