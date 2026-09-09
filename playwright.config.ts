import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
  },
  reporter: "list",
  outputDir: ".tools/test-results",
  webServer: {
    command:
      "node ../node_modules/vite/bin/vite.js --mode emulator --host=127.0.0.1 --port=5174 --strictPort",
    cwd: "client",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
  },
});
