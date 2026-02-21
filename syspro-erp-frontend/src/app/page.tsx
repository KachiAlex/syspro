'use client';

import { useState } from 'react';
import { Menu, X, ArrowRight, Play, Check, Star, Clock, BarChart2 } from 'lucide-react';
import {
  Users,
  DollarSign,
  UserCog,
  FolderKanban,
  Zap,
  ShoppingCart,
  Shield,
} from 'lucide-react';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { PillButton } from '@/components/ui/primitives';

function Header() {
  const [open, setOpen] = useState(false);
  const startLoginFlow = () => { if (typeof window !== 'undefined') window.location.href = '/access'; };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm py-3">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <a href="/" aria-label="Syspro home" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="font-semibold text-gray-900 text-lg tracking-tight">Syspro</span>
            </a>
            <nav role="navigation" aria-label="Primary" className="hidden md:flex items-center gap-6 text-sm text-gray-600">
              <a href="#features" className="hover:text-gray-900 px-2 py-1 rounded-md transition-colors">Product</a>
              <a href="#solutions" className="hover:text-gray-900 px-2 py-1 rounded-md transition-colors">Solutions</a>
              <a href="#pricing" className="hover:text-gray-900 px-2 py-1 rounded-md transition-colors">Pricing</a>
              <a href="#resources" className="hover:text-gray-900 px-2 py-1 rounded-md transition-colors">Resources</a>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={startLoginFlow} className="text-sm text-gray-700 hover:text-gray-900">Sign in</button>
            <PillButton variant="primary" className="px-4 py-2 shadow-md">Request demo</PillButton>
          </div>

          <button className="md:hidden text-gray-700" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open} aria-controls="mobile-menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <div id="mobile-menu" role="menu" aria-label="Mobile primary menu" className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-3">
              <a role="menuitem" href="#features" className="px-2 py-2 rounded hover:bg-gray-50">Product</a>
              <a role="menuitem" href="#solutions" className="px-2 py-2 rounded hover:bg-gray-50">Solutions</a>
              <a role="menuitem" href="#pricing" className="px-2 py-2 rounded hover:bg-gray-50">Pricing</a>
              <a role="menuitem" href="#resources" className="px-2 py-2 rounded hover:bg-gray-50">Resources</a>
              <div className="pt-2 border-t border-gray-100 flex gap-2">
                <button onClick={startLoginFlow} className="flex-1 text-left px-3 py-2">Sign in</button>
                <PillButton variant="primary" className="flex-1">Request demo</PillButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-20 bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-4">
              <Clock size={14} /> 30‑day free trial — no credit card
            </span>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-gray-900 leading-tight mb-6 hero-title">
              Unify Your Business Operations with <span className="text-blue-600">Syspro</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-xl">
              Syspro combines CRM, Finance, HR and Projects into a single, modern ERP — built for speed, security and real-world scale. Launch faster, reduce manual work and make better decisions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <PillButton variant="primary" className="inline-flex items-center gap-3 px-5 py-3 shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
                Start free trial
                <ArrowRight size={18} />
              </PillButton>
              <button className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">
                <Play size={16} /> Watch walkthrough
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2"><span className="font-semibold text-gray-800">10k+</span><span>businesses</span></div>
              <div className="flex items-center gap-2"><span className="font-semibold text-gray-800">99.9%</span><span>uptime</span></div>
              <div className="flex items-center gap-2"><span className="font-semibold text-gray-800">24/7</span><span>support</span></div>
            </div>

            <div className="mt-8">
              <h4 className="text-sm text-gray-500 mb-3">Popular modules</h4>
              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1 rounded-full bg-gray-100 text-sm">CRM</span>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-sm">Finance</span>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-sm">HR</span>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-sm">Projects</span>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-sm">Automation</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="rounded-2xl shadow-2xl bg-gradient-to-br from-white to-slate-50 border border-gray-100 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-gray-500">Overview</div>
                    <div className="text-xl font-semibold text-gray-900">Company dashboard</div>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2"><BarChart2 size={16}/> Real-time</div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-xs text-gray-400">MRR</div>
                    <div className="text-lg font-bold">$120.4k</div>
                    <div className="text-xs text-emerald-600 mt-1">+6.1% MoM</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-xs text-gray-400">Receivables</div>
                    <div className="text-lg font-bold">$38.2k</div>
                    <div className="text-xs text-red-500 mt-1">-2.2% YoY</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-xs text-gray-400">Open tickets</div>
                    <div className="text-lg font-bold">18</div>
                    <div className="text-xs text-gray-500 mt-1">Priority support</div>
                  </div>
                </div>

                <div className="h-36 bg-gradient-to-r from-indigo-500 to-sky-400 rounded-lg text-white p-4 flex items-end">
                  <div className="w-full">
                    <div className="w-full h-20 flex items-end gap-1">
                      <div className="h-2/3 w-2 bg-white/70 rounded" />
                      <div className="h-1/2 w-2 bg-white/60 rounded" />
                      <div className="h-full w-2 bg-white rounded" />
                      <div className="h-3/4 w-2 bg-white/80 rounded" />
                      <div className="h-1/3 w-2 bg-white/50 rounded" />
                      <div className="h-5/6 w-2 bg-white/90 rounded" />
                      <div className="h-3/4 w-2 bg-white/70 rounded" />
                    </div>
                    <div className="text-xs mt-3 opacity-90">Revenue trend — last 30 days</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-4 border border-gray-100 hidden lg:block">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded flex items-center justify-center">📈</div>
                <div>
                  <div className="text-xs text-gray-500">Saved time</div>
                  <div className="font-semibold">Avg. 36% reduction</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: '10,000+', label: 'Active businesses', icon: '🏢' },
    { value: '99.9%', label: 'Uptime SLA', icon: '⚡' },
    { value: '150+', label: 'Countries', icon: '🌍' },
    { value: '24/7', label: 'Support', icon: '💬' },
  ];
  // Render a full-width blue stats band similar to the provided design screenshots
  return (
    <section className="pro-stats-band py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center text-center text-white">
          {stats.map((s, i) => (
            <div key={i} className="py-6">
              <div className="text-3xl md:text-4xl font-extrabold">{s.value}</div>
              <div className="text-sm opacity-90 mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Features Section
function Features() {
  const features = [
    {
      icon: Users,
      title: 'CRM',
      description: 'Manage customer relationships, track leads, and close deals faster with our intelligent CRM system.',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: DollarSign,
      title: 'Finance & Accounting',
      description: 'Complete financial management with automated invoicing, expense tracking, and real-time reporting.',
      color: 'from-green-500 to-green-600'
    },
    {
      icon: UserCog,
      title: 'HR & Operations',
      description: 'Streamline employee management, payroll, attendance, and performance tracking in one place.',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: FolderKanban,
      title: 'Project Management',
      description: 'Plan, execute, and monitor projects with powerful tools for task management and collaboration.',
      color: 'from-orange-500 to-orange-600'
    },
    {
      icon: Zap,
      title: 'Automation',
      description: 'Automate repetitive tasks and workflows to save time and reduce human error across your operations.',
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      icon: ShoppingCart,
      title: 'Sales & Procurement',
      description: 'Optimize your supply chain with integrated sales orders, purchase orders, and inventory management.',
      color: 'from-pink-500 to-pink-600'
    },
    {
      icon: Shield,
      title: 'Admin Controls',
      description: 'Enterprise-grade security with role-based access, audit trails, and comprehensive system controls.',
      color: 'from-indigo-500 to-indigo-600'
    }
  ];

  return (
    <section id="features" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything Your Business Needs
          </h2>
          <p className="text-lg text-gray-600">
            Syspro brings together all essential business functions into one powerful, integrated platform
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="group p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 bg-white"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Benefits Section
function Benefits() {
  const benefits = [
    'Real-time data synchronization across all modules',
    'Customizable dashboards and reports',
    'Mobile-first responsive design',
    'Advanced security and compliance features',
    'Seamless third-party integrations',
    'AI-powered insights and analytics'
  ];

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Image */}
          <div className="order-2 lg:order-1">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <ImageWithFallback 
                src="https://images.unsplash.com/photo-1590650589327-3f67c43ad8a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHRlYW0lMjBvZmZpY2UlMjBjb2xsYWJvcmF0aW9ufGVufDF8fHx8MTc3MDQ2Mzg0M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Team collaboration" 
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Right Content */}
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Why Businesses Choose Syspro
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Built for scale, designed for simplicity. Syspro adapts to your business needs 
              while providing enterprise-grade reliability and performance.
            </p>

            <div className="space-y-4 mb-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                    <Check className="text-blue-600" size={16} />
                  </div>
                  <span className="text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>

            <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl">
              Explore All Features
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// Testimonials Section
function Testimonials() {
  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'CEO, TechCorp Solutions',
      content: 'Syspro has transformed how we manage our operations. The integration between modules is seamless and has saved us countless hours.',
      rating: 5,
      avatar: '👩‍💼'
    },
    {
      name: 'Michael Chen',
      role: 'CFO, Global Industries',
      content: 'The finance and accounting module is incredibly powerful. Real-time reporting has given us the insights we need to make better decisions.',
      rating: 5,
      avatar: '👨‍💼'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Operations Director, LogiTech',
      content: 'Implementation was smooth and the support team is outstanding. Syspro has become the backbone of our business operations.',
      rating: 5,
      avatar: '👩‍💻'
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Industry Leaders
          </h2>
          <p className="text-lg text-gray-600">
            See what our customers have to say about their experience with Syspro
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="text-yellow-400 fill-yellow-400" size={20} />
                ))}
              </div>

              {/* Content */}
              <p className="text-gray-700 mb-6 italic">
                &ldquo;{testimonial.content}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTA() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '48px 48px'
        }} />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to Transform Your Business?
            </h2>
            <p className="text-lg text-blue-100 mb-8">
              Join thousands of businesses already using Syspro to streamline operations and drive growth. 
              Start your free 30-day trial today—no credit card required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <button className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl font-semibold">
                Start Free Trial
                <ArrowRight size={20} />
              </button>
              <button className="border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white/10 transition-all">
                Schedule a Demo
              </button>
            </div>

            <div className="flex items-center gap-4 text-blue-100 text-sm">
              <span>✓ Free 30-day trial</span>
              <span>✓ No credit card</span>
              <span>✓ Cancel anytime</span>
            </div>
          </div>

          {/* Right Image */}
          <div className="hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <ImageWithFallback 
                src="https://images.unsplash.com/photo-1642522029691-029b5a432954?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBjb3Jwb3JhdGUlMjBtZWV0aW5nfGVufDF8fHx8MTc3MDQ2Mzg0NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Business meeting" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Footer Component
function Footer() {
  const footerLinks = {
    product: [
      { label: 'Features', href: '#' },
      { label: 'Pricing', href: '#' },
      { label: 'Security', href: '#' },
      { label: 'Integrations', href: '#' },
      { label: 'Updates', href: '#' }
    ],
    company: [
      { label: 'About Us', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Press Kit', href: '#' },
      { label: 'Partners', href: '#' }
    ],
    resources: [
      { label: 'Documentation', href: '#' },
      { label: 'Help Center', href: '#' },
      { label: 'Community', href: '#' },
      { label: 'Webinars', href: '#' },
      { label: 'Case Studies', href: '#' }
    ],
    legal: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Cookie Policy', href: '#' },
      { label: 'GDPR', href: '#' },
      { label: 'Compliance', href: '#' }
    ]
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold text-white">Syspro</span>
            </div>
            <p className="text-gray-400 mb-6">
              The all-in-one B2B ERP solution that empowers businesses to streamline operations and drive growth.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span>📧</span>
                <span>contact@syspro.com</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>📞</span>
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>📍</span>
                <span>San Francisco, CA</span>
              </div>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="hover:text-blue-400 transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="hover:text-blue-400 transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="hover:text-blue-400 transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="hover:text-blue-400 transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-400">
              © 2024 Syspro. All rights reserved.
            </p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">Twitter</a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">LinkedIn</a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Export
export default function Home() {
  return (
    <>
      <Header />
      <main id="main-content">
        <Hero />
        <Stats />
        <Features />
        <Benefits />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
