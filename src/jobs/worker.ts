// src/jobs/worker.ts
import { PrismaClient, Call, CallStatus } from '@prisma/client';
import axios from 'axios';
import redis, { initRedis } from '../redis';
import { kafkaConsumer, kafkaProducer, startKafkaConsumer, startKafkaProducer } from '../kafka';
import { CallStatusPayload } from '../types';

const prisma = new PrismaClient();

const MAX_CONCURRENT_CALLS = 30;
const AI_PROVIDER_URL: string = process.env.AI_PROVIDER_URL!;
const CALLBACK_BASE_URL: string = process.env.CALLBACK_BASE_URL!;
const REDIS_LOCK_TTL_SEC = 300; // 5 min
const overrideSequences: Record<string, CallStatus[]> = {};

async function getActiveCallCount(): Promise<number> {
    return prisma.call.count({ where: { status: CallStatus.IN_PROGRESS } });
}

async function processCall(call: Call): Promise<void> {
    const lockKey = `lock:${call.to}`;
    const result = await redis.set(lockKey, call.id, { NX: true, EX: REDIS_LOCK_TTL_SEC });

    if (result !== 'OK') {
        console.log(`🔒 Phone ${call.to} already locked. Skipping.`);
        return;
    }

    console.log(`✅ Locked phone ${call.to} for call ${call.id}`);

    try {
        // Simulate call accepted
        await prisma.call.update({
            where: { id: call.id },
            data: {
                status: CallStatus.IN_PROGRESS,
                startedAt: new Date(),
            },
        });

        console.log(`[SIMULATION] Call ${call.id} marked as IN_PROGRESS`);


        // Determine the next status to simulate
        let simulatedStatus: CallStatus;
        const ov = call.metadata?.override as string | undefined;
        if (ov) {
            // initialize the sequence on first hit
            if (!overrideSequences[call.id]) {
                overrideSequences[call.id] = ov === 'FAIL_THEN_SUCCESS'
                    ? ['FAILED', 'FAILED', 'COMPLETED']
                    : ov === 'PERM_FAIL'
                        ? ['FAILED', 'FAILED', 'FAILED']
                        : ['COMPLETED'];
            }
            simulatedStatus = overrideSequences[call.id].shift()!;
        } else {
            // fallback to random as before
            const pool: CallStatus[] = ['COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER'];
            simulatedStatus = pool[Math.floor(Math.random() * pool.length)];
        }


        // Fake callback delay
        setTimeout(async () => {
            const statusPool: CallStatus[] = ['COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER'];
            const simulatedStatus = statusPool[Math.floor(Math.random() * statusPool.length)];

            const payload: CallStatusPayload = {
                callId: call.id,
                status: simulatedStatus,
                ...(simulatedStatus === 'COMPLETED' || simulatedStatus === 'FAILED'
                    ? { durationSec: 20 }
                    : {}),
                completedAt: new Date().toISOString(),
            };

            try {
                console.log(`[SIMULATION] Sending callback for ${call.id} with status: ${payload.status}`);
                await axios.post(`${CALLBACK_BASE_URL}/call-status`, payload);

                await kafkaProducer.send({
                    topic: 'call-status-updates',
                    messages: [{ value: JSON.stringify(payload) }],
                });

                console.log(`[SIMULATION] Kafka message produced for call ${call.id}`);
            } catch (err) {
                console.error(`[SIMULATION ERROR] Callback/Kafka failed for ${call.id}:`, err);
            } finally {
                // Done with this phone call — release lock
                await redis.del(lockKey);
            }

        }, 20_000);
    } catch (err) {
        const attempts = call.attempts + 1;
        const isFinal = attempts >= 3;
        const error = (err as Error).message;

        console.error(`❌ Error processing call ${call.id}: ${error}`);

        await prisma.call.update({
            where: { id: call.id },
            data: {
                status: isFinal ? CallStatus.FAILED : CallStatus.PENDING,
                attempts,
                lastError: error,
                ...(isFinal && { endedAt: new Date() }),
            },
        });

        if (!isFinal) {
            await kafkaProducer.send({
                topic: 'call-requests',
                messages: [{ value: JSON.stringify({ ...call, attempts }) }],
            });
            console.log(`🔄 Re‑queued call ${call.id} (attempt ${attempts})`);
        }

    }
}

async function runWorkerLoop() {

    try {
        await initRedis();
        console.log('✅ [Worker] Redis connected');

        await startKafkaProducer();
        await startKafkaConsumer();
        await kafkaConsumer.subscribe({ topic: 'call-requests', fromBeginning: true });

        await kafkaConsumer.run({
            // allow up to MAX_CONCURRENT_CALLS in parallel:
            partitionsConsumedConcurrently: MAX_CONCURRENT_CALLS, eachMessage: async ({ message }) => {
                const raw = message.value?.toString();
                if (!raw) return;

                console.log(`📥 Received message: ${raw}`);

                try {
                    const call = JSON.parse(raw);

                    const activeCount = await getActiveCallCount();
                    if (activeCount >= MAX_CONCURRENT_CALLS) {
                        console.log(`⏳ Max concurrency reached. Skipping call ${call.id}`);
                        return;
                    }

                    await processCall(call);
                } catch (err) {
                    console.error('❌ Failed to handle message:', err);
                }
            },
        });

        console.log('👷 Kafka consumer running for call-requests...');
    } catch (err) {
        console.error('🔥 Worker failed to start:', err);
        process.exit(1);
    }
}


runWorkerLoop();
