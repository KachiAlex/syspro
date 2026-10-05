import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div id="main-content" className="min-h-screen bg-theme-bg text-theme-fg">
      {children}
    </div>
  );
}
