import { defineConfig } from "next/experimental/testmode/playwright";

const port = Number(process.env.E2E_PORT ?? 3100);
const database = process.env.E2E_DB ?? "still_e2e";

export const E2E_DB_ENV = { DATABASE_URL: `postgres://localhost:5432/${database}` };

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 390, height: 844 },
    launchOptions: {
      // Tests must never play sound (Ambience) through the machine's speakers.
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--mute-audio"],
    },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } }],
  webServer: [
    // A stand-in for the analysis Worker (SPEC §10.10); the app's jobs call it.
    { command: "npx tsx e2e/support/fake-analysis-worker.ts", port: port + 1, reuseExistingServer: false, env: { FAKE_WORKER_PORT: String(port + 1) } },
    {
    command: "npm run e2e:server",
    port,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...E2E_DB_ENV,
      E2E: "1",
      RUN_WORKERS: "true",
      ANALYSIS_WORKER_URL: `http://localhost:${port + 1}`,
      ANALYSIS_WORKER_SECRET: "e2e-analysis-worker-secret",
      E2E_PORT: String(port),
      STILL_ORIGIN: `http://localhost:${port}`,
      AUTH_GOOGLE_ID: "test-google-web-id",
      AUTH_GOOGLE_SECRET: "test-google-secret",
      GOOGLE_IOS_CLIENT_ID: "test-google-ios-id",
      GOOGLE_ANDROID_CLIENT_ID: "test-google-android-id",
      ANDROID_SHA256_FINGERPRINTS: "AA:11, BB:22 ,,",
      GOOGLE_NATIVE_REDIRECT_URIS: "still:///oauthredirect",
      ACCESS_TOKEN_SECRET: "e2e-access-token-secret-0123456789abcdef",
      TOKEN_ENC_KEYS: `v1:${Buffer.alloc(32, 7).toString("base64")}`,
      KEEPSAKE_TICKET_SECRET: "e2e-keepsake-ticket-secret-0123456789",
      MEDIA_BASE_URL: "https://media.test.invalid",
      R2_DRY_RUN: "1",
      SESSION_REFRESH_GRACE_SECONDS: "1",
      TERMS_VERSION: "t1",
      TERMS_URL: "https://policy.test.invalid/terms",
      PRIVACY_VERSION: "p1",
      PRIVACY_URL: "https://policy.test.invalid/privacy",
      MIN_CLIENT_VERSION: "0.5.0",
      RATE_LIMIT_IP_PER_MIN: "2000",
      RATE_LIMIT_USER_PER_MIN: "300",
      TRUST_PROXY: "1",
    },
    },
  ],
});
