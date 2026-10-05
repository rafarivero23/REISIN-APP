import type { Config } from 'tailwindcss';

// Most styling lives in src/app/globals.css as named component classes
// (.card, .btn, .bib…). Tailwind is here for parity with the Optimist
// Vendors app and for one-off utilities.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};

export default config;
