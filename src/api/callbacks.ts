import { Router, Request, Response } from 'express';
import { PrismaClient, CallStatus } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/v1/callbacks/call-status
 * Updates a call's status based on external provider webhook
 */
router.post('/call-status', async (req: Request, res: Response): Promise<void> => {
    const { callId, status, completedAt } = req.body as {
        callId?: string;
        status?: CallStatus;
        completedAt?: string;
    };

    if (!callId || !status || !completedAt) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    try {
        const result = await prisma.call.updateMany({
            where: { id: callId },
            data: {
                status,
                endedAt: new Date(completedAt),
            },
        });

        if (result.count === 0) {
            res.status(404).json({ error: 'Call not found' });
            return;
        }

        res.status(200).json({ updated: true });
    } catch (error) {
        console.error('Error processing callback:', error);
        res.status(500).json({ error: 'Failed to process callback' });
    }
});

export default router;
