import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1120" },
  ],
};

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
