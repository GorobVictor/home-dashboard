import "dotenv/config";
import { disconnectDatabase } from "@home-dashboard/database";
import { AuthError, createConfiguredUser } from "../src/server/auth/service";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required. Run the Compose setup service with the same --env-file as the application, or configure DATABASE_URL for a direct local command.");
    process.exitCode = 1;
    return;
  }
  const result = await createConfiguredUser({
    firstName: process.env.INITIAL_USER_FIRST_NAME,
    lastName: process.env.INITIAL_USER_LAST_NAME,
    login: process.env.INITIAL_USER_LOGIN,
    password: process.env.INITIAL_USER_PASSWORD,
  }, process.argv.includes("--if-empty"));
  if (result.status === "already_initialized") console.info("A user already exists; initial setup skipped.");
  else if (result.status === "already_exists") console.info(`User ${result.login} already exists; password was not changed.`);
  else console.info(`Created user ${result.login}.`);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("Invalid INITIAL_USER_* values. Set non-empty first/last names (up to 100 characters), a valid login (3–50 characters) and a password of 12–128 characters.");
    } else {
      const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^(P\d{4}|[0-9A-Z]{5})$/.test(error.code) ? error.code : "database_error";
      console.error("Could not create user. Check the database connection and applied migrations.", { code });
    }
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void run();
