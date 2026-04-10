import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
