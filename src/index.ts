import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import callsRouter from './api/calls';
import callbacksRouter from './api/callbacks';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Versioned routes
app.use('/api/v1/calls', callsRouter);
app.use('/api/v1/callbacks', callbacksRouter);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
