// src/api/calls.ts
import { Router, Request, Response } from 'express';
import prisma from '../db';
import { CreateCallInput, UpdateCallPayload, CallQuery } from '../types';
import { CallStatus } from '@prisma/client';

const router = Router();

// POST /calls
router.post('/', async (req: Request<{}, {}, CreateCallInput>, res: Response) => {
    const { to, scriptId, metadata } = req.body;

    if (!to || !scriptId) {
        return res.status(400).json({ error: 'Missing to or scriptId' });
    }

    try {
        const call = await prisma.call.create({
            data: {
                to,
                scriptId,
                metadata,
                status: 'PENDING',
                attempts: 0,
            },
        });
        console.log(`[CREATE] Call ${call.id} created`);
        res.status(201).json(call);
    } catch (err) {
        console.error('[ERROR] Failed to create call:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /calls/:id
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        const call = await prisma.call.findUnique({ where: { id: req.params.id } });

        if (!call) return res.status(404).json({ error: 'Call not found' });

        res.json(call);
    } catch (err) {
        console.error('[ERROR] Failed to fetch call:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /calls/:id
router.patch('/:id', async (req: Request<{ id: string }, {}, UpdateCallPayload>, res: Response) => {
    try {
        const existing = await prisma.call.findUnique({ where: { id: req.params.id } });

        if (!existing) return res.status(404).json({ error: 'Call not found' });
        if (existing.status !== 'PENDING') {
            return res.status(400).json({ error: 'Only PENDING calls can be updated' });
        }

        const updated = await prisma.call.update({
            where: { id: req.params.id },
            data: {
                scriptId: req.body.scriptId ?? existing.scriptId,
                metadata: (req.body.metadata ?? existing.metadata) || undefined,
            },
        });

        console.log(`[UPDATE] Call ${updated.id} updated`);
        res.json(updated);
    } catch (err) {
        console.error('[ERROR] Failed to update call:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /calls?status=...
router.get('/', async (req: Request<{}, {}, {}, CallQuery>, res: Response) => {
    try {
        const status = req.query.status as CallStatus | undefined;

        const calls = await prisma.call.findMany({
            where: status ? { status } : {},
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        res.json(calls);
    } catch (err) {
        console.error('[ERROR] Failed to list calls:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
