// src/db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export default prisma;

export type Call = Awaited<ReturnType<typeof prisma.call.findFirst>>;
