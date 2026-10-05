'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { PisairtelLogo } from './logo';

export function SiteNav() {
  const [scrolled, setScrolled] = React.useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] h-[68px] px-[6%] flex items-center justify-between transition-all duration-300 border-b ${scrolled ? 'bg-[rgba(11,17,32,.95)] backdrop-blur-[12px] border-[rgba(255,255,255,0.07)]' : 'bg-transparent border-transparent'}`}>
      <Link href="/" className="flex items-center gap-[10px]">
        <PisairtelLogo size={34} />
        <span className="font-jakarta text-[20px] font-extrabold tracking-[-.02em]" style={{ background: 'linear-gradient(90deg,#F8FAFC,#94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pisairtel ERP</span>
      </Link>
      <div className="hidden md:flex items-center gap-7">
        <Link href="/features" className="text-[#94A3B8] text-sm font-medium cursor-pointer hover:text-[#F8FAFC] transition-colors font-jakarta">Features</Link>
        <Link href="/how-it-works" className="text-[#94A3B8] text-sm font-medium cursor-pointer hover:text-[#F8FAFC] transition-colors font-jakarta">How it works</Link>
        <Link href="/pricing" className="text-[#94A3B8] text-sm font-medium cursor-pointer hover:text-[#F8FAFC] transition-colors font-jakarta">Pricing</Link>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/login" className="hidden sm:inline-flex items-center px-[18px] py-[8px] border border-[rgba(255,255,255,0.07)] rounded-lg text-[#F8FAFC] font-jakarta text-[13.5px] font-semibold hover:border-[#E31E24] hover:text-[#E8286E] transition-all">Sign in</Link>
        <Link href="/signup" className="inline-flex items-center px-5 py-[8px] rounded-lg text-white font-jakarta text-[13.5px] font-bold transition-transform hover:-translate-y-[1px]" style={{ background: 'linear-gradient(135deg,#E31E24,#C0208A)', boxShadow: '0 4px 14px rgba(227,30,36,.35)' }}>Get started</Link>
      </div>
    </nav>
  );
}
