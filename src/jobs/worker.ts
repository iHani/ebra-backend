// src/jobs/worker.ts
import { PrismaClient, Call, CallStatus } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';
import redis from '../redis';
import kafka, { kafkaProducer } from '../kafka';
import { EachMessagePayload } from 'kafkajs';
import { CallStatusPayload } from '../types';

const prisma = new PrismaClient();

const MAX_CONCURRENT_CALLS = 30;
const AI_PROVIDER_URL: string = process.env.AI_PROVIDER_URL!;
const CALLBACK_BASE_URL: string = process.env.CALLBACK_BASE_URL!;
const REDIS_LOCK_TTL_SEC = 300; // 5 min

/**
 * Count the number of active (in-progress) calls.
 */
async function getActiveCallCount(): Promise<number> {
    return prisma.call.count({
        where: { status: CallStatus.IN_PROGRESS },
    });
}

/**
 * Atomically fetch the next pending call and mark it as in-progress.
 */
// async function fetchNextPendingCall(): Promise<Call | null> {
//     return prisma.$transaction(async (tx) => {
//         const next = await tx.call.findFirst({
//             where: { status: CallStatus.PENDING },
//             orderBy: { createdAt: 'asc' },
//         });

//         if (!next) return null;

//         return tx.call.update({
//             where: { id: next.id },
//             data: {
//                 status: CallStatus.IN_PROGRESS,
//                 startedAt: new Date(),
//             },
//         });
//     });
// }

/**
 * Process a single call: send to AI provider and handle retries or failures.
 */
async function processCall(call: Call): Promise<void> {
    const result = await redis.set(`lock:${call.to}`, call.id, {
        NX: true,
        EX: 300,
    });

    if (result !== 'OK') {
        console.log(`Phone ${call.to} already locked. Skipping.`);
        return;
    }

    console.log(`Locked phone ${call.to}`);

    try {
        // Instead of hitting the real provider, simulate it
        console.log(`[SIMULATION] Sending fake AI call to ${call.to}`);

        // Pretend it was accepted
        await prisma.call.update({
            where: { id: call.id },
            data: {
                status: CallStatus.IN_PROGRESS,
                startedAt: new Date(),
            },
        });

        // Simulate delayed callback
        setTimeout(async () => {
            const statusPool: CallStatus[] = ['COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER'];
            const simulatedStatus = statusPool[Math.floor(Math.random() * statusPool.length)];

            const payload: CallStatusPayload = {
                callId: call.id,
                status: simulatedStatus,
                ...(simulatedStatus === 'COMPLETED' || simulatedStatus === 'FAILED'
                    ? { durationSec: Math.floor(Math.random() * 90) + 10 }
                    : {}),
                completedAt: new Date().toISOString(),
            };

            try {
                await axios.post(`${process.env.CALLBACK_BASE_URL}/call-status`, payload);
                console.log(`[SIMULATION] Callback sent with status ${payload.status}`);

                // Optionally produce Kafka event
                await kafkaProducer.send({
                    topic: 'call-status-updates',
                    messages: [{ value: JSON.stringify(payload) }],
                });
                console.log(`[SIMULATION] Kafka message produced`);
            } catch (err) {
                console.error('[SIMULATION ERROR] Failed to post callback or send Kafka event:', err);
            }
        }, 1500); // Fake delay of 1.5s
    } catch (err) {
        const error = err as Error;
        console.error(`Call ${call.id} failed:`, error.message);

        const attempts = call.attempts + 1;

        const isFinalAttempt = attempts >= 3;

        await prisma.call.update({
            where: { id: call.id },
            data: {
                status: isFinalAttempt ? CallStatus.FAILED : CallStatus.PENDING,
                attempts,
                lastError: error.message,
                ...(isFinalAttempt && { endedAt: new Date() }),
            },
        });

        await redis.del(`lock:${call.to}`);
    }
}


/**
 * Main worker loop: runs a single pass, respecting the concurrency limit.
 */
export async function runWorkerLoop(): Promise<void> {
    const consumer = kafka.consumer({ groupId: 'call-workers' });

    await consumer.connect();
    await consumer.subscribe({ topic: 'call-requests', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            const call = JSON.parse(message.value.toString());

            // ✅ Enforce concurrency cap
            const activeCount = await getActiveCallCount();
            if (activeCount >= MAX_CONCURRENT_CALLS) {
                console.log(`⏳ Max concurrency (${MAX_CONCURRENT_CALLS}) reached. Skipping ${call.id}`);
                return;
            }

            // 🔐 Lock + process
            await processCall(call);
        },
    });


    console.log('👷 Kafka consumer running for call-requests...');
}
