/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ide: {
          bg: 'var(--ide-bg)',
          surface: 'var(--ide-surface)',
          elevated: 'var(--ide-elevated)',
          border: 'var(--ide-border)',
          text: 'var(--ide-text)',
          muted: 'var(--ide-muted)',
          accent: 'var(--ide-accent)',
          'accent-hover': 'var(--ide-accent-hover)',
          danger: 'var(--ide-danger)',
          success: 'var(--ide-success)',
          warning: 'var(--ide-warning)',
          activity: 'var(--ide-activity)',
          sidebar: 'var(--ide-sidebar)',
          panel: 'var(--ide-panel)',
          tab: 'var(--ide-tab)',
          'tab-active': 'var(--ide-tab-active)',
        },
      },
      fontFamily: {
        mono: [
          'Cascadia Code',
          'JetBrains Mono',
          'Fira Code',
          'Consolas',
          'Monaco',
          'monospace',
        ],
        ui: [
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      fontSize: {
        'ide-xs': ['11px', '16px'],
        'ide-sm': ['12px', '18px'],
        'ide-base': ['13px', '20px'],
        'ide-md': ['14px', '22px'],
      },
      spacing: {
        'titlebar': '36px',
        'activity': '44px',
        'status': '24px',
      },
      borderRadius: {
        ide: '4px',
      },
    },
  },
  plugins: [],
};
