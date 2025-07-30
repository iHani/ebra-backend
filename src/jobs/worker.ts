// src/jobs/worker.ts
import { PrismaClient, Call, CallStatus } from '@prisma/client';
import axios from 'axios';
import redisClient, { initRedis } from '../redis';
import {
    kafkaConsumer,
    kafkaProducer,
    startKafkaConsumer,
    startKafkaProducer,
} from '../kafka';
import type { CallStatusPayload } from '../types';


const prisma = new PrismaClient();

const MAX_CONCURRENT_CALLS = 30;

const FAIL_THEN_SUCCESS_NUMBERS = new Set(['+966-FAIL_THEN_SUCCESS_NUMBERS']);
const PERM_FAIL_NUMBERS = new Set(['+966-PERM_FAIL_NUMBERS']);
const LOCK_TTL_SEC = 300; // seconds
const CALLBACK_URL = `${process.env.CALLBACK_BASE_URL}/call-status`!;

// In‑memory map to track per-call override sequences
const overrideSeq: Record<string, CallStatus[]> = {};

// Helper to re‑enqueue a call
async function enqueueCall(call: Call) {
    await kafkaProducer.send({
        topic: 'call-requests',
        messages: [{ value: JSON.stringify(call) }],
    });
    console.log(`🔄 Re‑enqueued call ${call.id}`);
}

// Utility delay
function delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

async function processCall(call: Call): Promise<void> {
    const lockKey = `lock:${call.to}`;
    let newAttempts = 0;

    // 1) Acquire per‑phone lock
    const locked = await redisClient.set(lockKey, call.id, { NX: true, EX: LOCK_TTL_SEC });
    if (locked !== 'OK') {
        console.log(`🔒 ${call.to} is locked; skipping ${call.id}`);
        return;
    }
    console.log(`✅ Locked ${call.to} for call ${call.id}`);

    try {
        // 2) Mark IN_PROGRESS & bump attempts, get updated record
        const updatedCall = await prisma.call.update({
            where: { id: call.id },
            data: {
                status: CallStatus.IN_PROGRESS,
                startedAt: new Date(),
                attempts: call.attempts + 1,
            },
        });
        newAttempts = updatedCall.attempts;
        console.log(`📤 Call ${call.id} picked up (attempt ${newAttempts}/3)`);

        // 3) Simulate fixed 20s call duration
        await delay(20_000);

        // 4) Determine simulated status by phone override or random fallback
        let simulatedStatus: CallStatus;
        if (FAIL_THEN_SUCCESS_NUMBERS.has(call.to)) {
            if (!overrideSeq[call.id]) {
                overrideSeq[call.id] = [
                    CallStatus.FAILED,
                    CallStatus.FAILED,
                    CallStatus.COMPLETED,
                ];
            }
            simulatedStatus = overrideSeq[call.id].shift()!;
        } else if (PERM_FAIL_NUMBERS.has(call.to)) {
            if (!overrideSeq[call.id]) {
                overrideSeq[call.id] = [
                    CallStatus.FAILED,
                    CallStatus.FAILED,
                    CallStatus.FAILED,
                ];
            }
            simulatedStatus = overrideSeq[call.id].shift()!;
        } else {
            const pool: CallStatus[] = [
                CallStatus.COMPLETED,
                CallStatus.FAILED,
                CallStatus.BUSY,
                CallStatus.NO_ANSWER,
            ];
            simulatedStatus = pool[Math.floor(Math.random() * pool.length)];
        }

        // 5) If COMPLETED, invoke callback; else throw to trigger retry
        if (simulatedStatus === CallStatus.COMPLETED) {
            const payload: CallStatusPayload = {
                callId: call.id,
                status: simulatedStatus,
                durationSec: 20,
                completedAt: new Date().toISOString(),
            };
            console.log(`[SIM] Call ${call.id} → COMPLETED; invoking callback`);
            await axios.post(CALLBACK_URL, payload);
        } else {
            throw new Error(`Simulated ${simulatedStatus}`);
        }

    } catch (err: any) {
        // 6) Retry logic
        const isFinal = newAttempts >= 3;
        const errorMsg = err.message || 'Unknown error';

        if (!isFinal) {
            console.log(`🔄 Call ${call.id} failed on attempt ${newAttempts}/3: ${errorMsg}`);
            // Reset to PENDING
            await prisma.call.update({
                where: { id: call.id },
                data: { status: CallStatus.PENDING, lastError: errorMsg },
            });
            // Back‑off then re‑enqueue
            setTimeout(() => enqueueCall({ ...call, attempts: newAttempts }), 5000 * newAttempts);
        } else {
            console.log(`❌ Call ${call.id} permanently failed on attempt ${newAttempts}/3`);
            await prisma.call.update({
                where: { id: call.id },
                data: {
                    status: CallStatus.FAILED,
                    lastError: errorMsg,
                    endedAt: new Date(),
                },
            });
        }

    } finally {
        // 7) Release the lock
        await redisClient.del(lockKey);
        console.log(`🔓 Released lock for ${call.to}`);
    }
}


let activeCalls = 0;

async function runWorkerLoop() {
    try {
        await initRedis();
        console.log('✅ Redis connected');

        await startKafkaProducer();
        console.log('✅ Kafka producer connected');
        await startKafkaConsumer();
        console.log('✅ Kafka consumer connected');

        // bootstrap from the DB on startup
        const pendingCalls = await prisma.call.findMany({ where: { status: CallStatus.PENDING } });
        console.log(`♻️ Bootstrapping ${pendingCalls.length} pending calls into Kafka…`);
        for (const call of pendingCalls) {
            await enqueueCall(call);
        }

        await kafkaConsumer.subscribe({ topic: 'call-requests', fromBeginning: true });

        await kafkaConsumer.run({
            eachMessage: async ({ message }) => {
                if (!message.value) return;
                const call: Call = JSON.parse(message.value.toString());

                // 1) Concurrency guard
                if (activeCalls >= MAX_CONCURRENT_CALLS) {
                    console.log(`⏳ Concurrency full; re‑enqueuing ${call.id}`);
                    return enqueueCall(call);
                }

                // 2) Book a slot
                activeCalls++;
                console.log(`🔢 Active calls: ${activeCalls}/${MAX_CONCURRENT_CALLS}`);

                // 3) Fire off the work (no await) and free the slot when done
                processCall(call)
                    .catch(err =>
                        console.error(`⚠️ Unhandled processCall(${call.id}) error:`, err)
                    )
                    .finally(() => {
                        activeCalls--;
                        console.log(`➖ Slot freed; active calls: ${activeCalls}`);
                    });
            },
        });

        console.log(`👷 Worker running (≤${MAX_CONCURRENT_CALLS} concurrent)`);
    } catch (err) {
        console.error('🔥 Worker failed to start:', err);
        process.exit(1);
    }
}


runWorkerLoop();
