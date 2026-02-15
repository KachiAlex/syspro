import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function AccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#05060a] text-white">
      <div className="text-center p-8">
        <h1 className="text-3xl font-semibold">Work in progress</h1>
        <p className="mt-3 text-sm text-white/70">The access portal is temporarily disabled while we improve multi-tenant workflows.</p>
        <div className="mt-6">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">
            Return to site
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
