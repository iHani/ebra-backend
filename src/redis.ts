// src/redis.ts
import { createClient } from 'redis';

const raw = process.env.REDIS_URL ?? 'localhost:6379';
// if it already starts with "redis://", use as‑is; otherwise prefix it
const url = raw.startsWith('redis://') ? raw : `redis://${raw}`;

const client = createClient({ url });
client.on('error', err => console.error('🔴 Redis error:', err));

export async function initRedis() {
    if (!client.isOpen) {
        await client.connect();
        console.log('✅ Redis connected to', url);
    }
}

export default client;

