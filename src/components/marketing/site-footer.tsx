import Link from 'next/link';
import { PisairtelLogo } from './logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-[rgba(255,255,255,0.07)] py-[26px] px-[6%] flex justify-between items-center flex-wrap gap-[14px]">
      <div className="flex items-center gap-[9px]">
        <PisairtelLogo size={26} />
        <span className="font-jakarta text-[15px] font-extrabold" style={{ background: 'linear-gradient(90deg,#F8FAFC,#94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pisairtel ERP</span>
      </div>
      <span className="text-xs text-[#64748B]">© 2026 Pisairtel ERP. Built for SMEs.</span>
      <div className="flex gap-[22px]">
        <Link href="/privacy" className="text-xs text-[#64748B] cursor-pointer hover:text-[#94A3B8] transition-colors">Privacy</Link>
        <Link href="/terms" className="text-xs text-[#64748B] cursor-pointer hover:text-[#94A3B8] transition-colors">Terms</Link>
        <Link href="/support" className="text-xs text-[#64748B] cursor-pointer hover:text-[#94A3B8] transition-colors">Support</Link>
      </div>
    </footer>
  );
}
