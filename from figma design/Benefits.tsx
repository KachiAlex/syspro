import { ImageWithFallback } from './figma/ImageWithFallback';
import { Check } from 'lucide-react';

const benefits = [
  'Real-time data synchronization across all modules',
  'Customizable dashboards and reports',
  'Mobile-first responsive design',
  'Advanced security and compliance features',
  'Seamless third-party integrations',
  'AI-powered insights and analytics'
];

export function Benefits() {
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
