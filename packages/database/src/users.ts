import { getDatabase } from "./client";

const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  login: true,
  createdAt: true,
} as const;

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  login: string;
  createdAt: Date;
}

export interface UserCredentials extends PublicUser {
  passwordHash: string;
}

export interface NewUser {
  firstName: string;
  lastName: string;
  login: string;
  passwordHash: string;
}

export interface UserRepository {
  findByLogin(login: string): Promise<UserCredentials | null>;
  findById(id: string): Promise<PublicUser | null>;
}

export async function createUser(user: NewUser): Promise<PublicUser> {
  return getDatabase().user.create({
    data: user,
    select: publicUserSelect,
  });
}

export async function hasUsers(): Promise<boolean> {
  return Boolean(await getDatabase().user.findFirst({ select: { id: true } }));
}

export async function createInitialUser(user: NewUser): Promise<PublicUser | null> {
  return getDatabase().$transaction(async (tx) => {
    // Serialize competing first-start setup runs; never create a second default user.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('home_dashboard_initial_user', 0))`;
    if (await tx.user.findFirst({ select: { id: true } })) return null;
    return tx.user.create({ data: user, select: publicUserSelect });
  });
}

export const userRepository: UserRepository = {
  async findByLogin(login) {
    return getDatabase().user.findUnique({
      where: { login },
      select: { ...publicUserSelect, passwordHash: true },
    });
  },
  async findById(id) {
    return getDatabase().user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  },
};
