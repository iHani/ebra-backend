// src/api/callbacks.ts
import { Router, Request, Response } from 'express';
import { CallStatusPayload } from '../types';
import prisma from '../db';
import redis from '../redis';

const router = Router();

router.post('/call-status', async (req: Request<{}, {}, CallStatusPayload>, res: Response) => {
    const { callId, status, completedAt } = req.body;

    if (!callId || !status || !completedAt) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newStatus = status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';

    try {
        const updated = await prisma.call.update({
            where: { id: callId },
            data: {
                status: newStatus,
                endedAt: new Date(completedAt),
            },
        });

        const endedCall = await prisma.call.findUnique({ where: { id: callId } });
        if (endedCall) {
            await redis.del(`lock:${endedCall.to}`);
        }


        console.log(`[WEBHOOK] Call ${callId} marked as ${newStatus}`);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('[ERROR] Failed to process webhook:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
