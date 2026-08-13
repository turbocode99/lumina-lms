import { PrismaClient } from "@prisma/client";

/**
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit until the database refuses connections. Caching
 * the client on `globalThis` keeps a single instance across reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export default db;
