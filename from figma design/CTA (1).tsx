import { ArrowRight } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function CTA() {
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
