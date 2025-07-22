import { Router } from 'express';
import { PrismaClient, CallStatus } from '@prisma/client';

const prisma = new PrismaClient();

const router = Router();

/**
 * POST /api/v1/calls
 * Create a new call request
 */
router.post('/', async (req, res) => {
    const { to, scriptId, metadata } = req.body;

    if (!to || !scriptId) {
        return res.status(400).json({ error: 'Missing "to" or "scriptId"' });
    }

    try {
        const call = await prisma.call.create({
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
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const call = await prisma.call.findUnique({ where: { id } });

        if (!call) {
            return res.status(404).json({ error: 'Call not found' });
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
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { to, scriptId, metadata } = req.body;

    try {
        const existing = await prisma.call.findUnique({ where: { id } });

        if (!existing) {
            return res.status(404).json({ error: 'Call not found' });
        }

        if (existing.status !== CallStatus.PENDING) {
            return res.status(400).json({ error: 'Can only update calls with status=PENDING' });
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
router.get('/', async (req, res) => {
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
router.get('/metrics', async (_req, res) => {
    try {
        const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED'] as const;

        const counts = await Promise.all(
            statuses.map(async (status) => {
                const count = await prisma.call.count({ where: { status } });
                return [status, count];
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
