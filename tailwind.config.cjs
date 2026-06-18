/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
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
        /* Semantic theme tokens */
        theme: {
          bg: 'var(--background)',
          fg: 'var(--foreground)',
          surface: 'var(--color-surface)',
          muted: 'var(--color-muted)',
          elevated: 'var(--color-elevated)',
          border: 'var(--color-border)',
          'border-hover': 'var(--color-border-hover)',
          primary: 'var(--color-primary)',
          'primary-fg': 'var(--color-primary-foreground)',
          accent: 'var(--color-accent)',
          'accent-hover': 'var(--color-accent-hover)',
          'accent-subtle': 'var(--color-accent-subtle)',
          success: 'var(--color-success)',
          'success-bg': 'var(--color-success-bg)',
          warning: 'var(--color-warning)',
          'warning-bg': 'var(--color-warning-bg)',
          danger: 'var(--color-danger)',
          'danger-bg': 'var(--color-danger-bg)',
          'text-primary': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-tertiary': 'var(--text-tertiary)',
          'text-inverse': 'var(--text-inverse)',
          'sidebar-bg': 'var(--sidebar-bg)',
          'sidebar-border': 'var(--sidebar-border)',
          'sidebar-text': 'var(--sidebar-text)',
          'sidebar-text-active': 'var(--sidebar-text-active)',
          'sidebar-hover': 'var(--sidebar-hover)',
          'input-bg': 'var(--input-bg)',
          'input-border': 'var(--input-border)',
          'input-placeholder': 'var(--input-placeholder)',
          overlay: 'var(--overlay)',
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
