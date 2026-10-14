import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client";

const globalDatabase = globalThis as typeof globalThis & {
  homeDashboardPrisma?: PrismaClient;
};

export function getDatabase(): PrismaClient {
  if (!globalDatabase.homeDashboardPrisma) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    const adapter = new PrismaPg({
      connectionString,
      connectionTimeoutMillis: 5_000,
    });
    globalDatabase.homeDashboardPrisma = new PrismaClient({ adapter });
  }

  return globalDatabase.homeDashboardPrisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (globalDatabase.homeDashboardPrisma) {
    await globalDatabase.homeDashboardPrisma.$disconnect();
    globalDatabase.homeDashboardPrisma = undefined;
  }
}
