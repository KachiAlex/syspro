import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

// Automation engine startup is intentionally disabled in the frontend build.
// Server runtime should start the automation engine separately where appropriate.

const BODY_FONT_STACK = "font-sans antialiased";

export const metadata: Metadata = {
  title: "Pisairtel ERP",
  description:
    "AI-forward ERP workspace for manufacturing supply chains and multi-tenant finance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0B1120" media="(prefers-color-scheme: dark)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pisairtel:theme');if(!t){if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches){t='light';}else{t='dark';}}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body className={`${BODY_FONT_STACK}`}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
