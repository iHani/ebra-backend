// src/redis.ts
import { createClient } from 'redis';

const redis = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`,
});

redis.on('error', (err) => console.error('[REDIS ERROR]', err));

export async function initRedis(): Promise<void> {
    if (!redis.isOpen) {
        await redis.connect();
        console.log('✅ Redis connected');
    }
}

export default redis;
