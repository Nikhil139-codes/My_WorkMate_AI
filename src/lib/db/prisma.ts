import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/workmate_ai?schema=public";

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.pool = pool;
  }

  return client;
}

export const prisma = getPrismaClient();

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();
  try {
    // Perform a lightweight query to test connectivity
    await prisma.$queryRaw`SELECT 1 as health`;
    return {
      connected: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error?.message || "Unable to reach PostgreSQL database",
      latencyMs: Date.now() - startTime,
    };
  }
}
