// src/jobs/worker.ts
import { PrismaClient, Call, CallStatus } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';
import redis from '../redis';

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
async function fetchNextPendingCall(): Promise<Call | null> {
    return prisma.$transaction(async (tx) => {
        const next = await tx.call.findFirst({
            where: { status: CallStatus.PENDING },
            orderBy: { createdAt: 'asc' },
        });

        if (!next) return null;

        return tx.call.update({
            where: { id: next.id },
            data: {
                status: CallStatus.IN_PROGRESS,
                startedAt: new Date(),
            },
        });
    });
}

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
        const response: AxiosResponse = await axios.post(AI_PROVIDER_URL, {
            to: call.to,
            scriptId: call.scriptId,
            webhookUrl: `${CALLBACK_BASE_URL}/call-status`,
        });

        if (response.status !== 202) {
            throw new Error(`Non-accepted response: ${response.status}`);
        }

        // Call accepted — webhook will update status
    } catch (err) {
        const error = err as Error;
        console.error(`Call ${call.id} failed:`, error.message);

        const attempts = call.attempts + 1;

        if (attempts < 3) {
            await prisma.call.update({
                where: { id: call.id },
                data: {
                    status: CallStatus.PENDING,
                    attempts,
                    lastError: error.message,
                },
            });
        } else {
            await prisma.call.update({
                where: { id: call.id },
                data: {
                    status: CallStatus.FAILED,
                    attempts,
                    lastError: error.message,
                    endedAt: new Date(),
                },
            });
        }

        await redis.del(`lock:${call.to}`);
    }
}

/**
 * Main worker loop: runs a single pass, respecting the concurrency limit.
 */
export async function runWorkerLoop(): Promise<void> {
    const activeCount = await getActiveCallCount();
    if (activeCount >= MAX_CONCURRENT_CALLS) return;

    const nextCall = await fetchNextPendingCall();
    if (!nextCall) return;

    await processCall(nextCall);
}
