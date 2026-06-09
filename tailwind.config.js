export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "Arial", "sans-serif"],
      },
      colors: {
        ink: "#171310",
        cream: "#f8f0e9",
        sidebar: "#fdfaf7",
        linen: "#ead9ca",
        border: "#dccabd",
        clay: "#ad6a3e",
        moss: "#526344",
        success: "#4e8064",
        warning: "#b16e38",
        danger: "#b75d59",
        info: "#55758d",
        card: "#FFFFFF",
        muted: "#76665c",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(55, 37, 25, 0.16)",
      },
    },
  },
  plugins: [],
};
