import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3100",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev -- --port 3100",
    env: {
      ...process.env,
      APP_RUNTIME_MODE: "memory",
      FILE_STORAGE_MODE: "mock",
      RESUME_ANALYSIS_MODE: "mock",
    },
    port: 3100,
    reuseExistingServer: false,
  },
});
