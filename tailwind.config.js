export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "Arial", "sans-serif"],
      },
      colors: {
        ink: "var(--color-ink)",
        cream: "var(--color-cream)",
        sidebar: "var(--color-sidebar)",
        surface: "var(--color-surface)",
        linen: "var(--color-linen)",
        border: "var(--color-border)",
        clay: "var(--color-clay)",
        moss: "var(--color-moss)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",
        card: "var(--color-card)",
        muted: "var(--color-muted)",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(55, 37, 25, 0.16)",
      },
    },
  },
  plugins: [],
};
