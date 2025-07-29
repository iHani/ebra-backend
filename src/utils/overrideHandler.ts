import prisma from '../db';
import kafka from '../kafka';
import { CallStatus } from '@prisma/client';
import type { Call } from '../types';

export interface OverrideResult {
    handled: true;
    statusCode: number;
    payload: any;
}

// Returns `null` if no override applies
export async function applyOverride(
    call: Call
): Promise<OverrideResult | null> {
    const ov = call.metadata?.override as string | undefined;
    if (!ov) return null;

    switch (ov) {
        case 'FORCE_SUCCESS': {
            const done = await prisma.call.update({
                where: { id: call.id },
                data: { status: 'COMPLETED', attempts: 1, endedAt: new Date() },
            });
            return { handled: true, statusCode: 200, payload: done };
        }

        case 'FAIL_THEN_SUCCESS': {
            // 1st failure only; worker’s sequence logic will pick up next steps
            const interim = await prisma.call.update({
                where: { id: call.id },
                data: {
                    status: 'FAILED',
                    attempts: 1,
                    lastError: 'Forced failure #1',
                    endedAt: new Date(),
                },
            });
            return {
                handled: true,
                statusCode: 200,
                payload: { ...interim, note: 'First forced failure only' },
            };
        }

        case 'PERM_FAIL': {
            const failed = await prisma.call.update({
                where: { id: call.id },
                data: {
                    status: 'FAILED',
                    attempts: 3,
                    lastError: 'Forced permanent failure',
                    endedAt: new Date(),
                },
            });
            return { handled: true, statusCode: 200, payload: failed };
        }

        default:
            return null;
    }
}
