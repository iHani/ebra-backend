import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import callsRouter from './api/calls';
import callbacksRouter from './api/callbacks';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT: number = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json());

// Versioned API routes
app.use('/api/v1/calls', callsRouter);
app.use('/api/v1/callbacks', callbacksRouter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok' });
});

// Graceful shutdown
process.on('SIGINT', async (): Promise<void> => {
    console.log('🔌 Disconnecting Prisma...');
    await prisma.$disconnect();
    console.log('👋 Shutdown complete.');
    process.exit(0);
});

// Start server
app.listen(PORT, (): void => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
