export default {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: '#f6f5f1',
        surface: '#ffffff',
        line: '#e4e2dc',
        ink: {
          DEFAULT: '#1c1b18',
          soft: '#55534c',
          faint: '#8c8a83',
        },
        brand: {
          50: '#eefaf6',
          100: '#d3f2e8',
          200: '#a8e4d3',
          300: '#72cfb7',
          400: '#3fb298',
          500: '#1f9680',
          600: '#0d7a6f',
          700: '#0b6159',
          800: '#0c4d48',
          900: '#0b403c',
        },
        success: { soft: '#e6f5ec', DEFAULT: '#1a7f47', ink: '#0f5230' },
        warn: { soft: '#fdf1dd', DEFAULT: '#a76a10', ink: '#734709' },
        danger: { soft: '#fdeceb', DEFAULT: '#b3261e', ink: '#7d1a15' },
        info: { soft: '#eaf0fb', DEFAULT: '#2f5fbe', ink: '#1f3f80' },
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,27,24,0.05)',
        pop: '0 12px 32px -12px rgba(28,27,24,0.28)',
      },
    },
  },
}
