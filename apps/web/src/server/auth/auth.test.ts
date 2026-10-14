import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { UserRepository } from "@home-dashboard/database";
import { hashPassword, verifyPassword } from "./password";
import { AuthError, createAuthService, prepareUser } from "./service";
import { createSessionToken, readSessionToken } from "./tokens";

const previousSecret = process.env.AUTH_JWT_SECRET;
before(() => {
  process.env.AUTH_JWT_SECRET = "test-secret-with-at-least-thirty-two-bytes";
});
after(() => {
  if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = previousSecret;
});

test("passwords are salted and invalid passwords are rejected", async () => {
  const first = await hashPassword("a-long-test-password");
  const second = await hashPassword("a-long-test-password");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("a-long-test-password", first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword("a-long-test-password", "invalid"), false);
});

test("administrator user preparation validates and hashes input", async () => {
  const user = await prepareUser({
    firstName: "  Ada  ",
    lastName: " Lovelace ",
    login: " Ada.User ",
    password: "secure-password-123",
  });
  assert.equal(user.firstName, "Ada");
  assert.equal(user.lastName, "Lovelace");
  assert.equal(user.login, "ada.user");
  assert.equal(await verifyPassword("secure-password-123", user.passwordHash), true);
  await assert.rejects(
    prepareUser({ firstName: "Ada", lastName: "Lovelace", login: "ada", password: "short" }),
    (error: unknown) => error instanceof AuthError && error.code === "invalid_input",
  );
});

test("login returns public user data only after password verification", async () => {
  const passwordHash = await hashPassword("secure-password-123");
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const createdAt = new Date("2026-10-14T00:00:00.000Z");
  const repository: UserRepository = {
    async findByLogin(login) {
      return login === "ada" ? { id, firstName: "Ada", lastName: "Lovelace", login, createdAt, passwordHash } : null;
    },
    async findById() {
      return null;
    },
  };
  const service = createAuthService(repository);
  const user = await service.login({ login: " ADA ", password: "secure-password-123" });
  assert.deepEqual(user, { id, firstName: "Ada", lastName: "Lovelace", login: "ada", createdAt });
  assert.equal("passwordHash" in user, false);
  await assert.rejects(
    service.login({ login: "ada", password: "incorrect" }),
    (error: unknown) => error instanceof AuthError && error.code === "invalid_credentials",
  );
  await assert.rejects(
    service.login({ login: "missing", password: "incorrect" }),
    (error: unknown) => error instanceof AuthError && error.code === "invalid_credentials",
  );
});

test("JWT sessions reject modified tokens", async () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const token = await createSessionToken(id);
  assert.equal(await readSessionToken(token), id);
  const parts = token.split(".");
  parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  assert.equal(await readSessionToken(parts.join(".")), null);
});
