/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fdf8ec',
          100: '#f9ecc8',
          200: '#f2d98e',
          300: '#e8c97a',
          400: '#d4a017',
          500: '#c9a84c',
          600: '#a8893a',
          700: '#7a6328',
          800: '#4d3e18',
          900: '#211a09',
        },
        gold: {
          DEFAULT: '#c9a84c',
          light:   '#e8c97a',
          dark:    '#d4a017',
        },
        surface: {
          DEFAULT: '#111111',
          raised:  '#181818',
          overlay: '#222222',
          border:  '#2a2a2a',
          subtle:  '#333333',
        }
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'glow': '0 0 0 1px rgba(255,255,255,0.08)',
        'glow-md': '0 4px 24px rgba(0,0,0,0.4)',
      }
    }
  },
  plugins: []
};
