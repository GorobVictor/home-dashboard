import { chownSync, writeFileSync } from "node:fs";

const password = process.env.POSTGRES_PASSWORD;

if (!password) {
  throw new Error("POSTGRES_PASSWORD is required to create the pgAdmin password file");
}

const escapedPassword = password.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
const path = "/pgpass/pgpass";

writeFileSync(path, `postgres:5432:home_dashboard:home_dashboard:${escapedPassword}\n`, {
  mode: 0o600,
});
chownSync(path, 5050, 5050);
