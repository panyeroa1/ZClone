import type { Config } from 'tailwindcss';

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-roboto)", "system-ui", "sans-serif"],
      },
      colors: {
        dark: {
          1: '#131519', // Main background
          2: '#1C2025', // Secondary background (cards/panels)
          3: '#2b303b', // Inputs/Hover states
          4: '#363B44', // Borders/Separators
        },
        blue: {
          1: '#1776F2', // Jitsi Blue
        },
        sky: {
          1: '#C3D9F6',
          2: '#E0EBFF',
          3: '#F5F9FF',
        },
        orange: {
          1: '#FF9500',
        },
        purple: {
          1: '#8338EC',
        },
        yellow: {
          1: '#FFCC00',
        },
      },
      boxShadow: {
        orbit: '0 30px 80px -60px rgba(47, 128, 255, 0.8)',
        'orbit-soft': '0 20px 50px -35px rgba(0, 211, 167, 0.6)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      backgroundImage: {
        hero: "url('/images/hero-background.png')",
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
