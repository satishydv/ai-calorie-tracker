import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Server-only. Never import this from a screen or component — Metro would
// bundle the driver into the app.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export const db = drizzle({ client: neon(url), schema, casing: "snake_case" });

export * from "./schema";
