'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/* ── PulseCanvas for left panel ── */
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
      points: Array.from({ length: 70 }, () => ({ x: 0, y: 0, vy: 0 })),
      color: ['rgba(99,102,241,', 'rgba(245,158,11,', 'rgba(99,102,241,', 'rgba(16,185,129,', 'rgba(129,140,248,', 'rgba(245,158,11,'][i],
      speed: 0.25 + i * 0.06, offset: i * 16, alpha: 0.08 + i * 0.05,
    }));
    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      w = c.width = c.offsetWidth;
      h = c.height = c.offsetHeight;
      lines.forEach((line) => { line.points = Array.from({ length: 70 }, (_, j) => ({ x: (j / 69) * w, y: h / 2 + (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 0.4 })); });
    }
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      lines.forEach((line) => {
        line.points.forEach((p, j) => {
          p.vy += (Math.random() - 0.5) * 0.04; p.vy *= 0.96;
          p.y += p.vy * line.speed;
          const center = h / 2 + Math.sin(Date.now() * 0.0005 + j * 0.2 + line.offset) * 35;
          p.y += (center - p.y) * 0.004;
          p.y = Math.max(10, Math.min(h - 10, p.y));
        });
        ctx.beginPath(); ctx.moveTo(line.points[0].x, line.points[0].y);
        for (let i = 1; i < line.points.length - 2; i++) {
          const cx = (line.points[i].x + line.points[i + 1].x) / 2;
          const cy = (line.points[i].y + line.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(line.points[i].x, line.points[i].y, cx, cy);
        }
        ctx.strokeStyle = line.color + line.alpha + ')'; ctx.lineWidth = 1.5; ctx.stroke();
      });
      anim = requestAnimationFrame(draw);
    }
    resize(); draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
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

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      // Step 1: Try tenant admin login
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isEmployee) {
          router.push('/employee/dashboard');
        } else {
          router.push('/tenant-admin?tenantSlug=' + data.tenantSlug);
        }
        return;
      }

      // Step 2: If not a tenant admin, try employee login
      if (res.status === 401) {
        // Look up employee tenant slug by email
        const lookupRes = await fetch('/api/employee-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          const tenantSlug = lookupData.tenantSlug;

          // Call the dedicated employee login API
          const empRes = await fetch('/api/hr/employees/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantSlug, email, password }),
          });

          if (empRes.ok) {
            router.push('/employee/dashboard');
            return;
          }
        }
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Invalid credentials. Please check your email and password.');
    } catch (err) {
      setError('Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex">
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex flex-[.48] relative flex-col justify-between p-[56px] overflow-hidden">
        <PulseCanvas />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,.07) 0%, transparent 70%)' }} />

        <div className="relative z-[2]">
          <Link href="/" className="flex items-center gap-[10px]">
            <SysproLogo size={34} />
            <span className="font-jakarta text-[20px] font-extrabold tracking-[-.02em]" style={{ background: 'linear-gradient(90deg,#F8FAFC,#94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Syspro</span>
          </Link>
        </div>

        <div className="relative z-[2] max-w-[360px]">
          <div className="font-jakarta text-[28px] font-extrabold text-[#F8FAFC] leading-[1.3] mb-[14px] tracking-[-.015em]">Your business,<br />running itself.</div>
          <p className="text-[14.5px] text-[#94A3B8] leading-[1.65]">Syspro connects your CRM, Finance, HR, Inventory, and Projects into one living system. Every action triggers the next — automatically.</p>
        </div>

        <div className="relative z-[2] text-[11.5px] text-[#64748B]">© 2026 Syspro</div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-[6%] lg:p-[4%]">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-[10px] lg:hidden mb-[28px]">
            <SysproLogo size={30} />
            <span className="font-jakarta text-[18px] font-extrabold" style={{ background: 'linear-gradient(90deg,#F8FAFC,#94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Syspro</span>
          </div>

          <h1 className="font-jakarta text-[22px] font-extrabold text-[#F8FAFC] mb-[6px] tracking-[-.01em]">Sign in</h1>
          <p className="text-[13.5px] text-[#94A3B8] mb-[28px]">Access your workspace dashboard</p>

          {error && (
            <div className="mb-[14px] p-[10px_14px] rounded-[9px] text-[12.5px] font-medium border" style={{ background: 'rgba(239,68,68,.08)', color: '#EF4444', borderColor: 'rgba(239,68,68,.2)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-[14px]">
            <div>
              <label className="block text-[11.5px] font-semibold text-[#94A3B8] mb-[6px] font-jakarta">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-[14px] py-[10px] text-[13.5px] text-[#F8FAFC] placeholder-[#64748B] outline-none transition-all focus:border-[rgba(99,102,241,.4)] focus:shadow-[0_0_0_3px_rgba(99,102,241,.08)]"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-[#94A3B8] mb-[6px] font-jakarta">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-[14px] py-[10px] pr-[38px] text-[13.5px] text-[#F8FAFC] placeholder-[#64748B] outline-none transition-all focus:border-[rgba(99,102,241,.4)] focus:shadow-[0_0_0_3px_rgba(99,102,241,.08)]"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#94A3B8] transition-colors cursor-pointer">
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-3.72-3.72L3 3"/><circle cx="12" cy="12" r="3"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-[8px] cursor-pointer">
                <input type="checkbox" className="w-[14px] h-[14px] accent-[#6366F1] rounded-[3px] bg-[#111827] border border-[rgba(255,255,255,0.07)] cursor-pointer" />
                <span className="text-[12px] text-[#94A3B8]">Remember me</span>
              </label>
              <Link href="/employee/forgot-password" className="text-[12px] text-[#6366F1] hover:text-[#818CF8] cursor-pointer transition-colors">Forgot password?</Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-[11px] rounded-[10px] text-white font-jakarta text-[13.5px] font-bold cursor-pointer transition-all hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)', boxShadow: '0 4px 14px rgba(99,102,241,.35)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-[20px] pt-[20px] border-t border-[rgba(255,255,255,0.07)] text-center">
            <span className="text-[12.5px] text-[#64748B]">Are you a system administrator? </span>
            <Link href="/superadmin/login" className="text-[12.5px] text-[#6366F1] hover:text-[#818CF8] font-semibold transition-colors">Superadmin login</Link>
          </div>

          <div className="mt-[10px] text-center">
            <span className="text-[12.5px] text-[#64748B]">Don't have an account? </span>
            <Link href="/" className="text-[12.5px] text-[#6366F1] hover:text-[#818CF8] font-semibold transition-colors">Create free workspace</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
