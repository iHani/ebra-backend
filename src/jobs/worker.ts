import { PrismaClient, CallStatus } from '@prisma/client';

const prisma = new PrismaClient();
const MAX_CONCURRENT_CALLS = 30;

async function getActiveCallCount() {
    return await prisma.call.count({
        where: { status: CallStatus.IN_PROGRESS },
    });
}

async function fetchNextPendingCall() {
    const result = await prisma.$transaction(async (tx) => {
        const next = await tx.call.findFirst({
            where: { status: CallStatus.PENDING },
            orderBy: { createdAt: 'asc' },
        });

        if (!next) return null;

        const updated = await tx.call.update({
            where: { id: next.id },
            data: {
                status: CallStatus.IN_PROGRESS,
                startedAt: new Date(),
            },
        });

        return updated;
    });

    return result;
}

async function processCall(call: any) {
    try {

        console.log(`Simulating call to ${call.to}...`);
        await new Promise((res) => setTimeout(res, 500)); // simulate network delay
        console.log(`Simulated call started for ${call.id}`);

    } catch (err: any) {
        console.error(`Call ${call.id} failed:`, err.message);

        const attempts = call.attempts + 1;

        if (attempts < 3) {
            // Retry by resetting status to PENDING
            await prisma.call.update({
                where: { id: call.id },
                data: {
                    status: CallStatus.PENDING,
                    attempts,
                    lastError: err.message,
                },
            });
        } else {
            // Mark as permanently failed
            await prisma.call.update({
                where: { id: call.id },
                data: {
                    status: CallStatus.FAILED,
                    attempts,
                    lastError: err.message,
                    endedAt: new Date(),
                },
            });
        }
    }
}

export async function runWorkerLoop() {
    const active = await getActiveCallCount();
    if (active >= MAX_CONCURRENT_CALLS) return;

    const call = await fetchNextPendingCall();
    if (!call) return;

    await processCall(call);
}
