/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="executive-dark"]'],
  theme: {
    extend: {
      colors: {
        slep: {
          blue: '#002B49',
          lightBlue: '#006699',
          accent: '#E35205',
          gold: '#C69214',
          bg: '#F4F7F9',
          card: '#FFFFFF',
          border: '#E2E8F0',
          text: '#1E293B',
          muted: '#64748B'
        },
        theme: {
          canvas: 'var(--canvas-bg)',
          card: 'var(--surface-card)',
          cardHover: 'var(--surface-card-hover)',
          elevated: 'var(--surface-elevated)',
          border: 'var(--border-subtle)',
          borderStrong: 'var(--border-strong)',
          textPrimary: 'var(--text-primary)',
          textSecondary: 'var(--text-secondary)',
          textMuted: 'var(--text-muted)',
          primary: 'var(--brand-primary)',
          primaryLight: 'var(--brand-primary-light)',
          accent: 'var(--brand-accent)',
          gold: 'var(--brand-gold)',
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          danger: 'var(--status-danger)',
          pie: 'var(--status-pie)',
          sep: 'var(--status-sep)'
        }
      },
      boxShadow: {
        'glow-primary': '0 0 20px -3px var(--glow-primary)',
        'soft-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'soft-md': '0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 25px -4px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.04)',
        'soft-xl': '0 20px 35px -6px rgba(0, 0, 0, 0.1), 0 8px 16px -4px rgba(0, 0, 0, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2.5s infinite ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.88', transform: 'scale(1.015)' },
        }
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      }
    },
  },
  plugins: [],
}
