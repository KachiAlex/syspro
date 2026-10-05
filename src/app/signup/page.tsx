'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PisairtelLogo } from '@/components/marketing/logo';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function SignupPage() {
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const effectiveSlug = slugTouched ? slug : slugify(companyName);

  const handleCompanyChange = (value: string) => {
    setCompanyName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!companyName || !adminName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (effectiveSlug.length < 2) {
      setError('Workspace URL must be at least 2 characters');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(effectiveSlug)) {
      setError('Workspace URL can only contain lowercase letters, numbers, and hyphens');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          slug: effectiveSlug,
          adminName,
          adminEmail: email,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fieldErrors = data.details ? Object.values(data.details).flat().filter(Boolean).join(' ') : null;
        setError(fieldErrors || data.error || 'Signup failed. Please try again.');
        return;
      }
      window.location.href = '/tenant-admin' + (data.tenantSlug ? '?tenantSlug=' + data.tenantSlug : '');
    } catch {
      setError('Signup failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-[14px] py-[10px] text-[13.5px] text-[#F8FAFC] placeholder-[#64748B] outline-none transition-all focus:border-[rgba(227,30,36,.4)] focus:shadow-[0_0_0_3px_rgba(227,30,36,.08)]";
  const labelClass = "block text-[11.5px] font-semibold text-[#94A3B8] mb-[6px] font-jakarta";

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-[6%]">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="flex items-center gap-[10px] mb-[28px]">
          <PisairtelLogo size={30} />
          <span className="font-jakarta text-[18px] font-extrabold" style={{ background: 'linear-gradient(90deg,#F8FAFC,#94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pisairtel ERP</span>
        </Link>

        <h1 className="font-jakarta text-[22px] font-extrabold text-[#F8FAFC] mb-[6px] tracking-[-.01em]">Create your workspace</h1>
        <p className="text-[13.5px] text-[#94A3B8] mb-[24px]">Free forever for small teams. Set up in minutes.</p>

        {error && (
          <div className="mb-[14px] p-[10px_14px] rounded-[9px] text-[12.5px] font-medium border" style={{ background: 'rgba(239,68,68,.08)', color: '#EF4444', borderColor: 'rgba(239,68,68,.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-[14px]">
          <div>
            <label className={labelClass}>Company name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => handleCompanyChange(e.target.value)}
              required
              className={inputClass}
              placeholder="Acme Trading Ltd"
            />
          </div>
          <div>
            <label className={labelClass}>Workspace URL</label>
            <div className="flex items-center">
              <input
                type="text"
                value={effectiveSlug}
                onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }}
                required
                className={`${inputClass} rounded-r-none`}
                placeholder="acme-trading"
              />
              <span className="bg-[#0B1120] border border-l-0 border-[rgba(255,255,255,0.07)] rounded-r-[10px] px-[12px] py-[10px] text-[12.5px] text-[#64748B] whitespace-nowrap">.pisairtel</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Your name</label>
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
              className={inputClass}
              placeholder="Ada Okafor"
            />
          </div>
          <div>
            <label className={labelClass}>Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={`${inputClass} pr-[38px]`}
                placeholder="At least 8 characters"
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
          <div>
            <label className={labelClass}>Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={inputClass}
              placeholder="Repeat your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-[11px] rounded-[10px] text-white font-jakarta text-[13.5px] font-bold cursor-pointer transition-all hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#E31E24,#C0208A)', boxShadow: '0 4px 14px rgba(227,30,36,.35)' }}
          >
            {loading ? 'Creating workspace…' : 'Create workspace'}
          </button>
        </form>

        <div className="mt-[20px] pt-[20px] border-t border-[rgba(255,255,255,0.07)] text-center">
          <span className="text-[12.5px] text-[#64748B]">Already have a workspace? </span>
          <Link href="/login" className="text-[12.5px] text-[#E31E24] hover:text-[#E8286E] font-semibold transition-colors">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
