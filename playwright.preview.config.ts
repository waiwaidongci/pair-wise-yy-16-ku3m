import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * 对生产构建产物运行同一套端到端测试：
 *   npm run build && npx playwright test --config=playwright.preview.config.ts
 */
export default defineConfig({
  ...base,
  use: {
    ...base.use,
    baseURL: "http://localhost:4173",
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
