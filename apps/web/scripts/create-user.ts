import "dotenv/config";
import { createUser, disconnectDatabase, userRepository } from "@home-dashboard/database";
import { prepareUser } from "../src/server/auth/service";

async function main(): Promise<void> {
  const user = await prepareUser({
    firstName: process.env.INITIAL_USER_FIRST_NAME,
    lastName: process.env.INITIAL_USER_LAST_NAME,
    login: process.env.INITIAL_USER_LOGIN,
    password: process.env.INITIAL_USER_PASSWORD,
  });

  if (await userRepository.findByLogin(user.login)) {
    console.info(`User ${user.login} already exists; password was not changed.`);
    return;
  }

  const created = await createUser(user);
  console.info(`Created user ${created.login}.`);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error("Could not create user", JSON.stringify(error, null, 2));
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void run();
