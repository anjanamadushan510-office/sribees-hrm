export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "#FCF9EA",
        surface: "#ffffff",
        sidebar: "#C04000",
        navbar: "#C04000",
        line: "#e5e0cf",
        ink: {
          DEFAULT: "#1c1b18",
          soft: "#55534c",
          faint: "#8c8a83",
        },
        brand: {
          50: "#FFF9EE",
          100: "#FFECCB",
          200: "#FFD796",
          300: "#FFBD61",
          400: "#FFA239",
          500: "#F58D1D",
          600: "#D9720C",
          700: "#B25508",
          800: "#8C3F0C",
          900: "#73320D",
        },
        success: { soft: "#e6f5ec", DEFAULT: "#1a7f47", ink: "#0f5230" },
        warn: { soft: "#fdf1dd", DEFAULT: "#a76a10", ink: "#734709" },
        danger: { soft: "#fdeceb", DEFAULT: "#b3261e", ink: "#7d1a15" },
        info: { soft: "#eaf0fb", DEFAULT: "#2f5fbe", ink: "#1f3f80" },
      },
      borderRadius: {
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,27,24,0.05)",
        pop: "0 12px 32px -12px rgba(28,27,24,0.28)",
      },
    },
  },
};
