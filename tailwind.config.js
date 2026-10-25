/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#0F9D8A',
        ink: '#111827',
        muted: '#6B7280',
        line: '#E6E8E8',
        canvas: '#F7F8F8',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16, 24, 40, 0.04)' },
    },
  },
  plugins: [],
};
