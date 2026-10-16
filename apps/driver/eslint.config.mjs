import ts from "typescript-eslint";
export default ts.config(...ts.configs.recommended, { ignores: ["node_modules/**", "dist/**", "ios/**", "android/**", ".expo/**"] },
  // Metro loads its configuration as CommonJS, as documented by Expo.
  { files: ["metro.config.js"], rules: { "@typescript-eslint/no-require-imports": "off" } });
