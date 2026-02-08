/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ebony: {
          950: '#121212',
          900: '#202024',
          800: '#29292e',
          700: '#323238',
        },
        brand: {
          red: '#850000',
          hover: '#600000'
        },
        ice: {
          200: '#e1e1e6',
          400: '#a8a8b3',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 15px rgba(133, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}