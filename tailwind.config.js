/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        excel: {
          green: '#107C41',
          lightgreen: '#E8F5E9',
          border: '#D0D5DD',
          header: '#F8F9FA',
          rowHover: '#F4F7FA'
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Consolas', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
}
