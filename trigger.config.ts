import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_yebuanulzvpzjcrtbbjf", // Cal AI Clone
  dirs: ["./src/trigger"],
  maxDuration: 60, // these tasks are one DB round-trip; anything longer is stuck
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
    },
  },
});
