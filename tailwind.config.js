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
        linen: "#ead9ca",
        clay: "#ad6a3e",
        moss: "#526344",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(55, 37, 25, 0.16)",
      },
    },
  },
  plugins: [],
};
