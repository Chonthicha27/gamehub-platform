/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:"#ebfff7",100:"#c9ffe8",200:"#92ffd2",300:"#5cfbb8",400:"#2deaa0",
          500:"#12d18a",600:"#0fab73",700:"#11865e",800:"#0f684b",900:"#0b4a36",
        },
      },
      boxShadow: { soft: "0 8px 30px rgba(0,0,0,.25)" },
    },
  },
  plugins: [],
};
