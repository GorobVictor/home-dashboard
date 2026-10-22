import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { UserRepository } from "@home-dashboard/database";
import { hashPassword, verifyPassword } from "./password";
import { AuthError, createAuthService, createConfiguredUser, prepareUser } from "./service";
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

const initialUserInput = { firstName: "Ada", lastName: "Lovelace", login: " ADA ", password: "secure-password-123" };
const existingPublicUser = { id: "123e4567-e89b-12d3-a456-426614174000", firstName: "Ada", lastName: "Lovelace", login: "ada", createdAt: new Date("2026-10-14T00:00:00Z") };
const unexpectedCreationOperation = async (): Promise<never> => { throw new Error("unexpected_user_creation_operation"); };
const creationOperations = { hasUsers: unexpectedCreationOperation, findByLogin: unexpectedCreationOperation, createUser: unexpectedCreationOperation, createInitialUser: unexpectedCreationOperation };

test("automatic setup creates the first user with a normalized login and hashed password", async () => {
  const result = await createConfiguredUser(initialUserInput, true, {
    ...creationOperations,
    hasUsers: async () => false,
    createInitialUser: async (user) => {
      assert.equal(user.login, "ada");
      assert.equal(await verifyPassword(initialUserInput.password, user.passwordHash), true);
      assert.notEqual(user.passwordHash, initialUserInput.password);
      return existingPublicUser;
    },
  });
  assert.deepEqual(result, { status: "created", login: "ada" });
});

test("automatic setup skips existing installations even when initial credentials were removed", async () => {
  const result = await createConfiguredUser({}, true, { ...creationOperations, hasUsers: async () => true });
  assert.deepEqual(result, { status: "already_initialized" });
});

test("automatic setup tolerates another setup creating the first user concurrently", async () => {
  const result = await createConfiguredUser(initialUserInput, true, { ...creationOperations, hasUsers: async () => false, createInitialUser: async () => null });
  assert.deepEqual(result, { status: "already_initialized" });
});

test("automatic setup fails on invalid credentials in a fresh installation", async () => {
  await assert.rejects(createConfiguredUser({ ...initialUserInput, password: "short" }, true, { ...creationOperations, hasUsers: async () => false }), (error: unknown) => error instanceof AuthError && error.code === "invalid_input");
});

test("manual setup preserves an existing account and can still create an additional user", async () => {
  assert.deepEqual(await createConfiguredUser(initialUserInput, false, { ...creationOperations, findByLogin: async () => ({ ...existingPublicUser, passwordHash: "stored-hash" }) }), { status: "already_exists", login: "ada" });
  assert.deepEqual(await createConfiguredUser(initialUserInput, false, { ...creationOperations, findByLogin: async () => null, createUser: async () => existingPublicUser }), { status: "created", login: "ada" });
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
