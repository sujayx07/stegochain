module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F8F7F5",
        surface: "#FFFFFF",
        border: "#E7E5E4",
        accent: "#F97316",
        "accent-hover": "#EA6C0A",
        "accent-light": "#FFF0E6",
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
        "text-primary": "#1C1917",
        "text-secondary": "#78716C"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        orange: "0 4px 14px rgba(249,115,22,0.25)"
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px"
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "pulse-orange": "pulseOrange 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite"
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideDown: { from: { opacity: 0, transform: "translateY(-8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulseOrange: { "0%,100%": { boxShadow: "0 0 0 0 rgba(249,115,22,0.3)" }, "50%": { boxShadow: "0 0 0 8px rgba(249,115,22,0)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } }
      }
    }
  },
  plugins: []
};
