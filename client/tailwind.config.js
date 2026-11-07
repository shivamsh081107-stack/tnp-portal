/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        navy: '#0b1f3a',
        brand: '#2563eb',
        canvas: '#f4f7fb',
      },
    },
  },
  plugins: [],
};
