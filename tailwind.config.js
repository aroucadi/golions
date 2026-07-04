/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/frontend/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        'ram-red': '#C8102E',
        'morocco-green': '#006233',
        lion: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03'
        }
      }
    },
  },
  plugins: [],
  darkMode: 'class'
}
