/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#13131a",
        border: "#1e1e2e",
        accent: "#6366f1",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
        "text-primary": "#e2e8f0",
        "text-secondary": "#94a3b8"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      }
    }
  },
  plugins: []
};
