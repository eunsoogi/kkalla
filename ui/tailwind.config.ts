import flowbitePlugin from 'flowbite/plugin';
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/flowbite-react/**/*.{js,ts,jsx,tsx}',
    './node_modules/flowbite/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      boxShadow: {
        md: '0px 2px 4px -1px rgba(175, 182, 201, 0.2)',
        lg: '0 1rem 3rem rgba(0, 0, 0, 0.175)',
        'dark-md': 'rgba(145, 158, 171, 0.3) 0px 0px 2px 0px, rgba(145, 158, 171, 0.02) 0px 12px 24px -4px',
        sm: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
        'btn-shadow': 'box-shadow: rgba(0, 0, 0, .05) 0 9px 17.5px',
        active: '0px 17px 20px -8px rgba(77,91,236,0.231372549)',
      },
      borderRadius: {
        sm: '7px',
        md: '9px',
        lg: '24px',
        tw: '12px',
        page: '20px',
      },
      container: {
        center: true,
        padding: '30px',
      },
      gap: {
        '30': '30px',
      },
      padding: {
        '30': '30px',
      },
      margin: {
        '30': '30px',
      },
    },
  },
  plugins: [flowbitePlugin],
};

export default config;
