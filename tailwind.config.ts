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
        sans: ["var(--font-orbit-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-orbit-display)", "system-ui", "sans-serif"],
      },
      colors: {
        orbit: {
          1: '#0B111F',
          2: '#101A2E',
          3: '#17213A',
          4: '#243152',
          5: '#31406B',
        },
        comet: {
          1: '#2F80FF',
          2: '#6BB5FF',
          3: '#A6D4FF',
        },
        aurora: {
          1: '#00D3A7',
          2: '#40F3C8',
        },
        ember: {
          1: '#FFB24A',
          2: '#FFD08A',
        },
        coral: {
          1: '#FF6B7A',
          2: '#FF9AA5',
        },
        mist: {
          1: '#E4ECFF',
          2: '#B4C4E3',
        },
        dark: {
          1: '#0B111F',
          2: '#101A2E',
          3: '#17213A',
          4: '#243152',
        },
        blue: {
          1: '#2F80FF',
        },
        sky: {
          1: '#DCE7FF',
          2: '#EFF4FF',
          3: '#F7FAFF',
        },
        orange: {
          1: '#FFB24A',
        },
        purple: {
          1: '#6B7CFF',
        },
        yellow: {
          1: '#FFD166',
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
