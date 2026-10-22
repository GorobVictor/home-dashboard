import type { NewUser, PublicUser, UserRepository } from "@home-dashboard/database";
import { userRepository } from "@home-dashboard/database";
import { hashPassword, verifyPassword } from "./password";

export type AuthErrorCode = "invalid_input" | "invalid_credentials";

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthError("invalid_input");
  }
  return value as Record<string, unknown>;
}

function normalizedLogin(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError("invalid_input");
  }
  const login = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9@._-]{2,49}$/.test(login)) {
    throw new AuthError("invalid_input");
  }
  return login;
}

function personName(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError("invalid_input");
  }
  const name = value.trim();
  if (name.length < 1 || name.length > 100) {
    throw new AuthError("invalid_input");
  }
  return name;
}

export async function prepareUser(input: unknown): Promise<NewUser> {
  const fields = asObject(input);
  const password = fields.password;
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new AuthError("invalid_input");
  }
  return {
    firstName: personName(fields.firstName),
    lastName: personName(fields.lastName),
    login: normalizedLogin(fields.login),
    passwordHash: await hashPassword(password),
  };
}

export function createAuthService(repository: UserRepository = userRepository) {
  return {
    async login(input: unknown): Promise<PublicUser> {
      const fields = asObject(input);
      const login = normalizedLogin(fields.login);
      const password = fields.password;
      if (typeof password !== "string" || password.length > 128) {
        throw new AuthError("invalid_input");
      }

      const user = await repository.findByLogin(login);
      // Spend comparable time on unknown logins without exposing which users exist.
      const passwordMatches = user
        ? await verifyPassword(password, user.passwordHash)
        : await hashPassword(password).then(() => false);
      if (!passwordMatches || !user) {
        throw new AuthError("invalid_credentials");
      }

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        login: user.login,
        createdAt: user.createdAt,
      };
    },
    async findUser(id: string): Promise<PublicUser | null> {
      return repository.findById(id);
    },
  };
}

export const authService = createAuthService();
