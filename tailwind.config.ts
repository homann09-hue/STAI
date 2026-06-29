import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#050706",
        coal: "#090d0c",
        panel: "#0d1311",
        panel2: "#121b17",
        stroke: "#22332d",
        mist: "#dff5e8",
        muted: "#86a195",
        profit: "#35d07f",
        loss: "#ff5c5c",
        amber: "#f5c96b",
        cyan: "#78e7ff",
        steel: "#7d94ff"
      },
      fontFamily: {
        sans: ["var(--font-display)", "Avenir Next", "Trebuchet MS", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"]
      },
      boxShadow: {
        glow: "0 0 32px rgba(53, 208, 127, 0.18)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.32)"
      }
    }
  },
  plugins: []
};

export default config;
