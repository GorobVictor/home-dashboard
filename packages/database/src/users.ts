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
