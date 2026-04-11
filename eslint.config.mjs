import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "test-results/**",
      "playwright-report/**",
      ".next/**",
      "coverage/**",
    ],
  },
  ...nextVitals,
  ...nextTypescript,
];

export default eslintConfig;
