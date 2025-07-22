import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/v1/callbacks/call-status
 * Updates a call's status based on external provider webhook
 */
router.post('/call-status', async (req, res) => {
    const { callId, status, completedAt } = req.body;

    if (!callId || !status || !completedAt) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const call = await prisma.call.updateMany({
            where: { id: callId },
            data: {
                status,
                endedAt: new Date(completedAt),
            },
        });

        if (call.count === 0) {
            return res.status(404).json({ error: 'Call not found' });
        }

        res.status(200).json({ updated: true });
    } catch (error) {
        console.error('Error processing callback:', error);
        res.status(500).json({ error: 'Failed to process callback' });
    }
});

export default router;
