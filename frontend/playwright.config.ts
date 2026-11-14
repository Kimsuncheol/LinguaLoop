import { defineConfig } from "@playwright/test";

const deployed = process.env.TEST_BASE_URL;
export default defineConfig({
  testDir: "./tests",
  testMatch: "navigation.spec.ts",
  fullyParallel: true,
  use: {
    baseURL: deployed || "http://127.0.0.1:5187",
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  },
  webServer: deployed
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 5187",
        url: "http://127.0.0.1:5187",
        reuseExistingServer: false,
      },
});
