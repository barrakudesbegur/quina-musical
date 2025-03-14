// @ts-check
import { nextui } from '@nextui-org/react'
import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
    '../node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        brand: ['Londrina solid', ...defaultTheme.fontFamily.sans],
      },
      letterSpacing: {
        ...defaultTheme.letterSpacing,
        'widest-1': defaultTheme.letterSpacing.widest,
        'widest-2': '0.15em',
        'widest-3': '0.2em',
        'widest-4': '0.4em',
      },
      screens: {
        xs: '475px',
        xs2: '375px',
      },
    },
  },
  darkMode: 'class',
  plugins: [nextui()],
  corePlugins: {
    preflight: true,
  },
}
