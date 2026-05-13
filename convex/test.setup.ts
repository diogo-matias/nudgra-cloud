/// <reference types="vite/client" />

process.env.NUDGRA_ALLOWED_EMAILS ??= "operator@example.com,test@example.com";

export const modules = import.meta.glob([
  "./**/*.ts",
  "!./test.setup.ts",
]);
