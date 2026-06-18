/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto'],
        jakarta: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto'],
      },
      colors: {
        accent: {
          DEFAULT: '#6366F1',
          600: '#4F46E5',
        },
        navy: {
          DEFAULT: '#0B1120',
          2: '#111827',
          3: '#1E2A3B',
        },
        indigo: {
          DEFAULT: '#6366F1',
          2: '#4F46E5',
          3: '#818CF8',
        },
        amber: {
          DEFAULT: '#F59E0B',
          2: '#FCD34D',
        },
        card: '#1A2438',
        slate: {
          DEFAULT: '#94A3B8',
          2: '#64748B',
        },
      },
      container: {
        center: true,
        padding: '1rem',
      },
    },
  },
  plugins: [],
};
