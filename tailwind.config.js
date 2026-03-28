/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "hsl(213, 94%, 59%)",
        background: "white",
        foreground: "hsl(0, 0%, 8%)",
        muted: "hsl(0, 0%, 98%)",
        "muted-foreground": "hsl(0, 0%, 45%)",
        border: "hsl(0, 0%, 92%)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, hsl(213,94%,59%), hsl(220,90%,50%))",
        "gradient-hero": "linear-gradient(180deg, white, hsl(0,0%,98%))",
      },
      boxShadow: {
        sm: "0 2px 10px rgba(0,0,0,0.03)",
        md: "0 4px 24px rgba(0,0,0,0.05)",
        lg: "0 10px 40px rgba(0,0,0,0.08)",
        xl: "0 20px 60px rgba(0,0,0,0.1)",
        "primary-glow": "0 8px 30px hsla(213,94%,59%,0.3)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'translateX(-150%) skewX(-25deg)' },
          '100%': { transform: 'translateX(250%) skewX(-25deg)' },
        }
      },
      animation: {
        sweep: 'sweep 1s ease-in-out',
      }
    },
  },
  plugins: [],
}
