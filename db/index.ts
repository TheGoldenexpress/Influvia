import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { createPostgresBinding } from "./postgres-compat.mjs";

export function getBinding() {
  return createPostgresBinding(
    process.env.INFLUVIA_DATABASE_URL,
    process.env.INFLUVIA_DATABASE_TOKEN,
  );
}

export function getDb() {
  return drizzle(getBinding(), { schema });
}
