import { type Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    screens: {
      xs: "400px",
      ...defaultTheme.screens,
    },
    extend: {
      colors: {
        background: "#000000",
        foreground: "#ffffff",
        muted: "#1a1a1a",
        accent: "#888888",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      animation: {
        "pulse-slow": "pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-slower": "pulse 12s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow": "ping 3s cubic-bezier(0, 0, 0.2, 1) infinite",
        "ping-slower": "ping 5s cubic-bezier(0, 0, 0.2, 1) infinite",
        float: "float 6s ease-in-out infinite",
        spotlight: "spotlight 2s ease .75s 1 forwards",
        "text-gradient": "text-gradient 8s linear infinite",
        "frame-glow": "frame-glow 2s ease-in-out infinite alternate",
        expand: "expand 0.5s ease-out forwards",
        shrink: "shrink 0.3s ease-in forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "slide-down": "slide-down 0.5s ease-out forwards",
        connecting: "connecting 1.5s ease-in-out infinite",
        "flow-text": "flow-text 8s linear infinite",
        "expand-full":
          "expand-full 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "shrink-back":
          "shrink-back 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "soft-fade-in":
          "soft-fade-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "soft-fade-out":
          "soft-fade-out 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        spotlight: {
          "0%": {
            opacity: "0",
            transform: "scale(0.9)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        "text-gradient": {
          "0%, 100%": {
            "background-size": "200% 200%",
            "background-position": "left center",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "right center",
          },
        },
        "frame-glow": {
          "0%": { boxShadow: "0 0 5px rgba(59, 130, 246, 0.3)" },
          "100%": { boxShadow: "0 0 15px rgba(59, 130, 246, 0.7)" },
        },
        expand: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        shrink: {
          "0%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        connecting: {
          "0%": { backgroundColor: "rgba(59, 130, 246, 0.2)" },
          "50%": { backgroundColor: "rgba(59, 130, 246, 0.5)" },
          "100%": { backgroundColor: "rgba(59, 130, 246, 0.2)" },
        },
        "flow-text": {
          "0%": { backgroundPosition: "0% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "expand-full": {
          "0%": { transform: "scale(1)", zIndex: "30" },
          "100%": { transform: "scale(1.15)", zIndex: "30" },
        },
        "shrink-back": {
          "0%": { transform: "scale(1.15)", zIndex: "30" },
          "100%": { transform: "scale(1)", zIndex: "auto" },
        },
        "soft-fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "soft-fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
