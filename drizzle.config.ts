import { defineConfig } from "drizzle-kit";

process.loadEnvFile(); // Node built-in, no dotenv needed

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case", // must match src/db/index.ts
  dbCredentials: { url: process.env.DATABASE_URL! },
});
