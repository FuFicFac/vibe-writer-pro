/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'seahawks-navy': 'rgb(var(--seahawks-navy) / <alpha-value>)',
        'seahawks-green': 'rgb(var(--seahawks-green) / <alpha-value>)',
        'seahawks-gray': 'rgb(var(--seahawks-gray) / <alpha-value>)',
      }
    },
  },
  plugins: [],
}
