// src/server.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import callsRouter from './api/calls';
import metricsRouter from './api/metrics';
import callbacksRouter from './api/callbacks';
import { initRedis } from './redis';
import { startKafkaProducer } from './kafka';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok' });
});

// API routes
app.use('/api/v1/calls', callsRouter);
app.use('/api/v1/metrics', metricsRouter);
app.use('/api/v1/callbacks', callbacksRouter);

startKafkaProducer().catch((err) => {
    console.error('[Kafka] Producer connection failed:', err);
    process.exit(1);
});

// Start server after Redis is ready
initRedis()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server ready at http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to connect to Redis:', err);
        process.exit(1);
    });
