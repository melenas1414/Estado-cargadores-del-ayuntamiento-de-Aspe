import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{vue,js,ts,jsx,tsx}',
    './components/**/*.{vue,js,ts,jsx,tsx}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './nuxt.config.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta de fondo oscuro principal
        slate: {
          950: '#020617',
        },
        // Verde disponible
        emerald: {
          glow: '0 0 20px rgba(16,185,129,0.4), 0 0 40px rgba(16,185,129,0.2)',
        },
        // Rojo ocupado
        rose: {
          glow: '0 0 20px rgba(244,63,94,0.4), 0 0 40px rgba(244,63,94,0.2)',
        },
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(16,185,129,0.4), 0 0 40px rgba(16,185,129,0.15)',
        'glow-red':   '0 0 20px rgba(244,63,94,0.4),  0 0 40px rgba(244,63,94,0.15)',
        'glow-blue':  '0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
