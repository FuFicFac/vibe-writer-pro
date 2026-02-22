/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'seahawks-navy': '#002244',
        'seahawks-green': '#69BE28',
        'seahawks-gray': '#A5ACAF',
      }
    },
  },
  plugins: [],
}
