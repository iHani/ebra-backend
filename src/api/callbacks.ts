// src/api/callbacks.ts
import { Router, Request, Response } from 'express';
import { CallStatus } from '@prisma/client';
import { CallStatusPayload } from '../types';
import prisma from '../db';
import redis from '../redis';

const router = Router();

router.post('/call-status', async (req: Request<{}, {}, CallStatusPayload>, res: Response) => {
    console.log('[WEBHOOK] Received call status update:', req.body);

    const { callId, status, completedAt } = req.body;

    if (!callId || !status || !completedAt) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const allowedStatuses: CallStatus[] = ['COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid call status' });
    }

    try {
        const updated = await prisma.call.update({
            where: { id: callId },
            data: {
                status,
                endedAt: new Date(completedAt),
            },
        });

        await redis.del(`lock:${updated.to}`);

        console.log(`[WEBHOOK] Call ${callId} marked as ${status}`);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('[ERROR] Failed to process webhook:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
