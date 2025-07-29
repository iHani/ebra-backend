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
// Ensure PORT is a number
const PORT: number = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok' });
});

// API routes
app.use('/api/v1/calls', callsRouter);
app.use('/api/v1/metrics', metricsRouter);
app.use('/api/v1/callbacks', callbacksRouter);

// Bootstrap Kafka and Redis before starting HTTP server
async function bootstrap() {
    try {
        await startKafkaProducer();
        console.log('✅ Kafka producer connected');

        await initRedis();
        console.log('✅ Redis connected');

        // Explicitly bind to 0.0.0.0 for Docker
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server ready at http://0.0.0.0:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Bootstrap failed:', err);
        process.exit(1);
    }
}

bootstrap();
