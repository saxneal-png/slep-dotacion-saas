/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slep: {
          blue: '#002B49',
          lightBlue: '#006699',
          accent: '#E35205',
          gold: '#C69214',
          bg: '#F4F7F9',
          card: '#FFFFFF',
          border: '#E2E8F0',
          text: '#1E293B',
          muted: '#64748B'
        }
      }
    },
  },
  plugins: [],
}
