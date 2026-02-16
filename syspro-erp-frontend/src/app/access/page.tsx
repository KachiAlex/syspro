"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ImageWithFallback } from '@/components/ImageWithFallback';

export default function AccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <span className="font-bold text-gray-900">Syspro</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-700 hover:text-blue-600">Home</Link>
            <Link href="/" className="bg-blue-600 text-white px-4 py-2 rounded-lg">Request Demo</Link>
          </div>
        </div>
      </header>

      <main className="pt-28">
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block mb-4 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm">Access Portal</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to the Access Portal</h1>
            <p className="text-lg text-gray-600 mb-6">Choose your destination below. If you need access, request a demo or contact support.</p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/tenant-admin" className="bg-blue-600 text-white px-6 py-3 rounded-lg inline-flex items-center gap-2 shadow-md hover:bg-blue-700 transition">
                Tenant Admin Dashboard
                <ArrowRight />
              </Link>
              <Link href="/superadmin" className="bg-gray-900 text-white px-6 py-3 rounded-lg inline-flex items-center gap-2 shadow-md hover:bg-gray-800 transition">
                Superadmin Portal
                <ArrowRight />
              </Link>
              <Link href="/" className="bg-white border border-blue-600 text-blue-700 px-6 py-3 rounded-lg inline-flex items-center gap-2 shadow-md hover:bg-blue-50 transition">
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
        </section>
      </main>
    </div>
  );
}
