import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#08111f',
        mist: '#e7edf5',
        sky: '#7dd3fc',
        cyan: '#22d3ee',
        gold: '#f59e0b',
        coral: '#fb7185',
      },
      boxShadow: {
        panel: '0 24px 80px rgba(8,17,31,0.28)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
      },
    },
  },
  plugins: [typography],
}
