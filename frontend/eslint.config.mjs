import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Server pages intentionally translate awaited API failures into tailored state panels.
      "react-hooks/error-boundaries": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "tsconfig.tsbuildinfo"]),
]);

export default eslintConfig;
