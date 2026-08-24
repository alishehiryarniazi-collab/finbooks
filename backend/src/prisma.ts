import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the whole app (avoids exhausting DB connections).
export const prisma = new PrismaClient();
