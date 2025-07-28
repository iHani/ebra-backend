// src/redis.ts
import { createClient } from 'redis';

const redis = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`,
});

redis.on('error', (err) => console.error('[REDIS ERROR]', err));

export async function initRedis(retries = 5, delayMs = 2000): Promise<void> {
    for (let i = 0; i < retries; i++) {
        try {
            if (!redis.isOpen) {
                await redis.connect();
            }
            console.log('✅ Redis connected');
            return;
        } catch (err) {
            console.warn(`[Redis] Retry ${i + 1}/${retries}...`);
            if (i === retries - 1) throw err;
            await new Promise((res) => setTimeout(res, delayMs));
        }
    }
}


export default redis;
