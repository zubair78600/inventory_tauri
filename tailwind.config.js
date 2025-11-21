/* eslint-env node */
/* eslint-env node */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif']
      },
      colors: {
        primary: {
          DEFAULT: '#0ea5e9',
          foreground: '#0b6b96'
        },
        surface: '#f7fbff',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0f172a'
        },
        muted: {
          DEFAULT: '#f1f5f9',
          foreground: '#64748b'
        },
        accent: '#22d3ee',
        success: '#10b981',
        danger: '#ef4444'
      },
      boxShadow: {
        soft: '0 10px 40px rgba(14,165,233,0.08)'
      }
    },
  },
  plugins: [],
}
