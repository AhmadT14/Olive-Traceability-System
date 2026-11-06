import { defineConfig } from "drizzle-kit";
import { config } from "./src";

export default defineConfig({
  schema: "./src/db/schema.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: config.DATABASE_URL,
  },
});
