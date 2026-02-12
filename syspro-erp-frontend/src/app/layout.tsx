import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

// Start the automation engine (server-side only). This imports the
// `engine-start` module which registers a sample rule and starts the in-memory engine.
import '../../../../src/lib/automation/engine-start';

const BODY_FONT_STACK = "font-sans antialiased";

export const metadata: Metadata = {
  title: "SYS: Neural Supply Planner",
  description:
    "AI-forward ERP workspace for manufacturing supply chains and multi-tenant finance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${BODY_FONT_STACK} bg-[#05060a] text-white`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
