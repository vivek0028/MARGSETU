/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        railway: {
          dark: "#0B192C",      // Deep Navy Primary
          navy: "#1E3E62",      // Railway Blue Accent
          blue: "#0056B3",      // IR Blue Primary Action
          light: "#F0F4F8",     // Soft Railway Grey Canvas
          border: "#D1D5DB",    // Clean border
          feasible: "#0D824D",  // Green Approved
          warning: "#D97706",   // Amber Alert
          conflict: "#DC2626",  // Red Collision
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Monaco", "monospace"]
      }
    },
  },
  plugins: [],
}
