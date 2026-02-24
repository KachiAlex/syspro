"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ImageWithFallback } from '@/components/ImageWithFallback';

export default function AccessPage() {
  return (
    <div className="access-root">
      <div className="access-card">
        <div className="access-left">
          <img src="/logo.png" alt="Syspro Logo" className="access-logo" />
          <h1 className="access-title">Access Portal</h1>
          <p className="access-desc">Choose your destination below. If you need access, request a demo or contact support.</p>
          <div className="access-links">
            <a href="/tenant-admin" className="access-link access-link-blue">
              Tenant Admin Dashboard <ArrowRight />
            </a>
            <a href="/superadmin/login" className="access-link access-link-dark">
              Superadmin Portal Sign In <ArrowRight />
            </a>
            <a href="/superadmin" className="access-link access-link-dark">
              Superadmin Dashboard <ArrowRight />
            </a>
            <a href="/" className="access-link access-link-ghost">
              Request Demo <ArrowRight />
            </a>
          </div>
        </div>
        <div className="access-right">
          <div className="access-image">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt="Dashboard preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
