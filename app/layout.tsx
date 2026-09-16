import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Charlie",
  description: "Charlie",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={caveat.className}>
      <body>{children}</body>
    </html>
  );
}
