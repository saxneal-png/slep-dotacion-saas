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
        // Colores semánticos vía CSS variables — funcionan con TODOS los temas
        brand: {
          primary:      'var(--brand-primary)',
          light:        'var(--brand-primary-light)',
          accent:       'var(--brand-accent)',
          gold:         'var(--brand-gold)',
        },
        canvas:         'var(--canvas-bg)',
        surface: {
          card:         'var(--surface-card)',
          hover:        'var(--surface-card-hover)',
          elevated:     'var(--surface-elevated)',
        },
        border: {
          subtle:       'var(--border-subtle)',
          strong:       'var(--border-strong)',
        },
        content: {
          primary:      'var(--text-primary)',
          secondary:    'var(--text-secondary)',
          muted:        'var(--text-muted)',
        },
        hdr: {
          bg:           'var(--header-bg)',
          text:         'var(--header-text)',
          muted:        'var(--header-muted)',
          border:       'var(--header-border)',
          activeBg:     'var(--nav-active-bg)',
          activeText:   'var(--nav-active-text)',
          idleText:     'var(--nav-idle-text)',
          hoverBg:      'var(--nav-hover-bg)',
        },
        status: {
          success:      'var(--status-success)',
          warning:      'var(--status-warning)',
          danger:       'var(--status-danger)',
          pie:          'var(--status-pie)',
          sep:          'var(--status-sep)',
        },
        // Colores legacy para no romper código existente
        slep: {
          blue:         '#007AFF',
          lightBlue:    '#5AC8FA',
          accent:       '#FF6B35',
          gold:         '#C69214',
          bg:           '#F5F5F7',
          card:         '#FFFFFF',
          border:       '#D2D2D7',
          text:         '#1D1D1F',
          muted:        '#6E6E73',
        },
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
