import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Rustige, natuurlijke "wandelen & natuur"-palette. Voldoende contrast voor gebruik in fel daglicht.
        moss: {
          50: "#f2f7f1",
          100: "#e0ece0",
          200: "#c1d9c1",
          300: "#98bf98",
          400: "#6b9d6b",
          500: "#4d804e",
          600: "#3a663c",
          700: "#2f5231",
          800: "#294229",
          900: "#233724",
        },
        bark: {
          50: "#f7f5f2",
          100: "#ece6dc",
          700: "#5b4a37",
          800: "#43362a",
          900: "#2c2319",
        },
        trail: {
          paved: "#8d8f96",
          unpaved: "#a9762c",
        },
        alert: {
          DEFAULT: "#b3541e",
          soft: "#fbe9dc",
        },
      },
      fontFamily: {
        // Systeemfont-stack i.p.v. een via het netwerk geladen font (zie layout.tsx).
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
