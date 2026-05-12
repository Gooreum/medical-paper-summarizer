import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/src/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Medical Paper Summarizer",
  description: "AI-powered medical paper summarization",
};

// 렌더링 전에 올바른 클래스를 즉시 적용 — FOUC 방지
const themeScript = `(function(){try{var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s!=='light'&&d)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
