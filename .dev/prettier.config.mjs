import * as tailwindcss from "prettier-plugin-tailwindcss";

/** @type {import("prettier").Config} */
export default {
  useTabs: false,
  tabWidth: 2,
  printWidth: 80,
  singleQuote: false,
  trailingComma: "all",
  semi: true,
  arrowParens: "always",
  plugins: [tailwindcss],
};
