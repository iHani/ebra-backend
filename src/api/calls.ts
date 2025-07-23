import { Router, Request, Response } from 'express';
import { PrismaClient, CallStatus, Call } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/v1/calls
 * Create a new call request
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { to, scriptId, metadata } = req.body as {
        to?: string;
        scriptId?: string;
        metadata?: Record<string, unknown> | null;
    };

    console.log(`Received call request for ${to} with scriptId ${scriptId}`);

    if (!to || !scriptId) {
        res.status(400).json({ error: 'Missing "to" or "scriptId"' });
        return;
    }

    try {
        const call: Call = await prisma.call.create({
            data: {
                to,
                scriptId,
                metadata,
                status: CallStatus.PENDING,
                attempts: 0,
            },
        });

        res.status(201).json(call);
    } catch (error) {
        console.error('Error creating call:', error);
        res.status(500).json({ error: 'Failed to create call' });
    }
});

/**
 * GET /api/v1/calls/:id
 * Fetch a call by ID
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const call = await prisma.call.findUnique({ where: { id } });

        if (!call) {
            res.status(404).json({ error: 'Call not found' });
            return;
        }

        res.json(call);
    } catch (error) {
        console.error('Error fetching call:', error);
        res.status(500).json({ error: 'Failed to fetch call' });
    }
});

/**
 * PATCH /api/v1/calls/:id
 * Update the payload (only if status === 'PENDING')
 */
router.patch('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const { to, scriptId, metadata } = req.body as {
        to?: string;
        scriptId?: string;
        metadata?: Record<string, unknown> | null;
    };

    try {
        const existing = await prisma.call.findUnique({ where: { id } });

        if (!existing) {
            res.status(404).json({ error: 'Call not found' });
            return;
        }

        if (existing.status !== CallStatus.PENDING) {
            res.status(400).json({ error: 'Can only update calls with status=PENDING' });
            return;
        }

        const updated = await prisma.call.update({
            where: { id },
            data: { to, scriptId, metadata },
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating call:', error);
        res.status(500).json({ error: 'Failed to update call' });
    }
});

/**
 * GET /api/v1/calls?status=...&skip=0&take=10
 * List calls by status, paginated
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
    const { status, skip = '0', take = '10' } = req.query;

    const where = status ? { status: status as CallStatus } : {};

    try {
        const calls = await prisma.call.findMany({
            where,
            skip: Number(skip),
            take: Number(take),
            orderBy: { createdAt: 'desc' },
        });

        res.json(calls);
    } catch (error) {
        console.error('Error listing calls:', error);
        res.status(500).json({ error: 'Failed to list calls' });
    }
});

/**
 * GET /api/v1/metrics
 * Returns counts of calls per status
 */
router.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
    try {
        const statuses: CallStatus[] = [
            CallStatus.PENDING,
            CallStatus.IN_PROGRESS,
            CallStatus.COMPLETED,
            CallStatus.FAILED,
            CallStatus.EXPIRED,
        ];

        const counts = await Promise.all(
            statuses.map(async (status) => {
                const count = await prisma.call.count({ where: { status } });
                return [status, count] as [CallStatus, number];
            })
        );

        const response = Object.fromEntries(counts);
        res.json(response);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

export default router;
