import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/src/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Medical Paper Summarizer",
  description: "AI-powered medical paper summarization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
