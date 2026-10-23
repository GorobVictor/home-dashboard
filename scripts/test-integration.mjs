import pg from "pg";
import { spawnSync } from "node:child_process";

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error("Set TEST_DATABASE_ADMIN_URL to a disposable PostgreSQL server");
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
const suffixes = ["events", "freelancehunt", "marstek", "dashboard", "polling"];
const environments = {};
const databases = [];
try {
  for (const suffix of suffixes) {
    const name = `dashboard_${process.pid}_${suffix}_test`;
    await admin.query(`CREATE DATABASE "${name}"`); databases.push(name);
    const url = new URL(adminUrl); url.pathname = `/${name}`;
    environments[`${suffix.toUpperCase()}_TEST_DATABASE_URL`] = url.href;
    const migration = spawnSync("npm", ["run", "db:migrate"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url.href } });
    if (migration.status !== 0) throw new Error("Test migration failed");
  }
  const tests = spawnSync("npm", ["test"], { stdio: "inherit", env: { ...process.env, ...environments } });
  process.exitCode = tests.status ?? 1;
} finally {
  for (const name of databases) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
