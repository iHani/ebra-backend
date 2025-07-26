// src/api/metrics.ts
import { Router, Request, Response } from 'express';
import prisma from '../db';
import { CallStatus } from '@prisma/client';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
    try {
        const statuses: CallStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED'];
        const counts: Record<CallStatus, number> = {
            PENDING: 0,
            IN_PROGRESS: 0,
            COMPLETED: 0,
            FAILED: 0,
            EXPIRED: 0,
        };

        await Promise.all(
            statuses.map(async (status) => {
                counts[status] = await prisma.call.count({ where: { status } });
            })
        );

        res.json(counts);
    } catch (err) {
        console.error('[ERROR] Failed to fetch metrics:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
