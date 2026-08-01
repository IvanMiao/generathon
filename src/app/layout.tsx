import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Director Who Does Not Exist",
  description: "A score-to-cinema AI directing system for auteur music shorts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
