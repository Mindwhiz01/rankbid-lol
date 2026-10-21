import { PrismaClient } from '@prisma/client';

/**
 * DATABASE_URL goes through Supabase's connection pooler, which hands each query to any free connection.
 * Prisma's prepared statements then collide ("prepared statement \"s0\" already exists"), which broke login.
 * `pgbouncer=true` turns them off; it's added here so the stored secret doesn't have to carry it.
 */
function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');
    return url.toString();
  } catch {
    return raw;
  }
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// One client per server instance (and per dev hot reload), shared by every route.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl(), log: ['error'] });
globalForPrisma.prisma = prisma;
