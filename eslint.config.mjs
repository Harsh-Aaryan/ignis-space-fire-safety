import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/components/three/**/*.tsx"],
    // R3F updates Three.js objects, uniforms and textures imperatively in effects
    // and useFrame. React state and props remain subject to the other hook rules.
    // https://r3f.docs.pmnd.rs/advanced/pitfalls#avoid-setstate-in-loops
    rules: { "react-hooks/immutability": "off" },
  },
  {
    files: ["scripts/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".qa-baseline/**",
    ".npm-cache/**",
    "test-results/**",
    "playwright-report/**",
    // Bundled third-party Draco decoder, not application source.
    "public/draco/**",
  ]),
]);

export default eslintConfig;
