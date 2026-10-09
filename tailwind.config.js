/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: Object.fromEntries(
        [
          'background',
          'surface',
          'content',
          'muted',
          'accent',
          'primary',
          'on-primary',
          'line',
          'input',
          'danger',
          'danger-soft',
          'warning',
          'warning-soft',
          'teal',
          'info-soft',
          'success-soft',
          'disabled',
          'hero',
        ].map(name => [name, `rgb(var(--color-${name}) / <alpha-value>)`]),
      ),
    },
  },
  plugins: [],
};
