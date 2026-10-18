/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Triadic feedback colors (derived from anchor #4f46e5 in LCH space).
      // Momentum = +120° hue (progress, saving, completion).
      // Attention = +240° hue (current-time line, alerts, destructive).
      momentum: {
        50: '#ffe7b1',
        100: '#ffdba3',
        200: '#ffc78d',
        300: '#f8aa6d',
        400: '#da8c4b',
        500: '#be712d',
        600: '#a55e1e',
        700: '#8b4b0e',
        800: '#763c01',
        900: '#642f00',
        950: '#4e1e00',
      },
      attention: {
        50: '#88fff9',
        100: '#77ffed',
        200: '#55eeda',
        300: '#00d2be',
        400: '#00b5a0',
        500: '#009a87',
        600: '#008472',
        700: '#006e5e',
        800: '#005c4e',
        900: '#004c40',
        950: '#00392e',
      },
      boxShadow: {
        // Soft elevation glows tinted with the anchor hue.
        'glow-sm': '0 1px 2px rgb(79 70 229 / 0.06), 0 0 12px -4px rgb(79 70 229 / 0.18)',
        glow: '0 4px 16px -6px rgb(79 70 229 / 0.25)',
        'glow-lg': '0 12px 40px -12px rgb(79 70 229 / 0.35)',
        'glow-fab': '0 6px 20px -4px rgb(79 70 229 / 0.45)',
      },
    },
    colors: {
      // Slate replaced with a slate ramp blended 4% toward the anchor hue,
      // so every existing slate-* class picks up the tint automatically.
      slate: {
        50: '#f3f2fb',
        100: '#eceef9',
        200: '#dee1f0',
        300: '#c8cfe1',
        400: '#939fba',
        500: '#64728f',
        600: '#48556e',
        700: '#35415a',
        800: '#212a41',
        900: '#121930',
        950: '#090a1e',
      },
      indigo: {
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#5c55ee',
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
        950: '#1e1b4b',
      },
    },
  },
  plugins: [],
};
