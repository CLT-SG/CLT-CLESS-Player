import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        signage: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      zIndex: {
        slot: '10',
        overlay: '1000',
      },
    },
  },
  plugins: [],
} satisfies Config
