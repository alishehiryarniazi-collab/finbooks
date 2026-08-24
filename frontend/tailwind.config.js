/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aurora palette (see CLAUDE.md design library)
        aurora: {
          bg: "#05060a",
          bg2: "#04060d",
          teal: "#12b39a",
          mint: "#5ff0d4",
          violet: "#7b5cff",
          blue: "#0891ff",
        },
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "20px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(95, 240, 212, 0.25)",
      },
    },
  },
  plugins: [],
};
