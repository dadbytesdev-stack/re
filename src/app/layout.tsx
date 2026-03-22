import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "RecipeExtractor — Clean Recipes Instantly",
  description:
    "Paste any recipe URL and get clean, ad-free ingredients and instructions in seconds.",
  keywords: ["recipe", "extractor", "cooking", "ingredients", "ad-free"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
