/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './from figma design/**/*.{js,ts,jsx,tsx,html}',
    './syspro-erp-frontend/src/**/*.{js,ts,jsx,tsx,mdx}',
    './**/*.html',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto'],
      },
      colors: {
        accent: {
          DEFAULT: '#2563eb',
          600: '#1d4ed8',
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
