import { PrismaClient } from "@/generated/prisma";

const prismaGlobal = globalThis as unknown as { ojtPrisma?: PrismaClient };

export const prisma = prismaGlobal.ojtPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") prismaGlobal.ojtPrisma = prisma;
