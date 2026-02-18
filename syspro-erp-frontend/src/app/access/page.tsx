"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ImageWithFallback } from '@/components/ImageWithFallback';

export default function AccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-200">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <img src="/logo.png" alt="Syspro Logo" className="w-14 h-14 mb-4" />
          <h1 className="text-4xl font-bold text-blue-700 mb-2">Access Portal</h1>
          <p className="text-lg text-gray-500 mb-8">Choose your destination below. If you need access, request a demo or contact support.</p>
          <div className="flex flex-col gap-4">
            <Link href="/tenant-admin" className="btn btn-blue px-6 py-4 rounded-lg inline-flex items-center gap-2 shadow-md transition text-lg font-semibold">
              Tenant Admin Dashboard
              <ArrowRight />
            </Link>
            <Link href="/superadmin/login" className="btn btn-dark px-6 py-4 rounded-lg inline-flex items-center gap-2 shadow-md transition text-lg font-semibold">
              Superadmin Portal Sign In
              <ArrowRight />
            </Link>
            <Link href="/superadmin" className="btn btn-dark px-6 py-4 rounded-lg inline-flex items-center gap-2 shadow-md transition text-lg font-semibold">
              Superadmin Dashboard
              <ArrowRight />
            </Link>
            <Link href="/" className="btn btn-ghost border border-[color:var(--accent)] text-[color:var(--accent)] px-6 py-4 rounded-lg inline-flex items-center gap-2 shadow-md hover:bg-blue-50 transition text-lg font-semibold">
              Request Demo
              <ArrowRight />
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="rounded-2xl overflow-hidden shadow-2xl">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt="Dashboard preview"
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
