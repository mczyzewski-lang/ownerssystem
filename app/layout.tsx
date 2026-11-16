import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Growth Architect OS", template: "%s · Growth Architect OS" },
  description: "System do diagnozowania i usuwania ograniczeń wzrostu.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
