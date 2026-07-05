/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A3A5C',
          light:   '#2A5080',
          dark:    '#0F2238',
        },
        accent: {
          DEFAULT: '#2563EB',
          light:   '#3B82F6',
          dark:    '#1D4ED8',
        },
        success: {
          DEFAULT: '#059669',
          light:   '#10B981',
        },
        warning: {
          DEFAULT: '#D97706',
          light:   '#F59E0B',
        },
        danger: {
          DEFAULT: '#E11D48',
          light:   '#FB7185',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-in-out',
        'slide-in':   'slideIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn:   { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.6' } },
      },
    },
  },
  plugins: [],
}
