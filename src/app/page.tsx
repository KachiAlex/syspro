'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';

/* ── PulseCanvas component ── */
function PulseCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let anim: number;
    let w = 0, h = 0;
    const lines = Array.from({ length: 6 }, (_, i) => ({
      points: Array.from({ length: 70 }, (_, j) => ({
        x: (j / 69) * w,
        y: h / 2 + (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 0.4,
      })),
      color: ['rgba(99,102,241,', 'rgba(245,158,11,', 'rgba(99,102,241,', 'rgba(16,185,129,', 'rgba(129,140,248,', 'rgba(245,158,11,'][i],
      speed: 0.25 + i * 0.06,
      offset: i * 16,
      alpha: 0.08 + i * 0.05,
    }));

    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      w = c.width = c.offsetWidth;
      h = c.height = c.offsetHeight;
      lines.forEach((line) => {
        line.points = Array.from({ length: 70 }, (_, j) => ({
          x: (j / 69) * w,
          y: h / 2 + (Math.random() - 0.5) * 50,
          vy: (Math.random() - 0.5) * 0.4,
        }));
      });
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      lines.forEach((line) => {
        line.points.forEach((p, j) => {
          p.vy += (Math.random() - 0.5) * 0.04;
          p.vy *= 0.96;
          p.y += p.vy * line.speed;
          const center = h / 2 + Math.sin(Date.now() * 0.0005 + j * 0.2 + line.offset) * 35;
          p.y += (center - p.y) * 0.004;
          p.y = Math.max(10, Math.min(h - 10, p.y));
        });
        ctx.beginPath();
        ctx.moveTo(line.points[0].x, line.points[0].y);
        for (let i = 1; i < line.points.length - 2; i++) {
          const cx = (line.points[i].x + line.points[i + 1].x) / 2;
          const cy = (line.points[i].y + line.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(line.points[i].x, line.points[i].y, cx, cy);
        }
        ctx.strokeStyle = line.color + line.alpha + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      anim = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

/* ── Logo ── */
function SysproLogo({ size = 34 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,.4)' }}>
      <svg width={size * 0.53} height={size * 0.53} viewBox="0 0 24 24" fill="none"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" fill="white" opacity=".9" /><path d="M14 14h7v7h-7z" fill="white" opacity=".45" /></svg>
    </div>
  );
}

/* ── Nav ── */
function Nav() {
  const [scrolled, setScrolled] = React.useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] h-[68px] px-[6%] flex items-center justify-between transition-all duration-300 border-b ${scrolled ? 'bg-[rgba(11,17,32,.95)] backdrop-blur-[12px] border-[rgba(255,255,255,0.07)]' : 'bg-transparent border-transparent'}`}>
      <Link href="/" className="flex items-center gap-[10px]">
        <SysproLogo size={34} />
        <span className="font-jakarta text-[20px] font-extrabold tracking-[-.02em]" style={{ background: 'linear-gradient(90deg,#F8FAFC,#94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Syspro</span>
      </Link>
      <div className="hidden md:flex items-center gap-7">
        <span className="text-[#94A3B8] text-sm font-medium cursor-pointer hover:text-[#F8FAFC] transition-colors font-jakarta">Features</span>
        <span className="text-[#94A3B8] text-sm font-medium cursor-pointer hover:text-[#F8FAFC] transition-colors font-jakarta">How it works</span>
        <span className="text-[#94A3B8] text-sm font-medium cursor-pointer hover:text-[#F8FAFC] transition-colors font-jakarta">Pricing</span>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/login" className="hidden sm:inline-flex items-center px-[18px] py-[8px] border border-[rgba(255,255,255,0.07)] rounded-lg text-[#F8FAFC] font-jakarta text-[13.5px] font-semibold hover:border-[#6366F1] hover:text-[#818CF8] transition-all">Sign in</Link>
        <Link href="/login" className="inline-flex items-center px-5 py-[8px] rounded-lg text-white font-jakarta text-[13.5px] font-bold transition-transform hover:-translate-y-[1px]" style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)', boxShadow: '0 4px 14px rgba(99,102,241,.35)' }}>Get started</Link>
      </div>
    </nav>
  );
}

/* ── Home Page ── */
export default function HomePage() {
  return (
    <div className="bg-[#0B1120] min-h-screen overflow-x-hidden">
      <Nav />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-[120px] pb-20 px-[6%] text-center overflow-hidden">
        <PulseCanvas />
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(99,102,241,.1) 0%,transparent 68%)' }} />

        <div className="relative z-[2] max-w-[840px]">
          <div className="inline-flex items-center gap-[7px] bg-[rgba(99,102,241,.12)] border border-[rgba(99,102,241,.3)] rounded-full px-4 py-[6px] mb-[30px] text-[11.5px] font-semibold text-[#818CF8] tracking-[.06em]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>
            BUILT FOR AFRICAN SMES
          </div>
          <h1 className="font-jakarta text-[clamp(42px,7vw,78px)] font-extrabold leading-[1.07] tracking-[-.03em] mb-[22px]" style={{ background: 'linear-gradient(160deg,#F8FAFC 40%,#94A3B8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Your business,<br />
            <span style={{ background: 'linear-gradient(90deg,#6366F1,#F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>running itself.</span>
          </h1>
          <p className="font-jakarta text-[clamp(16px,2.2vw,20px)] font-normal text-[#94A3B8] leading-[1.65] max-w-[560px] mx-auto mb-11">
            Syspro connects your CRM, Finance, HR, Inventory, and Projects into one living system. Every action triggers the next — automatically.
          </p>
          <div className="flex gap-[14px] justify-center flex-wrap relative z-[2]">
            <Link href="/login" className="inline-flex items-center gap-2 px-7 py-[13px] rounded-[10px] text-white font-jakarta text-sm font-bold cursor-pointer transition-all hover:-translate-y-[2px]" style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)', boxShadow: '0 6px 20px rgba(99,102,241,.4)' }}>
              See the dashboard
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12,5 19,12 12,19" /></svg>
            </Link>
            <button className="inline-flex items-center gap-2 px-6 py-[13px] rounded-[10px] text-[#F8FAFC] font-jakarta text-sm font-semibold border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,.04)] hover:bg-[rgba(255,255,255,.08)] hover:border-[rgba(255,255,255,.15)] transition-all cursor-pointer">Watch a demo</button>
          </div>
        </div>

        {/* Browser mockup */}
        <div className="relative z-[2] mt-[72px] w-full max-w-[960px]">
          <div className="rounded-2xl p-[2px]" style={{ background: 'linear-gradient(160deg,#1A2438,#111827)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 40px 80px rgba(0,0,0,.6),0 0 0 1px rgba(99,102,241,.1)' }}>
            <div className="bg-[#1E2A3B] rounded-t-[14px] px-4 py-[10px] flex items-center gap-2">
              <div className="w-[10px] h-[10px] rounded-full opacity-80" style={{ background: '#EF4444' }} />
              <div className="w-[10px] h-[10px] rounded-full opacity-80" style={{ background: '#F59E0B' }} />
              <div className="w-[10px] h-[10px] rounded-full opacity-80" style={{ background: '#10B981' }} />
              <div className="flex-1 ml-3 bg-[rgba(255,255,255,.05)] rounded-md px-3 py-1 text-[11px] text-[#94A3B8]">app.syspro.io/dashboard</div>
            </div>
            <div className="bg-[#111827] rounded-b-[14px] p-5 grid grid-cols-[170px_1fr] gap-4 min-h-[240px]">
              <div className="bg-[#0B1120] rounded-[10px] p-[14px]">
                {['Dashboard','Finance','CRM','HR','Inventory'].map((item, i) => (
                  <div key={item} className={`px-[10px] py-[7px] rounded-[7px] mb-[3px] text-[11.5px] font-jakarta ${i === 0 ? 'bg-[rgba(99,102,241,.15)] text-[#818CF8] font-semibold' : 'text-[#94A3B8]'}`}>{item}</div>
                ))}
              </div>
              <div>
                <div className="grid grid-cols-3 gap-[10px] mb-[10px]">
                  {[{l:'Revenue',v:'—',c:'#10B981'}, {l:'Expenses',v:'—',c:'#EF4444'}, {l:'Net profit',v:'—',c:'#10B981'}].map(m => (
                    <div key={m.l} className="bg-[#0B1120] rounded-[10px] p-[14px_15px]">
                      <div className="text-[9.5px] text-[#94A3B8] mb-[5px] font-jakarta">{m.l}</div>
                      <div className="text-[17px] font-bold text-[#F8FAFC] font-jakarta">{m.v}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-[#0B1120] rounded-[10px] p-[14px_15px]">
                  <div className="text-[9.5px] text-[#94A3B8] mb-2 font-jakarta">Revenue trend</div>
                  <svg width="100%" height="52" viewBox="0 0 300 52" preserveAspectRatio="none">
                    <defs><linearGradient id="mini-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366F1" stopOpacity=".25" /><stop offset="100%" stopColor="#6366F1" stopOpacity="0" /></linearGradient></defs>
                    <path d="M0,42 L27,36 L55,40 L82,28 L109,32 L136,22 L163,26 L191,14 L218,18 L245,8 L272,10 L300,4 L300,52 L0,52 Z" fill="url(#mini-grad)" />
                    <path d="M0,42 L27,36 L55,40 L82,28 L109,32 L136,22 L163,26 L191,14 L218,18 L245,8 L272,10 L300,4" stroke="#6366F1" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-9 left-[20%] right-[20%] h-[72px] pointer-events-none" style={{ background: 'radial-gradient(ellipse,rgba(99,102,241,.2) 0%,transparent 70%)' }} />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-y border-[rgba(255,255,255,0.07)] px-[6%]">
        {[
          { t: 'Automated Workflows', d: 'End-to-end process chains across every module' },
          { t: 'Zero Data Entry', d: 'Everything syncs without manual re-keying' },
          { t: 'Role-Based Access', d: 'Granular RBAC for every team and branch' },
          { t: '3-Way Matching', d: 'PO, receipt, and invoice auto-reconciliation' },
        ].map((s, i) => (
          <div key={i} className="text-center py-8 px-4 border-r border-[rgba(255,255,255,0.07)] last:border-r-0">
            <div className="font-jakarta text-[15px] font-bold text-[#818CF8] mb-[6px]">{s.t}</div>
            <div className="text-[12.5px] text-[#94A3B8] leading-[1.55]">{s.d}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section className="py-24 px-[6%]">
        <div className="text-[11.5px] font-semibold tracking-[.1em] text-[#818CF8] mb-[14px] text-center">MODULES</div>
        <h2 className="font-jakarta text-[clamp(28px,3.8vw,44px)] font-extrabold tracking-[-.02em] text-[#F8FAFC] leading-[1.2] text-center mb-[60px]">Every part of your business,<br />connected and automated</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-[1100px] mx-auto">
          {[
            { title: 'Finance', desc: 'Invoice to payment in one automated chain. Expenses, bills, budgets, and GL — no manual posting.', color: '#6366F1' },
            { title: 'CRM', desc: 'Contacts to closed deals. When a deal is won, invoices, projects, and pick orders fire automatically.', color: '#F59E0B' },
            { title: 'HR & Payroll', desc: 'Hire an employee and payroll, cost center, and RBAC role are all set up. Every month, it runs itself.', color: '#10B981' },
            { title: 'Inventory', desc: 'Every sale posts COGS to your GL. Every low-stock item drafts a PO. Your balance sheet stays current.', color: '#818CF8' },
            { title: 'Smart Approvals', desc: 'Threshold-aware, role-routed, and mobile-ready. Expenses escalate automatically. Nothing gets stuck.', color: '#F59E0B' },
            { title: 'Live Reports', desc: 'P&L, balance sheet, cash flow — updated on every transaction. No waiting for month-end.', color: '#10B981' },
          ].map((f) => (
            <div key={f.title} className="bg-[#1A2438] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-7 transition-all duration-300 hover:-translate-y-1 cursor-default group" style={{ ['--hover-color' as any]: `rgba(${f.color === '#6366F1' ? '99,102,241' : f.color === '#F59E0B' ? '245,158,11' : f.color === '#10B981' ? '16,185,129' : '129,140,248'},.25)` }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = `rgba(${f.color === '#6366F1' ? '99,102,241' : f.color === '#F59E0B' ? '245,158,11' : f.color === '#10B981' ? '16,185,129' : '129,140,248'},.3)`)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
              <div className="w-11 h-11 rounded-[10px] mb-[18px] flex items-center justify-center" style={{ background: `${f.color}22` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
              </div>
              <div className="font-jakarta text-[15.5px] font-bold text-[#F8FAFC] mb-[9px]">{f.title}</div>
              <div className="text-[13.5px] text-[#94A3B8] leading-[1.65]">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-[6%] bg-[rgba(255,255,255,.015)] border-t border-[rgba(255,255,255,0.07)]">
        <div className="max-w-[760px] mx-auto text-center">
          <div className="text-[11.5px] font-semibold tracking-[.1em] text-[#F59E0B] mb-[14px]">THE PRINCIPLE</div>
          <h2 className="font-jakarta text-[clamp(26px,3.5vw,40px)] font-extrabold text-[#F8FAFC] mb-[18px] tracking-[-.02em]">Every action is a trigger,<br />not a dead end.</h2>
          <p className="text-[15px] text-[#94A3B8] leading-[1.7] mb-12">Most SME software forces you to be your own accountant, approver, and analyst. Syspro's automation layer removes that burden. The system runs the routine. You only touch the exceptions.</p>
          {[
            { num: '01', title: 'Deal won in CRM', desc: 'Invoice drafts, project creates, inventory reserves — simultaneously, without anyone clicking anything.' },
            { num: '02', title: 'Expense submitted', desc: 'RBAC routes it to the right approver. Amount threshold determines the escalation path automatically.' },
            { num: '03', title: 'Approval granted', desc: 'Bill generates. Payment queues. Budget actuals post. GL records. Reports refresh. All at once.' },
          ].map((s) => (
            <div key={s.num} className="flex gap-[22px] text-left mb-4 bg-[#1A2438] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-[22px_26px] items-start transition-colors hover:border-[rgba(99,102,241,.3)]">
              <div className="font-jakarta text-xs font-extrabold text-[#6366F1] min-w-[28px] opacity-55 pt-[2px]">{s.num}</div>
              <div>
                <div className="font-jakarta text-[15.5px] font-bold text-[#F8FAFC] mb-[5px]">{s.title}</div>
                <div className="text-[13.5px] text-[#94A3B8] leading-[1.6]">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-[6%] text-center">
        <div className="max-w-[580px] mx-auto rounded-[20px] p-[56px_40px]" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(245,158,11,.06))', border: '1px solid rgba(99,102,241,.25)' }}>
          <h2 className="font-jakarta text-[clamp(26px,3.5vw,38px)] font-extrabold text-[#F8FAFC] mb-[14px] tracking-[-.02em]">Ready to stop doing<br />everything manually?</h2>
          <p className="text-[15px] text-[#94A3B8] mb-[34px] leading-[1.6]">Start a free tenant. Set up your team in 10 minutes. Let Syspro do the rest.</p>
          <Link href="/login" className="inline-flex items-center gap-2 px-7 py-[13px] rounded-[10px] text-white font-jakarta text-sm font-bold transition-transform hover:-translate-y-[2px]" style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)', boxShadow: '0 6px 20px rgba(99,102,241,.4)' }}>
            Get started free
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12,5 19,12 12,19" /></svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[rgba(255,255,255,0.07)] py-[26px] px-[6%] flex justify-between items-center flex-wrap gap-[14px]">
        <div className="flex items-center gap-[9px]">
          <SysproLogo size={26} />
          <span className="font-jakarta text-[15px] font-extrabold" style={{ background: 'linear-gradient(90deg,#F8FAFC,#94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Syspro</span>
        </div>
        <span className="text-xs text-[#64748B]">© 2026 Syspro. Built for SMEs.</span>
        <div className="flex gap-[22px]">
          <span className="text-xs text-[#64748B] cursor-pointer hover:text-[#94A3B8] transition-colors">Privacy</span>
          <span className="text-xs text-[#64748B] cursor-pointer hover:text-[#94A3B8] transition-colors">Terms</span>
          <span className="text-xs text-[#64748B] cursor-pointer hover:text-[#94A3B8] transition-colors">Support</span>
        </div>
      </footer>
    </div>
  );
}


